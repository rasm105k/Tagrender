type WidgetOptions = {
  target: Element
  apiBaseUrl?: string
  tenantKey?: string
}

type AddressSuggestion = {
  id: string
  label: string
  roadName?: string
  houseNumber?: string
  postalCode?: string
  city?: string
  municipalityCode?: string
  propertyNumber?: string
  accessAddressId?: string
  coordinate?: {
    lat: number
    lon: number
  }
}

type InstantEstimate = {
  estimateId: string
  address: AddressSuggestion
  price: {
    min: number
    max: number
    currency: string
  }
  facts: {
    buildingAreaM2: number
    floors: number
    estimatedGutterMeters: number
  }
  confidence: number
  riskFlags: string[]
}

type QuoteRequest = {
  quoteId: string
  status: string
}

type ApiErrorPayload = {
  code?: string
  message?: string
  detail?: string
}

class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

const STYLES = `
  :host {
    all: initial;
    color: #111827;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  * {
    box-sizing: border-box;
    font-family: inherit;
  }

  .card {
    width: min(100%, 440px);
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 10px 30px rgba(17, 24, 39, 0.08);
    overflow: hidden;
  }

  .header {
    padding: 18px 18px 14px;
    border-bottom: 1px solid #f3f4f6;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .subtitle {
    margin: 6px 0 0;
    color: #6b7280;
    font-size: 13px;
    line-height: 1.45;
  }

  .body {
    padding: 16px 18px 18px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    color: #4b5563;
    font-size: 12px;
    font-weight: 650;
  }

  input {
    width: 100%;
    min-height: 40px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px 10px;
    color: #111827;
    font-size: 14px;
    outline: none;
  }

  input:focus {
    border-color: #111827;
    box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
  }

  button {
    min-height: 40px;
    border: 0;
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .stack {
    display: grid;
    gap: 12px;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .row > * {
    flex: 1;
  }

  .suggestions {
    display: grid;
    gap: 6px;
    margin-top: 8px;
  }

  .suggestion {
    width: 100%;
    min-height: 34px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #111827;
    text-align: left;
    font-weight: 550;
  }

  .estimate {
    display: grid;
    gap: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
    padding: 12px;
  }

  .price {
    font-size: 28px;
    font-weight: 800;
  }

  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    color: #6b7280;
    font-size: 12px;
  }

  .status {
    border-radius: 6px;
    background: #f3f4f6;
    padding: 8px 10px;
    color: #374151;
    font-size: 13px;
  }

  .error {
    background: #fef2f2;
    color: #991b1b;
  }
`

export class TagrendeQuoteWidget {
  private readonly root: ShadowRoot
  private readonly apiBaseUrl: string
  private selectedAddress: AddressSuggestion | null = null
  private estimate: InstantEstimate | null = null

  constructor(private readonly options: WidgetOptions) {
    this.apiBaseUrl = options.apiBaseUrl ?? 'http://localhost:3000'
    this.root = options.target.attachShadow({ mode: 'open' })
    this.render()
  }

  private render() {
    this.root.innerHTML = `
      <style>${STYLES}</style>
      <section class="card">
        <div class="header">
          <h2>Få pris på tagrenderens</h2>
          <p class="subtitle">Indtast adresse og få et hurtigt estimat. Fast tilbud verificeres med luftfoto.</p>
        </div>
        <div class="body">
          <div class="stack">
            <div>
              <label for="address">Adresse</label>
              <input id="address" autocomplete="off" placeholder="Start med vejnavn og nummer" />
              <div id="suggestions" class="suggestions"></div>
            </div>
            <div id="estimate"></div>
            <div id="contact" hidden>
              <div class="row">
                <div>
                  <label for="name">Navn</label>
                  <input id="name" placeholder="Dit navn" />
                </div>
                <div>
                  <label for="phone">Telefon</label>
                  <input id="phone" placeholder="+45" />
                </div>
              </div>
            </div>
            <button id="quote" disabled>Få fast tilbud</button>
            <div id="status"></div>
          </div>
        </div>
      </section>
    `

    this.el('#address').addEventListener('input', () => this.handleAddressInput())
    this.el('#quote').addEventListener('click', () => this.requestQuote())
  }

  private async handleAddressInput() {
    const query = this.el('#address', HTMLInputElement).value.trim()
    this.selectedAddress = null
    this.estimate = null
    this.el('#quote', HTMLButtonElement).disabled = true
    this.el('#estimate', HTMLDivElement).innerHTML = ''
    this.el('#contact', HTMLDivElement).hidden = true

    if (query.length < 3) {
      this.el('#suggestions', HTMLDivElement).innerHTML = ''
      return
    }

    try {
      const suggestions = await this.getJson<AddressSuggestion[]>(`/api/addresses?q=${encodeURIComponent(query)}`)
      this.el('#suggestions', HTMLDivElement).innerHTML = suggestions
        .slice(0, 5)
        .map((suggestion, index) => `<button class="suggestion" data-index="${index}" type="button">${escapeHtml(suggestion.label)}</button>`)
        .join('')

      this.el('#suggestions', HTMLDivElement).querySelectorAll<HTMLButtonElement>('.suggestion').forEach(button => {
        button.addEventListener('click', () => {
          const suggestion = suggestions[Number(button.dataset.index)]
          void this.selectAddress(suggestion)
        })
      })
    } catch (error) {
      this.setStatus(formatError(error, 'address'), true)
    }
  }

