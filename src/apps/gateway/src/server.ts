import cors from '@fastify/cors'
import Fastify from 'fastify'
import { registerAddressRoutes } from './routes/addresses.js'
import { registerEstimateRoutes } from './routes/estimates.js'
import { registerQuoteRoutes } from './routes/quotes.js'
import { QuoteRepository } from './services/quotes.js'

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  await app.register(cors, {
    origin: true,
    allowedHeaders: ['content-type', 'x-tenant-key'],
  })

  const quotes = new QuoteRepository()

  app.get('/health', async () => ({ status: 'ok' }))
  await registerAddressRoutes(app)
  await registerEstimateRoutes(app)
  await registerQuoteRoutes(app, quotes)

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)
    if (error && typeof error === 'object' && 'issues' in error) {
      return reply.code(400).send({
        code: 'validation_error',
        message: 'Validation failed.',
        issues: error.issues,
      })
    }

    if (error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number') {
      const code = 'code' in error && typeof error.code === 'string' ? error.code : 'request_failed'
      return reply.code(error.statusCode).send({
        code,
        message: error instanceof Error ? error.message : 'Request failed.',
      })
    }

    return reply.code(500).send({
      code: 'internal_server_error',
      message: 'Internal server error.',
    })
  })

  return app
}
