from typing import Literal

from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lat: float
    lon: float


class AddressSuggestion(BaseModel):
    id: str
    label: str
    municipalityCode: str | None = None
    propertyNumber: str | None = None
    accessAddressId: str | None = None
    coordinate: Coordinate | None = None


class BuildingFacts(BaseModel):
    buildingAreaM2: int
    floors: int
    source: Literal["datafordeler"]
    estimatedGutterMeters: int


class InstantEstimate(BaseModel):
    estimateId: str
    address: AddressSuggestion
    price: dict
    facts: BuildingFacts
    confidence: float
    riskFlags: list[str] = Field(default_factory=list)


class VerifyQuoteRequest(BaseModel):
    quoteId: str
    address: AddressSuggestion
    estimate: InstantEstimate


class VerifiedQuoteResult(BaseModel):
    quoteId: str
    gutterMeters: int
    treeRisk: Literal["low", "medium", "high"]
    roofPolygon: list[Coordinate]
    priceDkk: int
    confidence: float
    imagery: dict
    notes: list[str]
