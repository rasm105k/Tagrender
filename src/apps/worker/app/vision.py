import cv2
import numpy as np
from PIL import Image

from .errors import ImageAnalysisError
from .imagery import ImageryResult, fetch_orthophoto, global_pixel_to_lon_lat
from .models import Coordinate, VerifyQuoteRequest, VerifiedQuoteResult


def verify_quote(payload: VerifyQuoteRequest) -> VerifiedQuoteResult:
    imagery = fetch_orthophoto(payload.address)
    analysis = analyze_roof_and_trees(imagery)
    gutter_meters = max(1, round(analysis["perimeter_meters"]))
    tree_risk = classify_tree_risk(analysis["vegetation_overlap_ratio"])
    risk_surcharge = {"low": 0, "medium": 250, "high": 550}[tree_risk]
    price_dkk = round((895 + gutter_meters * 38 + risk_surcharge) / 50) * 50
    confidence = calculate_confidence(analysis["roof_area_ratio"], analysis["vegetation_overlap_ratio"])

    return VerifiedQuoteResult(
        quoteId=payload.quoteId,
        gutterMeters=gutter_meters,
        treeRisk=tree_risk,
        roofPolygon=analysis["polygon"],
        priceDkk=price_dkk,
        confidence=confidence,
        imagery={
            **imagery.metadata,
            "roofAreaRatio": analysis["roof_area_ratio"],
            "vegetationOverlapRatio": analysis["vegetation_overlap_ratio"],
            "segmentationMethod": analysis["method"],
        },
        notes=[
            "Ortofoto er hentet via Datafordeler WMTS.",
            "Tagpolygon er beregnet fra faktiske billedpixels med OpenCV.",
            f"Vegetation langs tagkant: {analysis['vegetation_overlap_ratio']:.0%}.",
        ],
    )


def analyze_roof_and_trees(imagery: ImageryResult) -> dict:
    image = np.array(imagery.image)
    roof_mask = segment_roof_candidate(image)
    contour = largest_roof_contour(roof_mask)
    polygon_pixels = simplify_contour(contour)
    polygon = pixels_to_coordinates(polygon_pixels, imagery)
    perimeter_meters = cv2.arcLength(polygon_pixels.astype(np.float32), True) * imagery.bounds.meters_per_pixel
    vegetation_ratio = vegetation_overlap_ratio(image, roof_mask)
    roof_area_ratio = float(cv2.contourArea(contour)) / float(image.shape[0] * image.shape[1])

    return {
        "method": "opencv_edge_color_segmentation",
        "polygon": polygon,
        "perimeter_meters": perimeter_meters,
        "vegetation_overlap_ratio": vegetation_ratio,
        "roof_area_ratio": roof_area_ratio,
    }


def segment_roof_candidate(rgb_image: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB)
    gray = lab[:, :, 0]
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    edges = cv2.Canny(blurred, 45, 130)
    kernel = np.ones((9, 9), np.uint8)
    closed_edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

    hsv = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    non_green = ~green_mask(hsv)
    roof_like = ((saturation > 20) & (value > 55) & non_green).astype(np.uint8) * 255
    combined = cv2.bitwise_or(closed_edges, roof_like)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8), iterations=1)
    return combined


def largest_roof_contour(mask: np.ndarray) -> np.ndarray:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = mask.shape[:2]
    min_area = height * width * 0.01
    max_area = height * width * 0.55
    candidates = [contour for contour in contours if min_area <= cv2.contourArea(contour) <= max_area]
    if not candidates:
        raise ImageAnalysisError("No plausible roof contour found in ortofoto image.")

    center = np.array([width / 2, height / 2])

    def score(contour: np.ndarray) -> float:
        moment = cv2.moments(contour)
        if moment["m00"] == 0:
            return float("-inf")
        centroid = np.array([moment["m10"] / moment["m00"], moment["m01"] / moment["m00"]])
        distance_penalty = np.linalg.norm(centroid - center)
        return cv2.contourArea(contour) - distance_penalty * 80

    return max(candidates, key=score)


def simplify_contour(contour: np.ndarray) -> np.ndarray:
    perimeter = cv2.arcLength(contour, True)
    approximated = cv2.approxPolyDP(contour, 0.025 * perimeter, True).reshape(-1, 2)
    if len(approximated) < 3:
        rect = cv2.minAreaRect(contour)
        approximated = cv2.boxPoints(rect).astype(np.int32)
    return approximated


def pixels_to_coordinates(pixels: np.ndarray, imagery: ImageryResult) -> list[Coordinate]:
    coordinates: list[Coordinate] = []
    for x, y in pixels:
        lon, lat = global_pixel_to_lon_lat(
            imagery.bounds.x_offset + int(x),
            imagery.bounds.y_offset + int(y),
            imagery.metadata["tileMatrix"],
        )
        coordinates.append(Coordinate(lat=lat, lon=lon))
    return coordinates


def vegetation_overlap_ratio(rgb_image: np.ndarray, roof_mask: np.ndarray) -> float:
    hsv = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2HSV)
    vegetation = green_mask(hsv).astype(np.uint8) * 255
    edge_band = cv2.dilate(roof_mask, np.ones((21, 21), np.uint8), iterations=1)
    edge_band = cv2.subtract(edge_band, cv2.erode(roof_mask, np.ones((15, 15), np.uint8), iterations=1))
    band_pixels = cv2.countNonZero(edge_band)
    if band_pixels == 0:
        return 0.0
    overlap = cv2.countNonZero(cv2.bitwise_and(vegetation, edge_band))
    return overlap / band_pixels


def green_mask(hsv_image: np.ndarray) -> np.ndarray:
    hue = hsv_image[:, :, 0]
    saturation = hsv_image[:, :, 1]
    value = hsv_image[:, :, 2]
    return (hue >= 32) & (hue <= 92) & (saturation >= 35) & (value >= 35)


def classify_tree_risk(vegetation_ratio: float) -> str:
    if vegetation_ratio >= 0.28:
        return "high"
    if vegetation_ratio >= 0.12:
        return "medium"
    return "low"


def calculate_confidence(roof_area_ratio: float, vegetation_ratio: float) -> float:
    confidence = 0.72
    if 0.03 <= roof_area_ratio <= 0.22:
        confidence += 0.12
    if vegetation_ratio > 0.28:
        confidence -= 0.1
    return max(0.35, min(0.92, confidence))
