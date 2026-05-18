from dataclasses import dataclass
from io import BytesIO
from math import atan, cos, degrees, floor, log, pi, radians, sinh, tan

import requests
from PIL import Image

from .config import WorkerSettings, get_settings
from .errors import ConfigurationError, ImageryFetchError
from .models import AddressSuggestion

TILE_SIZE = 256
EARTH_CIRCUMFERENCE_METERS = 40075016.68557849


@dataclass(frozen=True)
class PixelBounds:
    west_lon: float
    north_lat: float
    meters_per_pixel: float
    x_offset: int
    y_offset: int


@dataclass(frozen=True)
class ImageryResult:
    image: Image.Image
    bounds: PixelBounds
    metadata: dict


def fetch_orthophoto(address: AddressSuggestion, settings: WorkerSettings | None = None) -> ImageryResult:
    settings = settings or get_settings()
    if not settings.has_wmts_credentials:
        raise ConfigurationError(
            "DATAFORDELEREN_API_KEY is required for ortofoto WMTS."
        )
    if not address.coordinate:
        raise ImageryFetchError("Address coordinate is required before fetching ortofoto imagery.")

    zoom = settings.sdfi_wmts_zoom
    center_x, center_y = lon_lat_to_global_pixel(address.coordinate.lon, address.coordinate.lat, zoom)
    meters_per_pixel = web_mercator_meters_per_pixel(address.coordinate.lat, zoom)
    crop_px = max(384, int(settings.imagery_crop_size_meters / meters_per_pixel))
    crop_px = min(crop_px, 1536)
    half = crop_px // 2

    min_x = center_x - half
    max_x = center_x + half
    min_y = center_y - half
    max_y = center_y + half
    tile_min_x = floor(min_x / TILE_SIZE)
    tile_max_x = floor(max_x / TILE_SIZE)
    tile_min_y = floor(min_y / TILE_SIZE)
    tile_max_y = floor(max_y / TILE_SIZE)

    mosaic = Image.new(
        "RGB",
        ((tile_max_x - tile_min_x + 1) * TILE_SIZE, (tile_max_y - tile_min_y + 1) * TILE_SIZE),
    )

    for tile_x in range(tile_min_x, tile_max_x + 1):
        for tile_y in range(tile_min_y, tile_max_y + 1):
            tile = fetch_wmts_tile(tile_x, tile_y, zoom, settings)
            mosaic.paste(tile, ((tile_x - tile_min_x) * TILE_SIZE, (tile_y - tile_min_y) * TILE_SIZE))

    crop_left = min_x - tile_min_x * TILE_SIZE
    crop_top = min_y - tile_min_y * TILE_SIZE
    crop = mosaic.crop((crop_left, crop_top, crop_left + crop_px, crop_top + crop_px))
    west_lon, north_lat = global_pixel_to_lon_lat(min_x, min_y, zoom)

    return ImageryResult(
        image=crop,
        bounds=PixelBounds(
            west_lon=west_lon,
            north_lat=north_lat,
            meters_per_pixel=meters_per_pixel,
            x_offset=min_x,
            y_offset=min_y,
        ),
        metadata={
            "provider": "Datafordeler / GeoDanmark Ortofoto",
            "service": "WMTS",
            "baseUrl": settings.sdfi_wmts_base_url,
            "layer": settings.sdfi_wmts_layer,
            "tileMatrixSet": settings.sdfi_wmts_matrix_set,
            "tileMatrix": zoom,
            "format": "image/jpeg",
            "cropSizePixels": crop_px,
            "metersPerPixel": meters_per_pixel,
            "center": address.coordinate.model_dump(),
        },
    )


def fetch_wmts_tile(tile_x: int, tile_y: int, zoom: int, settings: WorkerSettings) -> Image.Image:
    params = {
        "SERVICE": "WMTS",
        "REQUEST": "GetTile",
        "VERSION": "1.0.0",
        "STYLE": "default",
        "FORMAT": "image/jpeg",
        "TILEMATRIXSET": settings.sdfi_wmts_matrix_set,
        "TILEMATRIX": str(zoom),
        "TILEROW": str(tile_y),
        "TILECOL": str(tile_x),
        "Layer": settings.sdfi_wmts_layer,
    }
    params["apikey"] = settings.wmts_api_key

    response = requests.get(settings.sdfi_wmts_base_url, params=params, timeout=20)
    content_type = response.headers.get("content-type", "")
    if response.status_code != 200 or not content_type.startswith("image/"):
        message = response.text[:300] if response.text else response.reason
        raise ImageryFetchError(f"WMTS tile fetch failed: HTTP {response.status_code} {message}")

    return Image.open(BytesIO(response.content)).convert("RGB")


def lon_lat_to_global_pixel(lon: float, lat: float, zoom: int) -> tuple[int, int]:
    scale = TILE_SIZE * (2**zoom)
    x = (lon + 180.0) / 360.0 * scale
    sin_lat = max(min(tan(radians(lat)), 1e10), -1e10)
    y = (1.0 - log(sin_lat + 1 / cos(radians(lat))) / pi) / 2.0 * scale
    return int(x), int(y)


def global_pixel_to_lon_lat(x: int, y: int, zoom: int) -> tuple[float, float]:
    scale = TILE_SIZE * (2**zoom)
    lon = x / scale * 360.0 - 180.0
    lat = degrees(atan(sinh(pi * (1 - 2 * y / scale))))
    return lon, lat


def web_mercator_meters_per_pixel(lat: float, zoom: int) -> float:
    return cos(radians(lat)) * EARTH_CIRCUMFERENCE_METERS / (TILE_SIZE * (2**zoom))
