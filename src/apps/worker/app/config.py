from functools import lru_cache
from os import getenv

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    datafordeler_api_key: str | None = Field(default=None, alias="DATAFORDELEREN_API_KEY")
    sdfi_wmts_base_url: str = Field(
        default="https://wmts.datafordeler.dk/GeoDanmarkOrto/orto_foraar_webm/1.0.0/WMTS",
        alias="SDFI_WMTS_BASE_URL",
    )
    sdfi_wmts_layer: str = Field(default="orto_foraar_webm", alias="SDFI_WMTS_LAYER")
    sdfi_wmts_matrix_set: str = Field(default="DFD_GoogleMapsCompatible", alias="SDFI_WMTS_MATRIX_SET")
    sdfi_wmts_zoom: int = Field(default=20, alias="SDFI_WMTS_ZOOM")
    imagery_crop_size_meters: float = Field(default=70.0, alias="IMAGERY_CROP_SIZE_METERS")
    roof_segmentation_model_path: str | None = Field(default=None, alias="ROOF_SEGMENTATION_MODEL_PATH")

    model_config = SettingsConfigDict(env_file=getenv("TAGRENDE_WORKER_ENV_FILE", "../../.env"), extra="ignore")

    @property
    def wmts_api_key(self) -> str | None:
        return self.datafordeler_api_key

    @property
    def has_wmts_credentials(self) -> bool:
        return bool(self.wmts_api_key)


@lru_cache
def get_settings() -> WorkerSettings:
    return WorkerSettings()
