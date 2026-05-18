import { randomUUID } from 'node:crypto'
import type { AddressSuggestion, InstantEstimate, QuoteRecord, QuoteStatus } from '../types.js'

export class QuoteRepository {
  private readonly quotes = new Map<string, QuoteRecord>()

  create(input: {
    address: AddressSuggestion
    estimate: InstantEstimate
    customer: QuoteRecord['customer']
  }): QuoteRecord {
    const now = new Date().toISOString()
    const quote: QuoteRecord = {
      quoteId: randomUUID(),
      status: 'queued',
      address: input.address,
      estimate: input.estimate,
      customer: input.customer,
      createdAt: now,
      updatedAt: now,
    }

    this.quotes.set(quote.quoteId, quote)
    return quote
  }

  list(): QuoteRecord[] {
    return [...this.quotes.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  get(quoteId: string): QuoteRecord | undefined {
    return this.quotes.get(quoteId)
  }

  updateStatus(quoteId: string, status: QuoteStatus): QuoteRecord | undefined {
    const quote = this.quotes.get(quoteId)
    if (!quote) return undefined

    const updated = {
      ...quote,
      status,
      updatedAt: new Date().toISOString(),
    }
    this.quotes.set(quoteId, updated)
    return updated
  }

  updateVerified(quoteId: string, verified: NonNullable<QuoteRecord['verified']>): QuoteRecord | undefined {
    const quote = this.quotes.get(quoteId)
    if (!quote) return undefined

    const status: QuoteStatus = verified.confidence < 0.82 ? 'needs_review' : 'verified'
    const updated = {
      ...quote,
      status,
      verified,
      updatedAt: new Date().toISOString(),
    }
    this.quotes.set(quoteId, updated)
    return updated
  }
}
