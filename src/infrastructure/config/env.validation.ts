import { z } from 'zod';

/**
 * Environment variables schema using Zod.
 *
 * This schema validates and transforms environment variables at startup,
 * ensuring all required values are present and correctly typed.
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(65535)),

  // MongoDB
  MONGO_URI: z.url({ message: 'MONGO_URI must be a valid URL' }),

  // ChromaDB
  CHROMA_HOST: z.url({ message: 'CHROMA_HOST must be a valid URL' }),

  // Redis
  REDIS_URL: z.url({ message: 'REDIS_URL must be a valid URL' }).default('redis://localhost:6379'),

  // Gemini AI (for conversational agent)
  GOOGLE_AI_API_KEY: z.string().nonempty('GOOGLE_AI_API_KEY is required'),

  // OpenAI (for embeddings)
  OPENAI_API_KEY: z.string().nonempty('OPENAI_API_KEY is required'),
});

/**
 * Inferred TypeScript type from the env schema.
 * Use this for type-safe access to environment variables.
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables using Zod schema.
 *
 * This function is used by NestJS ConfigModule.forRoot() to validate
 * and transform environment variables at application startup.
 *
 * @param config - Raw environment variables from process.env
 * @returns Validated and transformed configuration
 * @throws Error with detailed validation messages if validation fails
 */
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
