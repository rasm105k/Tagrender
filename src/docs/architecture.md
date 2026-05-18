# Architecture

## Synchronous estimate

1. Customer types address in the widget.
2. Widget calls Gateway `/api/addresses`.
3. Gateway proxies DAWA and normalizes address metadata.
4. Widget calls Gateway `/api/estimates/instant`.
5. Gateway calls Datafordeler BBR GraphQL using the DAWA access address id.
6. Gateway calculates a conservative estimate from BBR building facts.

This path must stay fast and resilient. If the Datafordeler API key or BBR data are unavailable, the gateway returns an explicit error instead of inventing pricing data.

## Verified quote

1. Customer submits contact details and address.
2. Gateway creates a quote record and queue job.
3. Python worker fetches aerial imagery and runs segmentation/risk scoring.
4. Admin reviews the verified quote and adjusts geometry/pricing.
5. Final offer is sent by SMS/email.

## Queue note

BullMQ and Celery cannot consume each other's jobs directly. For the first implementation the gateway owns quote creation and queueing, while the worker exposes a FastAPI processing endpoint. Production should choose one of:

- Redis Streams as shared queue primitive.
- BullMQ with a Node worker that calls the Python AI service.
- Celery-only queue with Node publishing Celery-compatible task messages.
