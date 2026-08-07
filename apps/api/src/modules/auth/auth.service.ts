import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { ChangePasswordInput, SessionResponse } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toAuthenticatedUser } from './auth-user.mapper';
import { IDENTITY_PROVIDERS, IdentityProvider } from './identity/identity-provider';
import { SessionContext, TokenService } from './token.service';

const INVALID_CREDENTIALS = {
  code: 'INVALID_CREDENTIALS',
  message: 'Email ou mot de passe incorrect',
};

export const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly providers: Map<string, IdentityProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    @Inject(IDENTITY_PROVIDERS) providers: IdentityProvider[],
  ) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
  }

  async login(
    credentials: Record<string, unknown>,
    ctx: SessionContext,
    providerId = 'local',
  ): Promise<{ session: SessionResponse; refreshToken: string; refreshExpiresAt: Date }> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new BadRequestException({ code: 'UNKNOWN_IDENTITY_PROVIDER', message: 'Fournisseur inconnu' });

    const identity = await provider.authenticate(credentials);
    if (!identity) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const user = await this.prisma.user.findUnique({ where: { email: identity.email } });
    if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException(INVALID_CREDENTIALS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const refresh = await this.tokens.issueRefreshToken(user.id, ctx);

    return {
      session: {
        accessToken: this.tokens.signAccessToken({ sub: user.id, email: user.email }),
        expiresIn: this.tokens.accessTtlSeconds,
        user: toAuthenticatedUser(user),
      },
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  async refresh(
    rawToken: string | undefined,
    ctx: SessionContext,
  ): Promise<{ session: SessionResponse; refreshToken: string; refreshExpiresAt: Date }> {
    if (!rawToken) {
      throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN', message: 'Aucune session à renouveler' });
    }

    const { userId, refresh } = await this.tokens.rotateRefreshToken(rawToken, ctx);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt) {
      // Compte désactivé entre-temps : on coupe toutes ses sessions.
      await this.tokens.revokeAllSessions(userId);
      throw new UnauthorizedException({ code: 'ACCOUNT_DISABLED', message: 'Ce compte est désactivé' });
    }

    return {
      session: {
        accessToken: this.tokens.signAccessToken({ sub: user.id, email: user.email }),
        expiresIn: this.tokens.accessTtlSeconds,
        user: toAuthenticatedUser(user),
      },
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.tokens.revokeRefreshToken(rawToken);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const matches = await compare(input.currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException({
        code: 'WRONG_CURRENT_PASSWORD',
        message: 'Le mot de passe actuel est incorrect',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(input.newPassword, PASSWORD_SALT_ROUNDS) },
    });

    // Les autres appareils doivent se reconnecter avec le nouveau mot de passe.
    await this.tokens.revokeAllSessions(userId);
  }
}
