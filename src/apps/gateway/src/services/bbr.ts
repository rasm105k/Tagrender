import { env } from '../config/env.js'
import type { AddressSuggestion, BuildingFacts } from '../types.js'

type BbrGraphQlBuilding = {
  id_lokalId?: string
  husnummer?: string | null
  byg007Bygningsnummer?: number | string | null
  byg021BygningensAnvendelse?: number | string | null
  byg026Opfoerelsesaar?: number | string | null
  byg038SamletBygningsareal?: number | string | null
  byg041BebyggetAreal?: number | string | null
  byg054AntalEtager?: number | string | null
}

type BbrGraphQlResponse = {
  data?: {
    BBR_Bygning?: {
      nodes?: BbrGraphQlBuilding[]
    }
  }
  errors?: Array<{ message?: string }>
}

const dawaIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export class BbrService {
  async getBuildingFacts(address: AddressSuggestion): Promise<BuildingFacts> {
    if (!env.DATAFORDELEREN_API_KEY) {
      throw new BbrConfigurationError('Datafordeler API-nøgle mangler. Sæt DATAFORDELEREN_API_KEY i .env og genstart løsningen.')
    }

    const accessAddressId = address.accessAddressId
    if (!accessAddressId || !dawaIdPattern.test(accessAddressId)) {
      throw new BbrConfigurationError('Adressen mangler et gyldigt DAWA adgangsadresseid. Vælg en adresse fra listen igen.')
    }

    const response = await fetch(buildGraphQlUrl(), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: buildHusnummerQuery(accessAddressId, new Date()),
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new BbrLookupError(`Datafordeler BBR GraphQL returnerede HTTP ${response.status}: ${body.slice(0, 300)}`)
    }

    const payload = await response.json() as BbrGraphQlResponse
    if (payload.errors?.length) {
      throw new BbrLookupError(`Datafordeler afviste BBR-forespørgslen: ${payload.errors.map(error => error.message).join('; ')}`)
    }

    const buildings = payload.data?.BBR_Bygning?.nodes ?? []
    const primary = selectPrimaryBuilding(buildings)
    if (!primary) {
      throw new BbrLookupError('BBR fandt ingen bygning med bebygget areal på den valgte adresse.')
    }

    return {
      buildingAreaM2: numberValue(primary.byg041BebyggetAreal) ?? numberValue(primary.byg038SamletBygningsareal) ?? 0,
      floors: Math.max(1, numberValue(primary.byg054AntalEtager) ?? 1),
      source: 'datafordeler',
      bbrBuildingId: primary.id_lokalId,
      buildingNumber: numberValue(primary.byg007Bygningsnummer),
      buildingUsage: primary.byg021BygningensAnvendelse?.toString(),
    }
  }
}

function buildGraphQlUrl(): string {
  const url = new URL(env.DATAFORDELEREN_BBR_GRAPHQL_URL)
  url.searchParams.set('apiKey', env.DATAFORDELEREN_API_KEY!)
  return url.toString()
}

function buildHusnummerQuery(accessAddressId: string, now: Date): string {
  const timestamp = now.toISOString()
  return `
    query BBR_Bygning {
      BBR_Bygning(
        first: 20
        registreringstid: "${timestamp}"
        virkningstid: "${timestamp}"
        where: { husnummer: { eq: "${accessAddressId}" } }
      ) {
        nodes {
          id_lokalId
          husnummer
          byg007Bygningsnummer
          byg021BygningensAnvendelse
          byg026Opfoerelsesaar
          byg038SamletBygningsareal
          byg041BebyggetAreal
          byg054AntalEtager
        }
      }
    }
  `
}

function selectPrimaryBuilding(buildings: BbrGraphQlBuilding[]): BbrGraphQlBuilding | undefined {
  return buildings
    .filter(building => (numberValue(building.byg041BebyggetAreal) ?? numberValue(building.byg038SamletBygningsareal) ?? 0) > 0)
    .sort((a, b) => {
      const areaA = numberValue(a.byg041BebyggetAreal) ?? numberValue(a.byg038SamletBygningsareal) ?? 0
      const areaB = numberValue(b.byg041BebyggetAreal) ?? numberValue(b.byg038SamletBygningsareal) ?? 0
      return areaB - areaA
    })[0]
}

function numberValue(value: number | string | null | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export class BbrConfigurationError extends Error {
  statusCode = 503
  code = 'bbr_configuration_error'
}

export class BbrLookupError extends Error {
  statusCode = 502
  code = 'bbr_lookup_error'
}
