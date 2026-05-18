import { TagrendeQuoteWidget } from './widget'

type InitOptions = {
  target: string | Element
  apiBaseUrl?: string
  tenantKey?: string
}

const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

function resolveTarget(target: string | Element): Element {
  const resolved =
    typeof target === 'string'
      ? document.querySelector(target)
      : target

  if (!resolved) {
    throw new Error('TagrendeQuoteWidget target was not found.')
  }

  return resolved
}

function init(options: InitOptions) {
  const target = resolveTarget(options.target)

  if (target instanceof HTMLElement) {
    if (target.dataset.tagrendeQuoteMounted === 'true') {
      return null
    }

    target.dataset.tagrendeQuoteMounted = 'true'
  }

  return new TagrendeQuoteWidget({
    target,
    apiBaseUrl: options.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    tenantKey: options.tenantKey,
  })
}

function autoInit() {
  document.querySelectorAll<HTMLElement>('[data-tagrende-quote]').forEach(target => {
    init({
      target,
      apiBaseUrl: target.dataset.apiBaseUrl,
      tenantKey: target.dataset.tenantKey,
    })
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit)
} else {
  autoInit()
}

declare global {
  interface Window {
    TagrendeQuoteWidget?: {
      init: typeof init
    }
  }
}

window.TagrendeQuoteWidget = { init }

export { init, TagrendeQuoteWidget }