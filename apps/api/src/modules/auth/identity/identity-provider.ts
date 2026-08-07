/**
 * Fournisseur d'identité.
 *
 * Un provider ne fait qu'une chose : transformer des informations d'entrée en
 * une identité vérifiée (une adresse email). Le rattachement au compte, les
 * rôles et les sessions restent la responsabilité de l'AuthService.
 *
 * L'ajout du SSO Microsoft Entra consistera à écrire un
 * `EntraIdentityProvider` (échange du code OIDC contre un jeton, lecture du
 * claim `email`) et à l'enregistrer dans `IDENTITY_PROVIDERS`. Rien d'autre
 * dans la chaîne d'authentification n'a à changer.
 */
export interface VerifiedIdentity {
  email: string;
  /** Renseigné par les providers externes pour provisionner un compte absent. */
  displayName?: string;
}

export interface IdentityProvider {
  /** Identifiant stable, exposé dans l'API : `local`, `entra`… */
  readonly id: string;

  /**
   * Vérifie les informations fournies.
   * Retourne `null` si elles sont invalides — jamais d'exception détaillée,
   * pour ne pas révéler si un compte existe.
   */
  authenticate(credentials: Record<string, unknown>): Promise<VerifiedIdentity | null>;
}

/** Jeton d'injection du tableau des providers actifs. */
export const IDENTITY_PROVIDERS = Symbol('IDENTITY_PROVIDERS');
