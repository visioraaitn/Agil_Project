import type { ApiErrorBody } from '@visiora/shared';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
const AJAX_HEADER = { 'X-Requested-With': 'VisioraAI' } as const;
export const SESSION_EXPIRED_EVENT = 'visiora:session-expired';

/** Erreur typée exposant le corps normalisé renvoyé par l'API. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /**
     * Erreurs de validation Zod (`string[]` par champ) ou charge structurée
     * propre à un code applicatif (ex. `conflicts` pour
     * SPRINT_PROPAGATION_CONFIRMATION_REQUIRED) — voir ApiErrorBody.
     */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Erreurs de validation prêtes à être posées sur un formulaire. */
  get fieldErrors(): Record<string, string> {
    if (!this.details) return {};
    return Object.fromEntries(
      Object.entries(this.details)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
        .map(([field, messages]) => [field, messages[0] ?? '']),
    );
  }
}

/**
 * Le token d'accès reste en mémoire (jamais en localStorage : il serait lisible
 * par n'importe quel script injecté). Le refresh token est un cookie httpOnly
 * posé par l'API — c'est lui qui permet de restaurer la session au rechargement.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Interne : empêche une boucle de rafraîchissement infinie. */
  skipRefresh?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: AJAX_HEADER,
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, skipRefresh, headers, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const method = (rest.method ?? 'GET').toUpperCase();
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(isMutation ? AJAX_HEADER : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

  // Token expiré : on rafraîchit une fois puis on rejoue la requête.
  if (response.status === 401 && !skipRefresh) {
    const hadAuthenticatedSession = accessToken !== null;
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch<T>(path, { ...options, skipRefresh: true });
    if (hadAuthenticatedSession) {
      setAccessToken(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      response.status,
      error.code ?? 'UNKNOWN',
      error.message ?? 'Une erreur est survenue',
      error.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE', body }),
};
