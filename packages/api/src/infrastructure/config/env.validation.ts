import { z } from 'zod';

const isTestMode = process.env.TEST_MODE === 'true';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(65535)),
  TEST_MODE: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .default(false),

  MONGO_URI: isTestMode
    ? z.string().optional().default('mongodb://localhost:27017/test-unused')
    : z.string().url({ message: 'MONGO_URI must be a valid URL' }),

  CHROMA_HOST: isTestMode
    ? z.string().optional().default('http://localhost:8000')
    : z.string().url({ message: 'CHROMA_HOST must be a valid URL' }),

  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid URL' }).default('redis://localhost:6379'),

  GOOGLE_AI_API_KEY: isTestMode
    ? z.string().optional().default('test-key-unused')
    : z.string().min(1, 'GOOGLE_AI_API_KEY is required'),

  OPENAI_API_KEY: isTestMode
    ? z.string().optional().default('test-key-unused')
    : z.string().nonempty('OPENAI_API_KEY is required'),

  OTEL_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Environment validation failed:\n${errors}\n\nPlease check your .env file or environment variables.`,
    );
  }

  return result.data;
}
