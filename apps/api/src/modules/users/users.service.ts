import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  CreateUserInput,
  AuthenticatedUser,
  EntityType,
  GlobalRole,
  ListUsersQuery,
  NotificationType,
  Paginated,
  UpdateProfileInput,
  UpdateUserInput,
  UserDirectoryEntry,
  UserDirectoryQuery,
  UserSummary,
  isUserFunction,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { PASSWORD_SALT_ROUNDS } from '../auth/auth.service';
import { EmailService } from '../collaboration/email.service';
import { ObjectStorageService, type UploadedFileLike } from '../storage/object-storage.service';

const USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  jobTitle: true,
  avatarUrl: true,
  globalRole: true,
  isSuperAdmin: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_FIELDS }>;

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
    private readonly storage: ObjectStorageService,
  ) {}

  async list(query: ListUsersQuery): Promise<Paginated<UserSummary>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.globalRole ? { globalRole: query.globalRole } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_FIELDS,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map(toUserSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /**
   * Annuaire des comptes actifs, accessible à tout utilisateur authentifié.
   * Volontairement pauvre en champs : il sert à choisir une personne, pas à
   * consulter son dossier.
   */
  async directory(query: UserDirectoryQuery): Promise<UserDirectoryEntry[]> {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async getById(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: USER_FIELDS,
    });
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: "Cet utilisateur n'existe pas",
      });
    return toUserSummary(user);
  }

  async create(input: CreateUserInput, actor: AuthenticatedUser): Promise<UserSummary> {
    this.assertCanAssignRole(actor, input.globalRole);
    const passwordHash = await hash(input.password, PASSWORD_SALT_ROUNDS);
    const { user, notificationId } = await this.prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email: input.email,
          name: input.name,
          jobTitle: input.jobTitle || null,
          globalRole: input.globalRole,
          passwordHash,
        },
        select: USER_FIELDS,
      });
      const notification = await transaction.notification.create({
        data: {
          userId: createdUser.id,
          type: NotificationType.ACCOUNT_CREATED,
          title: 'Bienvenue sur VisioraAI Agile',
          body: 'Votre compte est prêt. Consultez votre email pour vos informations de connexion.',
          entityType: EntityType.USER,
          entityId: createdUser.id,
        },
        select: { id: true },
      });
      return { user: createdUser, notificationId: notification.id };
    });

    const emailSent = await this.email.sendAccountCreated({
      email: user.email,
      name: user.name,
      initialPassword: input.password,
    });
    if (!emailSent) {
      this.logger.warn(`Compte ${user.id} créé, mais l'email de bienvenue n'a pas été envoyé.`);
    } else {
      await this.prisma.notification
        .update({ where: { id: notificationId }, data: { emailSentAt: new Date() } })
        .catch((error: unknown) => {
          this.logger.warn(`Statut email non enregistré : ${(error as Error).message}`);
        });
    }

    return toUserSummary(user);
  }

  async uploadOwnAvatar(userId: string, file: UploadedFileLike | undefined): Promise<UserSummary> {
    if (!file) {
      throw new BadRequestException({
        code: 'AVATAR_REQUIRED',
        message: 'Aucune image fournie',
      });
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'AVATAR_TOO_LARGE',
        message: "L'avatar ne doit pas dépasser 5 Mo",
      });
    }

    const extension = AVATAR_EXTENSIONS[file.mimetype as keyof typeof AVATAR_EXTENSIONS];
    if (!extension) {
      throw new BadRequestException({
        code: 'AVATAR_TYPE_NOT_ALLOWED',
        message: 'Utilisez une image JPG, PNG ou WebP',
      });
    }

    const currentUser = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { avatarUrl: true },
    });
    if (!currentUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: "Cet utilisateur n'existe pas",
      });
    }

    const fileName = `${randomUUID()}.${extension}`;
    const storageKey = avatarStorageKey(userId, fileName);
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    let user: UserRow;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: avatarPublicPath(userId, fileName) },
        select: USER_FIELDS,
      });
    } catch (error) {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      throw error;
    }

    const previousStorageKey = avatarStorageKeyFromUrl(userId, currentUser.avatarUrl);
    if (previousStorageKey && previousStorageKey !== storageKey) {
      await this.storage.deleteObject(previousStorageKey).catch((error: unknown) => {
        this.logger.warn(`Ancien avatar non supprimé : ${(error as Error).message}`);
      });
    }

    return toUserSummary(user);
  }

  async getAvatar(userId: string, fileName: string) {
    if (!isAvatarFileName(fileName)) {
      throw new NotFoundException({ code: 'AVATAR_NOT_FOUND', message: "Cet avatar n'existe pas" });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { avatarUrl: true },
    });
    if (user?.avatarUrl !== avatarPublicPath(userId, fileName)) {
      throw new NotFoundException({ code: 'AVATAR_NOT_FOUND', message: "Cet avatar n'existe pas" });
    }

    const storedObject = await this.storage.getObject(avatarStorageKey(userId, fileName));
    return {
      stream: storedObject.stream,
      mimeType: storedObject.contentType ?? avatarMimeType(fileName),
    };
  }

  async update(
    userId: string,
    input: UpdateUserInput,
    actor: AuthenticatedUser,
  ): Promise<UserSummary> {
    const target = await this.getManagedUser(userId);
    this.assertCanManageTarget(actor, target);
    if (input.globalRole !== undefined) this.assertCanAssignRole(actor, input.globalRole);

    if (
      target.isSuperAdmin &&
      (input.globalRole === GlobalRole.MEMBER || input.isActive === false)
    ) {
      await this.assertNotLastSuperAdmin(userId);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle || null } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.globalRole !== undefined ? { globalRole: input.globalRole } : {}),
        ...(input.globalRole === GlobalRole.MEMBER ? { isSuperAdmin: false } : {}),
      },
      select: USER_FIELDS,
    });

    // Désactivation : les sessions ouvertes doivent tomber immédiatement.
    if (input.isActive === false) await this.tokens.revokeAllSessions(userId);

    return toUserSummary(user);
  }

  /** Mise à jour par l'utilisateur lui-même — ne touche ni au rôle ni au statut. */
  async updateOwnProfile(userId: string, input: UpdateProfileInput): Promise<UserSummary> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle || null } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
      select: USER_FIELDS,
    });
    return toUserSummary(user);
  }

  /**
   * Suppression logique : l'utilisateur reste référencé par les tickets qu'il a
   * créés et l'historique des modifications, qui perdraient leur sens sans lui.
   */
  async softDelete(userId: string, actor: AuthenticatedUser): Promise<void> {
    if (userId === actor.id) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_SELF',
        message: 'Vous ne pouvez pas supprimer votre propre compte',
      });
    }

    const target = await this.getManagedUser(userId);
    this.assertCanManageTarget(actor, target);
    if (target.isSuperAdmin) await this.assertNotLastSuperAdmin(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        // Libère l'adresse pour une future création de compte.
        email: `deleted+${userId}@visiora.invalid`,
      },
    });

    await this.tokens.revokeAllSessions(userId);
  }

  async resetPassword(
    userId: string,
    newPassword: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const target = await this.getManagedUser(userId);
    this.assertCanManageTarget(actor, target);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(newPassword, PASSWORD_SALT_ROUNDS) },
    });
    await this.tokens.revokeAllSessions(userId);
  }

  private async getManagedUser(userId: string): Promise<{
    globalRole: GlobalRole;
    isSuperAdmin: boolean;
    isActive: boolean;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { globalRole: true, isSuperAdmin: true, isActive: true },
    });
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: "Cet utilisateur n'existe pas",
      });
    return user;
  }

  private assertCanAssignRole(actor: AuthenticatedUser, role: GlobalRole): void {
    if (role === GlobalRole.ADMIN && !actor.isSuperAdmin) {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Seul le super administrateur peut attribuer le rôle administrateur',
      });
    }
  }

  private assertCanManageTarget(
    actor: AuthenticatedUser,
    target: { globalRole: GlobalRole },
  ): void {
    if (target.globalRole === GlobalRole.ADMIN && !actor.isSuperAdmin) {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Seul le super administrateur peut gérer un compte administrateur',
      });
    }
  }

  /** Garde-fou : la plateforme doit conserver au moins un super administrateur actif. */
  private async assertNotLastSuperAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true, isActive: true },
    });
    if (!user || !user.isSuperAdmin || !user.isActive) return;

    const remainingSuperAdmins = await this.prisma.user.count({
      where: {
        isSuperAdmin: true,
        globalRole: GlobalRole.ADMIN,
        isActive: true,
        deletedAt: null,
        id: { not: userId },
      },
    });
    if (remainingSuperAdmins === 0) {
      throw new BadRequestException({
        code: 'LAST_SUPER_ADMIN',
        message: 'La plateforme doit conserver au moins un super administrateur actif',
      });
    }
  }
}

function toUserSummary(user: UserRow): UserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    jobTitle: isUserFunction(user.jobTitle) ? user.jobTitle : null,
    avatarUrl: user.avatarUrl,
    globalRole: user.globalRole as GlobalRole,
    isSuperAdmin: user.isSuperAdmin,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function avatarPublicPath(userId: string, fileName: string): string {
  return `/users/${userId}/avatar/${fileName}`;
}

function avatarStorageKey(userId: string, fileName: string): string {
  return `avatars/${userId}/${fileName}`;
}

function avatarStorageKeyFromUrl(userId: string, avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  const prefix = `/users/${userId}/avatar/`;
  if (!avatarUrl.startsWith(prefix)) return null;
  const fileName = avatarUrl.slice(prefix.length);
  return isAvatarFileName(fileName) ? avatarStorageKey(userId, fileName) : null;
}

function isAvatarFileName(fileName: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(
    fileName,
  );
}

function avatarMimeType(fileName: string): string {
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
