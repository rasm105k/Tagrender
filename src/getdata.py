import requests
import time
import os
import sys
import math
import re
from PIL import Image
from io import BytesIO

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


# -------------------------------
# 🔧 KONFIGURATION
# -------------------------------
OUTPUT_DIR = "danske_luftfotos"
API_KEY = os.getenv("DATAFORDELEREN_API_KEY", "8es9KqcaNPEcfFjXGq9MTPzptU1hIbK2HQ7eKeaFbKMplWGMxw8RNztJK4I5yuaVIZSu5J7jVSs7Nruml5ckbi2MlUEvQfh6J")
DAR_GRAPHQL_URL = os.getenv("DATAFORDELEREN_DAR_GRAPHQL_URL", "https://graphql.datafordeler.dk/DAR/v1")
BBR_GRAPHQL_URL = os.getenv("DATAFORDELEREN_BBR_GRAPHQL_URL", "https://graphql.datafordeler.dk/BBR/v1")
ANTAL = 50
BILLEDE_STØRRELSE = 1024  # px
OMRÅDE_ET_ARK = 50  # meter (crop 50x50 meter omkring hus)
EGNEDE_BYGNINGSANVENDELSER = {"110", "120", "121", "122", "130", "131", "132"}

# Opret mappe
os.makedirs(OUTPUT_DIR, exist_ok=True)

class GraphQlError(RuntimeError):
    pass

