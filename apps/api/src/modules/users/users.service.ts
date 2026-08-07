import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import {
  CreateUserInput,
  GlobalRole,
  ListUsersQuery,
  Paginated,
  UpdateProfileInput,
  UpdateUserInput,
  UserSummary,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { PASSWORD_SALT_ROUNDS } from '../auth/auth.service';

const USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  jobTitle: true,
  avatarUrl: true,
  globalRole: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_FIELDS }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
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

  async getById(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: USER_FIELDS,
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: "Cet utilisateur n'existe pas" });
    return toUserSummary(user);
  }

  async create(input: CreateUserInput): Promise<UserSummary> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        jobTitle: input.jobTitle ?? null,
        globalRole: input.globalRole,
        passwordHash: await hash(input.password, PASSWORD_SALT_ROUNDS),
      },
      select: USER_FIELDS,
    });
    return toUserSummary(user);
  }

  async update(userId: string, input: UpdateUserInput): Promise<UserSummary> {
    await this.assertExists(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.globalRole !== undefined ? { globalRole: input.globalRole } : {}),
      },
      select: USER_FIELDS,
    });

    // Désactivation : les sessions ouvertes doivent tomber immédiatement.
    if (input.isActive === false) await this.tokens.revokeAllSessions(userId);

    return toUserSummary(user);
  }

  /** Mise à jour par l'utilisateur lui-même — ne touche ni au rôle ni au statut. */
  async updateOwnProfile(userId: string, input: UpdateProfileInput): Promise<UserSummary> {
    return this.update(userId, input);
  }

  /**
   * Suppression logique : l'utilisateur reste référencé par les tickets qu'il a
   * créés et l'historique des modifications, qui perdraient leur sens sans lui.
   */
  async softDelete(userId: string, actorId: string): Promise<void> {
    if (userId === actorId) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_SELF',
        message: 'Vous ne pouvez pas supprimer votre propre compte',
      });
    }

    await this.assertExists(userId);
    await this.assertNotLastAdmin(userId);

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

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    await this.assertExists(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(newPassword, PASSWORD_SALT_ROUNDS) },
    });
    await this.tokens.revokeAllSessions(userId);
  }

  private async assertExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: "Cet utilisateur n'existe pas" });
  }

  /** Garde-fou : la plateforme doit conserver au moins un administrateur. */
  private async assertNotLastAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true },
    });
    if (user?.globalRole !== GlobalRole.ADMIN) return;

    const remainingAdmins = await this.prisma.user.count({
      where: { globalRole: GlobalRole.ADMIN, deletedAt: null, id: { not: userId } },
    });
    if (remainingAdmins === 0) {
      throw new BadRequestException({
        code: 'LAST_ADMIN',
        message: 'La plateforme doit conserver au moins un administrateur',
      });
    }
  }
}

function toUserSummary(user: UserRow): UserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    jobTitle: user.jobTitle,
    avatarUrl: user.avatarUrl,
    globalRole: user.globalRole as GlobalRole,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
