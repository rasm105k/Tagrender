import { TagrendeQuoteWidget } from './widget'

type InitOptions = {
  target: string | Element
  apiBaseUrl?: string
  tenantKey?: string
}

function init(options: InitOptions) {
  const target =
    typeof options.target === 'string'
      ? document.querySelector(options.target)
      : options.target

  if (!target) {
    throw new Error('TagrendeQuoteWidget target was not found.')
  }

  return new TagrendeQuoteWidget({
    target,
    apiBaseUrl: options.apiBaseUrl,
    tenantKey: options.tenantKey,
  })
}

function autoInit() {
  document.querySelectorAll<HTMLElement>('[data-tagrende-quote]').forEach(target => {
    if (target.dataset.tagrendeQuoteMounted === 'true') return
    target.dataset.tagrendeQuoteMounted = 'true'
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