class GraphQlClient:
    def __init__(self, endpoint, api_key, session=None):
        self.endpoint = endpoint
        self.api_key = api_key
        self.session = session or requests.Session()

    def execute(self, query, variables=None):
        response = self.session.post(
            self.endpoint,
            params={"apiKey": self.api_key},
            json={"query": query, "variables": variables or {}},
            headers={"accept": "application/json", "content-type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()

        errors = payload.get("errors") or []
        if errors:
            messages = "; ".join(error.get("message", str(error)) for error in errors)
            raise GraphQlError(messages)

        return payload.get("data") or {}


HUSNUMMER_QUERY = """
query HentHusnumre($first: Int!, $timestamp: DafDateTime!) {
  DAR_Husnummer(
    first: $first
    registreringstid: $timestamp
    virkningstid: $timestamp
    where: { status: { eq: "3" } }
  ) {
    nodes {
      id_lokalId
      adgangsadressebetegnelse
      adgangspunkt
    }
  }
}
"""


ADRESSEPUNKT_QUERY = """
query HentAdressepunkter($ids: [String!], $timestamp: DafDateTime!) {
  DAR_Adressepunkt(
    first: 100
    registreringstid: $timestamp
    virkningstid: $timestamp
    where: { id_lokalId: { in: $ids } }
  ) {
    nodes {
      id_lokalId
      position {
        wkt
      }
    }
  }
}
"""


BBR_BYGNING_QUERY = """
query HentBygninger($ids: [String!], $timestamp: DafDateTime!) {
  BBR_Bygning(
    first: 100
    registreringstid: $timestamp
    virkningstid: $timestamp
    where: { husnummer: { in: $ids } }
  ) {
    nodes {
      id_lokalId
      husnummer
      byg007Bygningsnummer
      byg021BygningensAnvendelse
      byg038SamletBygningsareal
      byg041BebyggetAreal
    }
  }
}
"""


def hent_parcelhuse(antal=100, client=None, bbr_client=None):
    """Hent danske huse, som er egnede til tagrende-træningsdata."""
    bruger_injiceret_client = client is not None
    if client is None:
        if API_KEY.startswith("DIN_API"):
            raise GraphQlError("DATAFORDELEREN_API_KEY mangler. Sæt den i miljøet før scriptet køres.")
        client = GraphQlClient(DAR_GRAPHQL_URL, API_KEY)
    if bbr_client is None:
        bbr_client = client if bruger_injiceret_client else GraphQlClient(BBR_GRAPHQL_URL, API_KEY)

    timestamp = _now_iso()
    data = client.execute(HUSNUMMER_QUERY, {"first": max(antal * 5, antal), "timestamp": timestamp})
    husnumre = data.get("DAR_Husnummer", {}).get("nodes", [])
    husnummer_ids = [node.get("id_lokalId") for node in husnumre if node.get("id_lokalId")]
    egnede_bygninger = _hent_egnede_bygninger(bbr_client, husnummer_ids, timestamp)

    egnede_husnumre = [
        node for node in husnumre
        if node.get("id_lokalId") in egnede_bygninger and node.get("adgangspunkt")
    ]
    point_ids = [node.get("adgangspunkt") for node in egnede_husnumre]

    adressepunkter = {}
    for chunk in _chunks(point_ids, 100):
        point_data = client.execute(ADRESSEPUNKT_QUERY, {"ids": chunk, "timestamp": timestamp})
        for point in point_data.get("DAR_Adressepunkt", {}).get("nodes", []):
            adressepunkter[point.get("id_lokalId")] = point

    adresser = []
    for node in egnede_husnumre:
        point = adressepunkter.get(node.get("adgangspunkt"))
        wkt = (point or {}).get("position", {}).get("wkt")
        if not wkt:
            continue

        x, y = _parse_point_wkt(wkt)
        lng, lat = _epsg25832_to_wgs84(x, y)
        bygning = egnede_bygninger[node.get("id_lokalId")]
        adresser.append({
            "id": node.get("id_lokalId"),
            "adresse": node.get("adgangsadressebetegnelse"),
            "lng": lng,
            "lat": lat,
            "bbr_bygning_id": bygning.get("id_lokalId"),
            "bbr_bygningsnummer": bygning.get("byg007Bygningsnummer"),
            "bbr_anvendelse": bygning.get("byg021BygningensAnvendelse"),
            "bebygget_areal_m2": _number_value(bygning.get("byg041BebyggetAreal")),
        })

        if len(adresser) >= antal:
            break

    return adresser


def _hent_egnede_bygninger(client, husnummer_ids, timestamp):
    egnede = {}
    for chunk in _chunks(husnummer_ids, 100):
        data = client.execute(BBR_BYGNING_QUERY, {"ids": chunk, "timestamp": timestamp})
        for bygning in data.get("BBR_Bygning", {}).get("nodes", []):
            if not _er_egnet_tagrende_bygning(bygning):
                continue

            husnummer = bygning.get("husnummer")
            eksisterende = egnede.get(husnummer)
            if eksisterende is None or _bygningsareal(bygning) > _bygningsareal(eksisterende):
                egnede[husnummer] = bygning
    return egnede


def _er_egnet_tagrende_bygning(bygning):
    anvendelse = str(bygning.get("byg021BygningensAnvendelse") or "")
    return anvendelse in EGNEDE_BYGNINGSANVENDELSER and _bygningsareal(bygning) > 0


def _bygningsareal(bygning):
    return (
        _number_value(bygning.get("byg041BebyggetAreal"))
        or _number_value(bygning.get("byg038SamletBygningsareal"))
        or 0
    )


def _number_value(value):
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _chunks(values, size):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def _parse_point_wkt(wkt):
    match = re.match(r"POINT\s*\(\s*([0-9.]+)\s+([0-9.]+)\s*\)", wkt)
    if not match:
        raise GraphQlError(f"Ukendt WKT-punktformat: {wkt}")
    return float(match.group(1)), float(match.group(2))


def _epsg25832_to_wgs84(easting, northing):
    """Convert ETRS89 / UTM zone 32N (EPSG:25832) to WGS84 lon/lat."""
    a = 6378137.0
    f = 1 / 298.257222101
    k0 = 0.9996
    lon0 = math.radians(9.0)
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)

    x = easting - 500000.0
    y = northing
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))

    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    j1 = 3 * e1 / 2 - 27 * e1**3 / 32
    j2 = 21 * e1**2 / 16 - 55 * e1**4 / 32
    j3 = 151 * e1**3 / 96
    j4 = 1097 * e1**4 / 512
    fp = mu + j1 * math.sin(2 * mu) + j2 * math.sin(4 * mu) + j3 * math.sin(6 * mu) + j4 * math.sin(8 * mu)

    sin_fp = math.sin(fp)
    cos_fp = math.cos(fp)
    tan_fp = math.tan(fp)
    c1 = ep2 * cos_fp**2
    t1 = tan_fp**2
    n1 = a / math.sqrt(1 - e2 * sin_fp**2)
    r1 = a * (1 - e2) / (1 - e2 * sin_fp**2) ** 1.5
    d = x / (n1 * k0)

    lat = fp - (n1 * tan_fp / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720
    )
    lon = lon0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120
    ) / cos_fp

    return math.degrees(lon), math.degrees(lat)

