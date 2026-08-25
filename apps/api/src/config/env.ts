import { z } from 'zod';

const refreshTtlSchema = z
  .string()
  .regex(/^\d+\s*[smhd]$/, 'JWT_REFRESH_TTL : format attendu (ex. 24h)')
  .refine((value) => {
    const match = /^(\d+)\s*([smhd])$/.exec(value);
    if (!match) return false;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };
    const seconds = Number(match[1]) * (multipliers[match[2]] ?? Number.POSITIVE_INFINITY);
    return seconds > 0 && seconds <= 86_400;
  }, 'JWT_REFRESH_TTL doit être comprise entre 1 seconde et 24 heures');

/**
 * Configuration validée au démarrage : l'application refuse de démarrer si une
 * variable est absente ou mal formée, plutôt que d'échouer à la première requête.
 */
const booleanFromEnv = (defaultValue = false) =>
  z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0' || lower === '') return false;
    }
    if (typeof val === 'boolean') return val;
    return defaultValue;
  }, z.boolean());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().url(),

    API_PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.string().default('/api/v1'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    APP_URL: z.string().url().default('http://localhost:5173'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60_000),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    REFRESH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET : 32 caractères minimum'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET : 32 caractères minimum'),
    JWT_REFRESH_TTL: refreshTtlSchema.default('24h'),
    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).default('lax'),

    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY: z.string().min(1).optional(),
    S3_SECRET_KEY: z.string().min(1).optional(),
    MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: booleanFromEnv(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('visioPlanner <no-reply@visiora.ai>'),

    REDIS_URL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
    if (
      corsOrigins.some((origin) => {
        try {
          const parsed = new URL(origin);
          return !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin;
        } catch {
          return true;
        }
      })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'Utilisez uniquement des origines HTTP(S) exactes, sans chemin ni joker',
      });
    }

    const s3Keys = [
      'S3_ENDPOINT',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
    ] as const;
    const configuredKeys = s3Keys.filter((key) => Boolean(env[key]));
    const s3IsRequired = env.NODE_ENV === 'production' || configuredKeys.length > 0;

    if (s3IsRequired && configuredKeys.length !== s3Keys.length) {
      const missingKeys = s3Keys.filter((key) => !env[key]);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_ENDPOINT'],
        message: `Configuration S3 incomplète, variables manquantes : ${missingKeys.join(', ')}`,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  · ${issue.path.join('.')} : ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration invalide (.env) :\n${details}`);
  }

  return parsed.data;
}