  private async selectAddress(address: AddressSuggestion) {
    this.selectedAddress = address
    this.el('#address', HTMLInputElement).value = address.label
    this.el('#suggestions', HTMLDivElement).innerHTML = ''
    this.setStatus('Beregner hurtigt estimat...')

    try {
      this.estimate = await this.postJson<InstantEstimate>('/api/estimates/instant', { address })
      this.renderEstimate(this.estimate)
      this.el('#contact', HTMLDivElement).hidden = false
      this.el('#quote', HTMLButtonElement).disabled = false
      this.setStatus('')
    } catch (error) {
      this.setStatus(formatError(error, 'estimate'), true)
    }
  }

  private renderEstimate(estimate: InstantEstimate) {
    const formatter = new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: estimate.price.currency,
      maximumFractionDigits: 0,
    })

    this.el('#estimate', HTMLDivElement).innerHTML = `
      <div class="estimate">
        <div class="price">${formatter.format(estimate.price.min)} - ${formatter.format(estimate.price.max)}</div>
        <div class="meta">
          <span>${estimate.facts.estimatedGutterMeters} m tagrende</span>
          <span>${estimate.facts.floors} etage${estimate.facts.floors === 1 ? '' : 'r'}</span>
          <span>${estimate.facts.buildingAreaM2} m2 bygning</span>
          <span>${Math.round(estimate.confidence * 100)}% sikkerhed</span>
        </div>
      </div>
    `
  }

  private async requestQuote() {
    if (!this.selectedAddress || !this.estimate) return

    this.el('#quote', HTMLButtonElement).disabled = true
    this.setStatus('Sender til verifikation...')

    try {
      const response = await this.postJson<QuoteRequest>('/api/quotes/request', {
        address: this.selectedAddress,
        estimateId: this.estimate.estimateId,
        customer: {
          name: this.el('#name', HTMLInputElement).value.trim(),
          phone: this.el('#phone', HTMLInputElement).value.trim(),
        },
      })

      this.setStatus(`Tak. Tilbuddet er sendt til kontrol. Reference: ${response.quoteId}`)
    } catch (error) {
      this.el('#quote', HTMLButtonElement).disabled = false
      this.setStatus(formatError(error, 'quote'), true)
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      headers: this.headers,
    })
    if (!response.ok) throw await buildApiError(response)
    return response.json() as Promise<T>
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw await buildApiError(response)
    return response.json() as Promise<T>
  }

  private get headers(): Record<string, string> {
    return this.options.tenantKey ? { 'x-tenant-key': this.options.tenantKey } : {}
  }

  private el<T extends Element = Element>(selector: string, ctor?: new () => T): T {
    return this.root.querySelector(selector) as T
  }

  private setStatus(text: string, error = false) {
    this.el('#status', HTMLDivElement).innerHTML = text ? `<div class="status ${error ? 'error' : ''}">${escapeHtml(text)}</div>` : ''
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function buildApiError(response: Response): Promise<ApiClientError> {
  const payload = await readErrorPayload(response)
  const message = payload?.message ?? payload?.detail ?? `HTTP ${response.status}`
  return new ApiClientError(message, response.status, payload?.code)
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null

  try {
    return await response.json() as ApiErrorPayload
  } catch {
    return null
  }
}

function formatError(error: unknown, context: 'address' | 'estimate' | 'quote'): string {
  const apiError = asApiError(error)
  
  if (!apiError) {
    const url = context === 'estimate' || context === 'quote' ? 'http://localhost:4010' : ''
    return url
      ? `Kunne ikke kontakte gatewayen. Tjek at ${url} kører.`
      : 'Kunne ikke hente adresser. Tjek at gatewayen kører.'
  }

  if (context === 'estimate') {
    if (apiError.code === 'bbr_configuration_error') {
      return `BBR mangler opsætning (${apiError.status}): ${apiError.message}`
    }
    if (apiError.code === 'bbr_lookup_error') {
      return `BBR-opslag fejlede (${apiError.status}): ${apiError.message}`
    }
    if (apiError.code === 'validation_error') {
      return `Adressedata er ikke komplette (${apiError.status}): vælg en adresse fra listen igen.`
    }
    return `Kunne ikke beregne estimat (${apiError.status}): ${apiError.message}`
  }

  if (context === 'quote') {
    return `Kunne ikke sende forespørgslen (${apiError.status}): ${apiError.message}`
  }

  return `Kunne ikke hente adresser (${apiError.status}): ${apiError.message}`
}

function asApiError(error: unknown): ApiClientError | null {
  return error instanceof ApiClientError ? error : null
}
