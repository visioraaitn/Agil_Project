import { Injectable } from '@nestjs/common';
import { compare, hashSync } from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { IdentityProvider, VerifiedIdentity } from './identity-provider';

/**
 * Authentification locale : email + mot de passe stockés dans la plateforme.
 */
@Injectable()
export class LocalIdentityProvider implements IdentityProvider {
  readonly id = 'local';

  /**
   * Empreinte jetable comparée quand aucun compte ne correspond. Sans elle, une
   * réponse immédiate sur email inconnu contre ~100 ms sur email connu suffirait
   * à énumérer les comptes au chronomètre.
   */
  private static readonly DUMMY_HASH = hashSync('visiora-timing-equalizer', 10);

  constructor(private readonly prisma: PrismaService) {}

  async authenticate(credentials: Record<string, unknown>): Promise<VerifiedIdentity | null> {
    const email = typeof credentials.email === 'string' ? credentials.email.toLowerCase() : null;
    const password = typeof credentials.password === 'string' ? credentials.password : null;
    if (!email || !password) return null;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { email: true, passwordHash: true, isActive: true, deletedAt: true },
    });

    if (!user) {
      await compare(password, LocalIdentityProvider.DUMMY_HASH);
      return null;
    }

    const passwordMatches = await compare(password, user.passwordHash);
    if (!passwordMatches) return null;

    // Compte désactivé ou supprimé : même issue qu'un mot de passe faux.
    if (!user.isActive || user.deletedAt) return null;

    return { email: user.email };
  }
}
