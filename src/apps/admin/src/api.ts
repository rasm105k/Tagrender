import type { QuoteRecord } from './types'

const baseUrl = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4010'

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
