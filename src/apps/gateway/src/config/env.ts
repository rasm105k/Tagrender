import { z } from 'zod'

const envSchema = z.object({
  GATEWAY_PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DATAFORDELEREN_API_KEY: z.string().optional(),
  DATAFORDELEREN_BBR_GRAPHQL_URL: z.string().url().default('https://graphql.datafordeler.dk/BBR/v1')
})

export const env = envSchema.parse(process.env)
