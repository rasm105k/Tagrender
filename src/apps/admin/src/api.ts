import type { QuoteRecord } from './types'

const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3000` : 'http://localhost:3000'

export async function listQuotes(): Promise<QuoteRecord[]> {
  const response = await fetch(`${baseUrl}/api/quotes`)
  if (!response.ok) throw new Error('Kunne ikke hente tilbud.')
  return response.json()
}

export async function getQuote(quoteId: string): Promise<QuoteRecord> {
  const response = await fetch(`${baseUrl}/api/quotes/${quoteId}`)
  if (!response.ok) throw new Error('Kunne ikke hente tilbuddet.')
  return response.json()
}

export function getGatewayUrl(): string {
  return baseUrl
}
