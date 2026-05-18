import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { addressSchema } from './estimates.js'
import { BbrService } from '../services/bbr.js'
import { calculateInstantEstimate } from '../services/pricing.js'
import { QuoteQueue } from '../services/queue.js'
import { QuoteRepository } from '../services/quotes.js'

const requestQuoteSchema = z.object({
  address: addressSchema,
  estimateId: z.string().optional(),
  customer: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }).default({}),
})

const verifiedQuoteSchema = z.object({
  gutterMeters: z.number().int().positive(),
  treeRisk: z.enum(['low', 'medium', 'high']),
  roofPolygon: z.array(z.object({
    lat: z.number(),
    lon: z.number(),
  })).min(3),
  priceDkk: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  imagery: z.record(z.string(), z.unknown()).optional(),
  notes: z.array(z.string()).default([]),
})

export async function registerQuoteRoutes(app: FastifyInstance, repository: QuoteRepository) {
  const bbr = new BbrService()
  const queue = new QuoteQueue()

  app.get('/api/quotes', async () => repository.list())

  app.get('/api/quotes/:quoteId', async (request, reply) => {
    const params = z.object({ quoteId: z.string() }).parse(request.params)
    const quote = repository.get(params.quoteId)
    if (!quote) {
      return reply.code(404).send({ message: 'Quote was not found.' })
    }

    return quote
  })

  app.post('/api/quotes/request', async (request, reply) => {
    const body = requestQuoteSchema.parse(request.body)
    const facts = await bbr.getBuildingFacts(body.address)
    const estimate = calculateInstantEstimate(body.address, facts)
    const quote = repository.create({
      address: body.address,
      estimate: body.estimateId ? { ...estimate, estimateId: body.estimateId } : estimate,
      customer: body.customer,
    })

    const queueStatus = await queue.enqueue(quote)
    if (queueStatus === 'failed') {
      repository.updateStatus(quote.quoteId, 'failed')
    }

    return reply.code(202).send({
      quoteId: quote.quoteId,
      status: queueStatus === 'failed' ? 'failed' : quote.status,
      queue: queueStatus,
    })
  })

  app.post('/internal/quotes/:quoteId/verification', async (request, reply) => {
    const params = z.object({ quoteId: z.string() }).parse(request.params)
    const verified = verifiedQuoteSchema.parse(request.body)
    const quote = repository.updateVerified(params.quoteId, verified)
    if (!quote) {
      return reply.code(404).send({ message: 'Quote was not found.' })
    }

    return quote
  })
}
