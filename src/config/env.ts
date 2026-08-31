import {z} from 'zod';

const serverEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ORIGIN: z.url(),
    DATABASE_URL: z.url().startsWith('postgres'),
    AUTH_SECRET: z.string().min(32),
    SMS_PROVIDER: z.enum(['disabled']).default('disabled'),
    EMAIL_PROVIDER: z.enum(['disabled']).default('disabled'),
    OBJECT_STORAGE_PROVIDER: z.enum(['local', 'r2']).default('local'),
    SEARCH_PROVIDER: z.enum(['postgres', 'typesense']).default('postgres'),
    TYPESENSE_URL: z.url().optional(),
    TYPESENSE_API_KEY: z.string().min(16).optional()
  })
  .superRefine((environment, context) => {
    if (
      environment.SEARCH_PROVIDER === 'typesense' &&
      (!environment.TYPESENSE_URL || !environment.TYPESENSE_API_KEY)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Typesense URL and API key are required when SEARCH_PROVIDER=typesense'
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}
