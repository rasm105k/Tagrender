export type Coordinate = {
  lat: number
  lon: number
}

export type AddressSuggestion = {
  id: string
  label: string
  roadName?: string
  houseNumber?: string
  postalCode?: string
  city?: string
  municipalityCode?: string
  propertyNumber?: string
  accessAddressId?: string
  coordinate?: Coordinate
}

export type BuildingFacts = {
  buildingAreaM2: number
  floors: number
  source: 'datafordeler'
  bbrBuildingId?: string
  buildingNumber?: number
  buildingUsage?: string
}

export type InstantEstimate = {
  estimateId: string
  address: AddressSuggestion
  price: {
    min: number
    max: number
    currency: 'DKK'
  }
  facts: BuildingFacts & {
    estimatedGutterMeters: number
  }
  confidence: number
  riskFlags: string[]
}

export type QuoteStatus = 'queued' | 'processing' | 'needs_review' | 'verified' | 'sent' | 'failed'

export type QuoteRecord = {
  quoteId: string
  status: QuoteStatus
  address: AddressSuggestion
  estimate: InstantEstimate
  customer: {
    name?: string
    phone?: string
    email?: string
  }
  verified?: {
    gutterMeters: number
    treeRisk: 'low' | 'medium' | 'high'
    roofPolygon: Coordinate[]
    priceDkk: number
    confidence: number
    imagery?: Record<string, unknown>
    notes: string[]
  }
  createdAt: string
  updatedAt: string
}
