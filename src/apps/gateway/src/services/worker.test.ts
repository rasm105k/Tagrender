import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { QuoteWorkerClient, WorkerVerificationError } from './worker.js'
import type { QuoteRecord } from '../types.js'

const quote: QuoteRecord = {
  quoteId: 'quote-123',
  status: 'queued',
  address: {
    id: 'address-1',
    label: 'Testvej 1, 1000 København K',
    coordinate: { lat: 55.68, lon: 12.57 },
  },
  estimate: {
    estimateId: 'estimate-123',
    address: {
      id: 'address-1',
      label: 'Testvej 1, 1000 København K',
      coordinate: { lat: 55.68, lon: 12.57 },
    },
    price: { min: 1800, max: 2300, currency: 'DKK' },
    facts: {
      buildingAreaM2: 120,
      floors: 1,
      source: 'datafordeler',
      estimatedGutterMeters: 48,
    },
    confidence: 0.82,
    riskFlags: [],
  },
  customer: {},
  createdAt: '2026-05-18T10:00:00.000Z',
  updatedAt: '2026-05-18T10:00:00.000Z',
}

describe('QuoteWorkerClient', () => {
  it('is disabled when no base URL is configured', async () => {
    const client = new QuoteWorkerClient(undefined, async () => {
      throw new Error('fetch should not be called')
    })

    assert.equal(client.isEnabled, false)
    assert.equal(await client.verify(quote), undefined)
  })

  it('posts quote payload to worker verification endpoint', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const client = new QuoteWorkerClient('http://worker.test/', async (url, init) => {
      calls.push({ url: url.toString(), init: init! })
      return new Response(JSON.stringify({
        quoteId: 'quote-123',
        gutterMeters: 52,
        treeRisk: 'medium',
        roofPolygon: [
          { lat: 55.68, lon: 12.57 },
          { lat: 55.681, lon: 12.57 },
          { lat: 55.681, lon: 12.571 },
        ],
        priceDkk: 3100,
        confidence: 0.87,
        imagery: { segmentationMethod: 'opencv_edge_color_segmentation' },
        notes: ['Modelpris beregnet.'],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const verified = await client.verify(quote)

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'http://worker.test/internal/quotes/quote-123/verify')
    assert.equal(calls[0].init.method, 'POST')
    assert.deepEqual(JSON.parse(calls[0].init.body as string), {
      quoteId: quote.quoteId,
      address: quote.address,
      estimate: quote.estimate,
    })
    assert.equal(verified?.priceDkk, 3100)
    assert.equal(verified?.treeRisk, 'medium')
  })

  it('raises a typed error when worker rejects verification', async () => {
    const client = new QuoteWorkerClient('http://worker.test', async () => new Response('missing imagery', { status: 502 }))

    await assert.rejects(
      () => client.verify(quote),
      (error: unknown) => error instanceof WorkerVerificationError && error.statusCode === 502,
    )
  })
})
