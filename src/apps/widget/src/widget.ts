import { styles } from './styles'

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

export class TagrendeQuoteWidget {
  private readonly root: ShadowRoot
  private readonly apiBaseUrl: string
  private selectedAddress: AddressSuggestion | null = null
  private estimate: InstantEstimate | null = null

  constructor(private readonly options: WidgetOptions) {
    this.apiBaseUrl = options.apiBaseUrl ?? 'http://localhost:4010'
    this.root = options.target.attachShadow({ mode: 'open' })
    this.render()
  }

  private render() {
    this.root.innerHTML = `
      <style>${styles}</style>
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

    this.addressInput.addEventListener('input', () => this.handleAddressInput())
    this.quoteButton.addEventListener('click', () => this.requestQuote())
  }

  private async handleAddressInput() {
    const query = this.addressInput.value.trim()
    this.selectedAddress = null
    this.estimate = null
    this.quoteButton.disabled = true
    this.estimateContainer.innerHTML = ''
    this.contactContainer.hidden = true

    if (query.length < 3) {
      this.suggestionsContainer.innerHTML = ''
      return
    }

    try {
      const suggestions = await this.getJson<AddressSuggestion[]>(`/api/addresses?q=${encodeURIComponent(query)}`)
      this.suggestionsContainer.innerHTML = suggestions
        .slice(0, 5)
        .map((suggestion, index) => `<button class="suggestion" data-index="${index}" type="button">${escapeHtml(suggestion.label)}</button>`)
        .join('')

      this.suggestionsContainer.querySelectorAll<HTMLButtonElement>('.suggestion').forEach(button => {
        button.addEventListener('click', () => {
          const suggestion = suggestions[Number(button.dataset.index)]
          void this.selectAddress(suggestion)
        })
      })
    } catch (error) {
      this.setStatus(formatAddressError(error), true)
    }
  }

  private async selectAddress(address: AddressSuggestion) {
    this.selectedAddress = address
    this.addressInput.value = address.label
    this.suggestionsContainer.innerHTML = ''
    this.setStatus('Beregner hurtigt estimat...')

    try {
      this.estimate = await this.postJson<InstantEstimate>('/api/estimates/instant', { address })
      this.renderEstimate(this.estimate)
      this.contactContainer.hidden = false
      this.quoteButton.disabled = false
      this.setStatus('')
    } catch (error) {
      this.setStatus(formatEstimateError(error), true)
    }
  }

  private renderEstimate(estimate: InstantEstimate) {
    const formatter = new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: estimate.price.currency,
      maximumFractionDigits: 0,
    })

    this.estimateContainer.innerHTML = `
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

    this.quoteButton.disabled = true
    this.setStatus('Sender til verifikation...')

    try {
      const response = await this.postJson<QuoteRequest>('/api/quotes/request', {
        address: this.selectedAddress,
        estimateId: this.estimate.estimateId,
        customer: {
          name: this.nameInput.value.trim(),
          phone: this.phoneInput.value.trim(),
        },
      })

      this.setStatus(`Tak. Tilbuddet er sendt til kontrol. Reference: ${response.quoteId}`)
    } catch (error) {
      this.quoteButton.disabled = false
      this.setStatus(formatQuoteError(error), true)
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

  private setStatus(text: string, error = false) {
    this.statusContainer.innerHTML = text ? `<div class="status ${error ? 'error' : ''}">${escapeHtml(text)}</div>` : ''
  }

  private get addressInput() {
    return this.root.querySelector<HTMLInputElement>('#address')!
  }

  private get nameInput() {
    return this.root.querySelector<HTMLInputElement>('#name')!
  }

  private get phoneInput() {
    return this.root.querySelector<HTMLInputElement>('#phone')!
  }

  private get quoteButton() {
    return this.root.querySelector<HTMLButtonElement>('#quote')!
  }

  private get suggestionsContainer() {
    return this.root.querySelector<HTMLDivElement>('#suggestions')!
  }

  private get estimateContainer() {
    return this.root.querySelector<HTMLDivElement>('#estimate')!
  }

  private get contactContainer() {
    return this.root.querySelector<HTMLDivElement>('#contact')!
  }

  private get statusContainer() {
    return this.root.querySelector<HTMLDivElement>('#status')!
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

function formatAddressError(error: unknown): string {
  const apiError = asApiError(error)
  if (!apiError) return 'Kunne ikke hente adresser. Tjek at gatewayen kører.'
  return `Kunne ikke hente adresser (${apiError.status}): ${apiError.message}`
}

function formatEstimateError(error: unknown): string {
  const apiError = asApiError(error)
  if (!apiError) return 'Kunne ikke kontakte gatewayen. Tjek at http://localhost:4010 kører.'

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

function formatQuoteError(error: unknown): string {
  const apiError = asApiError(error)
  if (!apiError) return 'Kunne ikke kontakte gatewayen. Tjek at http://localhost:4010 kører.'
  return `Kunne ikke sende forespørgslen (${apiError.status}): ${apiError.message}`
}

function asApiError(error: unknown): ApiClientError | null {
  return error instanceof ApiClientError ? error : null
}
