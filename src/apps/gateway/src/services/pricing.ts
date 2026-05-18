import { randomUUID } from 'node:crypto'
import type { AddressSuggestion, BuildingFacts, InstantEstimate } from '../types.js'

export function calculateInstantEstimate(address: AddressSuggestion, facts: BuildingFacts): InstantEstimate {
  const estimatedGutterMeters = Math.max(28, Math.round(Math.sqrt(facts.buildingAreaM2) * 4.4))
  const floorMultiplier = facts.floors > 1 ? 1.28 : 1
  const basePrice = 895
  const meterPrice = 34
  const midpoint = Math.round((basePrice + estimatedGutterMeters * meterPrice) * floorMultiplier)
  const confidence = 0.82
  const spread = 0.14

  return {
    estimateId: randomUUID(),
    address,
    price: {
      min: roundToNearest50(midpoint * (1 - spread)),
      max: roundToNearest50(midpoint * (1 + spread)),
      currency: 'DKK',
    },
    facts: {
      ...facts,
      estimatedGutterMeters,
    },
    confidence,
    riskFlags: [
      ...(facts.floors > 1 ? ['two_or_more_floors'] : []),
    ],
  }
}

function roundToNearest50(value: number): number {
  return Math.round(value / 50) * 50
}
