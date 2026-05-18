from fastapi import FastAPI, HTTPException

from .errors import ProcessingError
from .models import VerifyQuoteRequest, VerifiedQuoteResult
from .vision import verify_quote


app = FastAPI(title="TagrendeQuote Worker", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/internal/quotes/{quote_id}/verify", response_model=VerifiedQuoteResult)
def verify_quote_endpoint(quote_id: str, payload: VerifyQuoteRequest) -> VerifiedQuoteResult:
    normalized = payload.model_copy(update={"quoteId": quote_id})
    try:
        return verify_quote(normalized)
    except ProcessingError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
