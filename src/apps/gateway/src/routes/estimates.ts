import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BbrService } from '../services/bbr.js'
import { calculateInstantEstimate } from '../services/pricing.js'

const coordinateSchema = z.object({
  lat: z.number(),
  lon: z.number(),
})

export const addressSchema = z.object({
  id: z.string(),
  label: z.string(),
  roadName: z.string().optional(),
  houseNumber: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  municipalityCode: z.string().optional(),
  propertyNumber: z.string().optional(),
  accessAddressId: z.string().optional(),
  coordinate: coordinateSchema.optional(),
})

const instantEstimateSchema = z.object({
  address: addressSchema,
})

export async function registerEstimateRoutes(app: FastifyInstance) {
  const bbr = new BbrService()

  app.post('/api/estimates/instant', async request => {
    const body = instantEstimateSchema.parse(request.body)
    const facts = await bbr.getBuildingFacts(body.address)
    return calculateInstantEstimate(body.address, facts)
  })
}
