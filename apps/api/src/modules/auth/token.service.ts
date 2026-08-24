import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env';

export interface AccessTokenPayload {
  /** Identifiant de l'utilisateur — le token ne porte QUE l'identité. */
  sub: string;
  email: string;
  /** Identifiant unique de l'émission (ajouté à la signature). */
  jti?: string;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

/** Convertit « 15m », « 24h », « 3600s », « 2d » en secondes. */
export function parseDurationSeconds(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) throw new Error(`Durée invalide : "${duration}" (attendu : 15m, 2h, 24h…)`);

  const value = Number(match[1]);
  if (value <= 0) throw new Error(`Durée invalide : "${duration}" (la durée doit être positive)`);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[match[2] as string] as number);
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  get accessTtlSeconds(): number {
    return parseDurationSeconds(this.config.get('JWT_ACCESS_TTL', { infer: true }));
  }

  get refreshTtlSeconds(): number {
    const ttl = parseDurationSeconds(this.config.get('JWT_REFRESH_TTL', { infer: true }));
    if (ttl > 24 * 60 * 60) {
      throw new Error('JWT_REFRESH_TTL ne peut pas dépasser 24 heures');
    }
    return ttl;
  }

  /**
   * `jti` rend chaque émission unique. Sans lui, deux tokens signés dans la
   * même seconde pour le même utilisateur sont binairement identiques (`iat`
   * est en secondes) : impossible de les distinguer dans les journaux, et
   * aucune révocation ciblée envisageable.
   */
  signAccessToken(payload: AccessTokenPayload, expiresIn = this.accessTtlSeconds): string {
    return this.jwt.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn,
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Session expirée ou invalide',
      });
    }
  }

  /**
   * Le refresh token est une valeur aléatoire opaque, pas un JWT : il n'a rien
   * à transporter, et seul son empreinte HMAC est stockée. Une fuite de la base
   * ne permet donc pas de rejouer une session.
   */
  private hash(token: string): string {
    return createHmac('sha256', this.config.get('JWT_REFRESH_SECRET', { infer: true }))
      .update(token)
      .digest('hex');
  }

  async issueRefreshToken(
    userId: string,
    ctx: SessionContext = {},
    absoluteExpiresAt?: Date,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('hex');
    const configuredDeadline = new Date(Date.now() + this.refreshTtlSeconds * 1000);
    const expiresAt =
      absoluteExpiresAt && absoluteExpiresAt < configuredDeadline
        ? absoluteExpiresAt
        : configuredDeadline;

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: this.hash(token),
        userAgent: ctx.userAgent?.slice(0, 255) ?? null,
        ipAddress: ctx.ipAddress ?? null,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Rotation : l'ancien token est révoqué et un nouveau émis. Rejouer un token
   * déjà utilisé échoue, ce qui rend le vol détectable et sans valeur durable.
   */
  async rotateRefreshToken(
    rawToken: string,
    ctx: SessionContext = {},
  ): Promise<{ userId: string; refresh: IssuedRefreshToken }> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.hash(rawToken) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        userAgent: true,
      },
    });

    const now = new Date();
    if (session?.revokedAt) {
      // La réutilisation d'un refresh token déjà consommé indique une fuite
      // possible : toutes les sessions du compte sont invalidées.
      await this.revokeAllSessions(session.userId);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Compromission de session détectée, veuillez vous reconnecter',
      });
    }
    const idleDeadline = session
      ? new Date(session.createdAt.getTime() + this.refreshTtlSeconds * 1000)
      : null;
    const userAgentChanged =
      Boolean(session?.userAgent) &&
      Boolean(ctx.userAgent) &&
      session?.userAgent !== ctx.userAgent?.slice(0, 255);
    if (
      !session ||
      session.expiresAt < now ||
      !idleDeadline ||
      idleDeadline < now ||
      userAgentChanged
    ) {
      if (session && !session.revokedAt) {
        await this.prisma.session.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Session expirée, veuillez vous reconnecter',
      });
    }

    // updateMany rend la rotation atomique : deux refresh simultanés ne peuvent
    // jamais produire deux nouvelles sessions à partir du même token.
    const revoked = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (revoked.count !== 1) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Session expirée, veuillez vous reconnecter',
      });
    }

    const absoluteDeadline = new Date(
      Math.min(session.expiresAt.getTime(), idleDeadline.getTime()),
    );
    return {
      userId: session.userId,
      refresh: await this.issueRefreshToken(session.userId, ctx, absoluteDeadline),
    };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Déconnecte toutes les sessions — désactivation de compte, changement de mot de passe. */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Comparaison à durée constante, utilisée par les tests et les futurs providers. */
  static safeEquals(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return timingSafeEqual(bufferA, bufferB);
  }
}
