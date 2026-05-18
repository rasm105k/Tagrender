import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { DawaService } from '../services/dawa.js'

const querySchema = z.object({
  q: z.string().default(''),
})

export async function registerAddressRoutes(app: FastifyInstance) {
  const dawa = new DawaService()

  app.get('/api/addresses', async request => {
    const query = querySchema.parse(request.query)
    return dawa.autocomplete(query.q)
  })
}
