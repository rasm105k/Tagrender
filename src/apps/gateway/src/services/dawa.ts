import type { AddressSuggestion } from '../types.js'

type DawaAutocompleteResponse = {
  tekst: string
  adresse?: {
    id?: string
    adgangsadresseid?: string
    vejnavn?: string
    husnr?: string
    postnr?: string
    postnrnavn?: string
    kommunekode?: string
    esrejendomsnr?: string
    x?: number
    y?: number
    adgangsadresse?: {
      id?: string
      adgangspunkt?: {
        koordinater?: [number, number]
      }
    }
  }
}

export class DawaService {
  async autocomplete(query: string): Promise<AddressSuggestion[]> {
    if (query.trim().length < 2) return []

    const url = new URL('https://api.dataforsyningen.dk/adresser/autocomplete')
    url.searchParams.set('q', query)
    url.searchParams.set('per_side', '8')
    url.searchParams.set('type', 'adresse')

    const response = await fetch(url, {
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`DAWA returned HTTP ${response.status}`)
    }

    const data = await response.json() as DawaAutocompleteResponse[]
    return data.map(item => {
      const coordinates = item.adresse?.adgangsadresse?.adgangspunkt?.koordinater
      const lon = item.adresse?.x ?? coordinates?.[0]
      const lat = item.adresse?.y ?? coordinates?.[1]

      return {
        id: item.adresse?.id ?? item.tekst,
        label: item.tekst,
        roadName: item.adresse?.vejnavn,
        houseNumber: item.adresse?.husnr,
        postalCode: item.adresse?.postnr,
        city: item.adresse?.postnrnavn,
        municipalityCode: item.adresse?.kommunekode,
        propertyNumber: item.adresse?.esrejendomsnr,
        accessAddressId: item.adresse?.adgangsadresseid ?? item.adresse?.adgangsadresse?.id,
        coordinate: lon !== undefined && lat !== undefined
          ? { lon, lat }
          : undefined,
      }
    })
  }
}
