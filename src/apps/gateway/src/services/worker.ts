import type { QuoteRecord } from '../types.js'

export class QuoteWorkerClient {
  private readonly baseUrl?: URL

  constructor(
    baseUrl?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl ? new URL(baseUrl) : undefined
  }

  get isEnabled(): boolean {
    return Boolean(this.baseUrl)
  }

  async verify(quote: QuoteRecord): Promise<NonNullable<QuoteRecord['verified']> | undefined> {
    if (!this.baseUrl) return undefined

    const url = new URL(`/internal/quotes/${quote.quoteId}/verify`, this.baseUrl)
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        quoteId: quote.quoteId,
        address: quote.address,
        estimate: quote.estimate,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new WorkerVerificationError(
        `Quote worker verification failed with HTTP ${response.status}: ${body.slice(0, 300)}`,
        response.status,
      )
    }

    return await response.json() as NonNullable<QuoteRecord['verified']>
  }
}

export class WorkerVerificationError extends Error {
  code = 'worker_verification_error'

  constructor(message: string, readonly statusCode: number) {
    super(message)
  }
}
