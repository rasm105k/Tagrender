import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { env } from '../config/env.js'
import type { QuoteRecord } from '../types.js'

export class QuoteQueue {
  private readonly queue?: Queue

  constructor() {
    if (!env.REDIS_URL) return

    const connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    this.queue = new Queue('quote-verification', { connection })
  }

  async enqueue(quote: QuoteRecord): Promise<'queued' | 'disabled' | 'failed'> {
    if (!this.queue) return 'disabled'

    try {
      await this.queue.add('verify-quote', {
        quoteId: quote.quoteId,
        address: quote.address,
        estimate: quote.estimate,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      })
      return 'queued'
    } catch {
      return 'failed'
    }
  }
}
