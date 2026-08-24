import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDurationSeconds, TokenService } from './token.service';

describe('parseDurationSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['2h', 7200],
    ['7d', 604800],
  ])('convertit %s en %i secondes', (input, expected) => {
    expect(parseDurationSeconds(input)).toBe(expected);
  });

  it('tolère les espaces', () => {
    expect(parseDurationSeconds(' 15m ')).toBe(900);
  });

  it.each(['', '0s', '15', 'm15', '15x', '-5m', '1.5h'])('rejette « %s »', (input) => {
    expect(() => parseDurationSeconds(input)).toThrow();
  });
});

describe('TokenService - expiration des sessions', () => {
  let service: TokenService;
  let prisma: {
    session: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      session: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'new-session' }),
      },
    };
    const config = {
      get: jest.fn((key: keyof Env) => {
        if (key === 'JWT_REFRESH_TTL') return '24h';
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret-at-least-32-characters';
        if (key === 'JWT_ACCESS_SECRET') return 'access-secret-at-least-32-characters';
        if (key === 'JWT_ACCESS_TTL') return '15m';
        return undefined;
      }),
    };
    service = new TokenService(
      {} as JwtService,
      config as unknown as ConfigService<Env, true>,
      prisma as unknown as PrismaService,
    );
  });

  it('rejette une session inactive depuis plus de 24 heures même si son ancienne échéance est future', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    });

    await expect(service.rotateRefreshToken('old-refresh')).rejects.toThrow(UnauthorizedException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('fait échouer une rotation concurrente déjà consommée', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: null,
    });
    prisma.session.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.rotateRefreshToken('replayed-refresh')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('conserve la date absolue de fin lors de la rotation', async () => {
    const absoluteExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date(),
      expiresAt: absoluteExpiresAt,
      revokedAt: null,
      userAgent: 'browser-a',
    });

    await service.rotateRefreshToken('refresh', { userAgent: 'browser-a' });

    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ expiresAt: absoluteExpiresAt }),
    });
  });

  it('révoque toutes les sessions si un refresh token consommé est rejoué', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: new Date(),
      userAgent: 'browser-a',
    });

    await expect(
      service.rotateRefreshToken('stolen-refresh', { userAgent: 'browser-a' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('refuse un refresh token présenté depuis un autre navigateur', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: null,
      userAgent: 'browser-a',
    });

    await expect(
      service.rotateRefreshToken('copied-refresh', { userAgent: 'browser-b' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('refuse une configuration de session supérieure à 24 heures', () => {
    const config = {
      get: jest.fn((key: keyof Env) => {
        if (key === 'JWT_REFRESH_TTL') return '7d';
        return 'secret-at-least-32-characters';
      }),
    };
    const configuredService = new TokenService(
      {} as JwtService,
      config as unknown as ConfigService<Env, true>,
      prisma as unknown as PrismaService,
    );

    expect(() => configuredService.refreshTtlSeconds).toThrow(
      'JWT_REFRESH_TTL ne peut pas dépasser 24 heures',
    );
  });
});
