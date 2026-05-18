export type Coordinate = {
  lat: number
  lon: number
}

export type AddressSuggestion = {
  id: string
  label: string
  municipalityCode?: string
  propertyNumber?: string
  accessAddressId?: string
  coordinate?: Coordinate
}

export type QuoteStatus = 'queued' | 'processing' | 'needs_review' | 'verified' | 'sent' | 'failed'

export type QuoteRecord = {
  quoteId: string
  status: QuoteStatus
  address: AddressSuggestion
  estimate: {
    price: {
      min: number
      max: number
      currency: 'DKK'
    }
    facts: {
      buildingAreaM2: number
      floors: number
      estimatedGutterMeters: number
      source: 'datafordeler'
      bbrBuildingId?: string
      buildingNumber?: number
      buildingUsage?: string
    }
    confidence: number
    riskFlags: string[]
  }
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
    confidence?: number
    imagery?: Record<string, unknown>
    notes: string[]
  }
  createdAt: string
  updatedAt: string
}