# -------------------------------
# 2. Hent luftfoto fra SDFI (WMTS)
# -------------------------------
def hent_luftfoto(lng, lat, api_key, size=1024):
    """Fetch orthophoto from SDFI using WMTS tiles"""
    from math import log, tan, cos, pi, radians, atan, sinh, degrees, floor
    
    TILE_SIZE = 256
    ZOOM = 20  # High zoom level for detail
    EARTH_CIRCUMFERENCE_METERS = 40075016.68557849
    
    # Convert lon/lat to Web Mercator pixel coordinates
    scale = TILE_SIZE * (2**ZOOM)
    x = (lng + 180.0) / 360.0 * scale
    sin_lat = max(min(tan(radians(lat)), 1e10), -1e10)
    y = (1.0 - log(sin_lat + 1 / cos(radians(lat))) / pi) / 2.0 * scale
    
    # Calculate meters per pixel
    meters_per_pixel = cos(radians(lat)) * EARTH_CIRCUMFERENCE_METERS / (TILE_SIZE * (2**ZOOM))
    
    # Calculate crop in pixels
    crop_px = max(384, int(OMRÅDE_ET_ARK / meters_per_pixel))
    crop_px = min(crop_px, 1536)
    half = crop_px // 2
    
    # Calculate tile coordinates
    min_x, max_x = int(x - half), int(x + half)
    min_y, max_y = int(y - half), int(y + half)
    tile_min_x = floor(min_x / TILE_SIZE)
    tile_max_x = floor(max_x / TILE_SIZE)
    tile_min_y = floor(min_y / TILE_SIZE)
    tile_max_y = floor(max_y / TILE_SIZE)
    
    # Create mosaic of tiles
    mosaic = Image.new(
        "RGB",
        ((tile_max_x - tile_min_x + 1) * TILE_SIZE, (tile_max_y - tile_min_y + 1) * TILE_SIZE),
    )
    
    for tile_x in range(tile_min_x, tile_max_x + 1):
        for tile_y in range(tile_min_y, tile_max_y + 1):
            tile = hent_wmts_tile(tile_x, tile_y, ZOOM, api_key)
            if tile:
                mosaic.paste(tile, ((tile_x - tile_min_x) * TILE_SIZE, (tile_y - tile_min_y) * TILE_SIZE))
    
    # Crop to desired area
    crop_left = min_x - tile_min_x * TILE_SIZE
    crop_top = min_y - tile_min_y * TILE_SIZE
    crop = mosaic.crop((crop_left, crop_top, crop_left + crop_px, crop_top + crop_px))
    
    return crop


def hent_wmts_tile(tile_x, tile_y, zoom, api_key):
    """Fetch a single WMTS tile"""
    url = "https://wmts.datafordeler.dk/GeoDanmarkOrto/orto_foraar_webm/1.0.0/WMTS"
    params = {
        "SERVICE": "WMTS",
        "REQUEST": "GetTile",
        "VERSION": "1.0.0",
        "STYLE": "default",
        "FORMAT": "image/jpeg",
        "TILEMATRIXSET": "DFD_GoogleMapsCompatible",
        "TILEMATRIX": str(zoom),
        "TILEROW": str(tile_y),
        "TILECOL": str(tile_x),
        "Layer": "orto_foraar_webm",
        "apikey": api_key
    }
    
    try:
        r = requests.get(url, params=params, timeout=20)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
            return Image.open(BytesIO(r.content)).convert("RGB")
        else:
            return None
    except Exception:
        return None

# -------------------------------
# 3. Gem billede og metadata
# -------------------------------
def gem_billede_og_csv():
    adresser = hent_parcelhuse(ANTAL)
    print(f"✅ Fundet {len(adresser)} adresser. Henter billeder...")

    metadata = []

    for i, adr in enumerate(adresser, 1):
        print(f"🖼️  {i}/{ANTAL}: {adr['adresse']}")

        img = hent_luftfoto(adr["lng"], adr["lat"], API_KEY, BILLEDE_STØRRELSE)

        if img:
            filnavn = f"billede_{i:03d}.png"
            sti = os.path.join(OUTPUT_DIR, filnavn)
            img.save(sti, "PNG")
            print(f"   ✅ Gemt: {filnavn}")

            metadata.append({
                "id": adr["id"],
                "filnavn": filnavn,
                "adresse": adr["adresse"],
                "lng": adr["lng"],
                "lat": adr["lat"],
                "bbr_bygning_id": adr.get("bbr_bygning_id"),
                "bbr_bygningsnummer": adr.get("bbr_bygningsnummer"),
                "bbr_anvendelse": adr.get("bbr_anvendelse"),
                "bebygget_areal_m2": adr.get("bebygget_areal_m2"),
            })
        else:
            print(f"   ❌ Kunne ikke hente billede")

    # Gem metadata
    with open(os.path.join(OUTPUT_DIR, "adresser.csv"), "w", encoding="utf-8") as f:
        f.write("id;filnavn;adresse;lng;lat;bbr_bygning_id;bbr_bygningsnummer;bbr_anvendelse;bebygget_areal_m2\n")
        for m in metadata:
            f.write(
                f"{m['id']};{m['filnavn']};{m['adresse']};{m['lng']};{m['lat']};"
                f"{m.get('bbr_bygning_id')};{m.get('bbr_bygningsnummer')};"
                f"{m.get('bbr_anvendelse')};{m.get('bebygget_areal_m2')}\n"
            )

    print(f"🎉 Færdig! {len(metadata)} billeder gemt i mappen '{OUTPUT_DIR}'")
    print("📌 Upload .png-filerne til Roboflow for annotering.")

# -------------------------------
# Kør script
# -------------------------------
if __name__ == "__main__":
    if API_KEY.startswith("DIN_API"):
        print("❌ Husk at indsætte din rigtige API-nøgle fra api.dataforsyningen.dk")
    else:
        gem_billede_og_csv()
