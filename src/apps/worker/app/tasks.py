import os

from celery import Celery

from .models import VerifyQuoteRequest
from .vision import verify_quote


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "tagrende_quote_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
)


@celery_app.task(name="quote.verify")
def verify_quote_task(payload: dict) -> dict:
    request = VerifyQuoteRequest.model_validate(payload)
    return verify_quote(request).model_dump()
