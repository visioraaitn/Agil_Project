import { z } from 'zod';

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
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET : 32 caractères minimum'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET : 32 caractères minimum'),
    JWT_REFRESH_TTL: z.string().default('7d'),
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
    MAIL_FROM: z.string().default('VisioraAI Agile <no-reply@visiora.ai>'),

    REDIS_URL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
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
