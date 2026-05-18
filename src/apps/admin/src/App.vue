<script setup lang="ts">
import L from 'leaflet'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getGatewayUrl, getQuote, listQuotes } from './api'
import type { QuoteRecord } from './types'

const quotes = ref<QuoteRecord[]>([])
const selected = ref<QuoteRecord | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const mapElement = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let polygonLayer: L.Polygon | null = null

const selectedPrice = computed(() => {
  if (!selected.value) return '-'
  const verified = selected.value.verified?.priceDkk
  if (verified) return formatDkk(verified)
  return `${formatDkk(selected.value.estimate.price.min)}-${formatDkk(selected.value.estimate.price.max)}`
})

onMounted(async () => {
  await refreshQuotes()
})

watch(selected, async () => {
  await nextTick()
  renderMap()
})

async function refreshQuotes() {
  loading.value = true
  error.value = null
  try {
    quotes.value = await listQuotes()
    if (!selected.value && quotes.value.length > 0) {
      selected.value = quotes.value[0]
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ukendt fejl.'
  } finally {
    loading.value = false
  }
}

async function openQuote(quote: QuoteRecord) {
  selected.value = await getQuote(quote.quoteId)
}

function renderMap() {
  if (!mapElement.value || !selected.value) return

  const center = selected.value.address.coordinate ?? { lat: 55.6761, lon: 12.5683 }
  const polygon = selected.value.verified?.roofPolygon

  if (!map) {
    map = L.map(mapElement.value, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView([center.lat, center.lon], 19)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
    }).addTo(map)
  }

  map.setView([center.lat, center.lon], 19)
  if (polygonLayer) {
    polygonLayer.remove()
    polygonLayer = null
  }
  if (polygon) {
    polygonLayer = L.polygon(
      polygon.map((point) => [point.lat, point.lon]),
      { color: '#0f766e', weight: 3, fillColor: '#14b8a6', fillOpacity: 0.18 },
    ).addTo(map)
  }
  map.invalidateSize()
}

function formatDkk(value: number) {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('da-DK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <main class="shell">
    <section class="topbar">
      <div>
        <p class="eyebrow">Mester-panel</p>
        <h1>TagrendeQuote</h1>
      </div>
      <button type="button" class="secondary" @click="refreshQuotes">Opdater</button>
    </section>

    <section v-if="error" class="notice">
      {{ error }} Gateway: {{ getGatewayUrl() }}
    </section>

    <section class="layout">
      <aside class="queue">
        <div class="queue-header">
          <h2>Tilbudskø</h2>
          <span>{{ quotes.length }} sager</span>
        </div>

        <p v-if="loading" class="muted">Henter tilbud...</p>
        <p v-else-if="quotes.length === 0" class="muted">Ingen tilbud endnu.</p>

        <button
          v-for="quote in quotes"
          :key="quote.quoteId"
          type="button"
          class="quote-row"
          :class="{ active: selected?.quoteId === quote.quoteId }"
          @click="openQuote(quote)"
        >
          <span class="row-main">
            <strong>{{ quote.address.label }}</strong>
            <small>{{ quote.customer.name || 'Ukendt kunde' }}</small>
          </span>
          <span class="row-side">
            <span class="status" :data-status="quote.status">{{ quote.status }}</span>
            <small>{{ formatDate(quote.updatedAt) }}</small>
          </span>
        </button>
      </aside>

      <section v-if="selected" class="detail">
        <div class="detail-header">
          <div>
            <p class="eyebrow">Tilbud {{ selected.quoteId.slice(0, 8) }}</p>
            <h2>{{ selected.address.label }}</h2>
          </div>
          <div class="price">{{ selectedPrice }}</div>
        </div>

        <div class="grid">
          <article class="panel">
            <h3>Kunde</h3>
            <dl>
              <div><dt>Navn</dt><dd>{{ selected.customer.name || '-' }}</dd></div>
              <div><dt>Telefon</dt><dd>{{ selected.customer.phone || '-' }}</dd></div>
              <div><dt>E-mail</dt><dd>{{ selected.customer.email || '-' }}</dd></div>
            </dl>
          </article>

          <article class="panel">
            <h3>BBR-estimat</h3>
            <dl>
              <div><dt>Bebygget areal</dt><dd>{{ selected.estimate.facts.buildingAreaM2 }} m2</dd></div>
              <div><dt>Etager</dt><dd>{{ selected.estimate.facts.floors }}</dd></div>
              <div><dt>Tagrende</dt><dd>{{ selected.estimate.facts.estimatedGutterMeters }} m</dd></div>
              <div><dt>Kilde</dt><dd>{{ selected.estimate.facts.source }}</dd></div>
            </dl>
          </article>

          <article class="panel">
            <h3>Verificering</h3>
            <dl>
              <div><dt>Status</dt><dd>{{ selected.status }}</dd></div>
              <div><dt>Trærisiko</dt><dd>{{ selected.verified?.treeRisk || 'Afventer' }}</dd></div>
              <div><dt>AI-confidence</dt><dd>{{ Math.round((selected.verified?.confidence ?? selected.estimate.confidence) * 100) }}%</dd></div>
            </dl>
          </article>
        </div>

        <article class="map-panel">
          <div class="map-header">
            <div>
              <h3>Luftfoto og taglinje</h3>
              <p>AI-polygon kan senere gøres redigerbar direkte i kortet.</p>
            </div>
            <span class="status" :data-status="selected.status">{{ selected.status }}</span>
          </div>
          <div ref="mapElement" class="map"></div>
        </article>

        <article class="panel notes">
          <h3>Noter</h3>
          <ul>
            <li v-for="note in selected.verified?.notes ?? selected.estimate.riskFlags" :key="note">
              {{ note }}
            </li>
            <li v-if="!selected.verified && selected.estimate.riskFlags.length === 0">
              Afventer billedverificering.
            </li>
          </ul>
        </article>
      </section>
    </section>
  </main>
</template>
