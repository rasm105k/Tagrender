# TagrendeQuote

Nyt separat projekt for et dansk B2B2C SaaS-produkt til automatisk tilbudsgivning på tagrenderens.

## Apps

- `apps/widget` - framework-fri JavaScript widget bygget med Vite og Shadow DOM.
- `apps/gateway` - Fastify + TypeScript API-gateway til DAWA, instant estimate, quote state og kø.
- `apps/worker` - Python FastAPI/Celery worker til SDFI ortofoto og billedverifikation.
- `apps/admin` - Vue 3 + Vite mester-panel til tilbudskø og kort/review.

## Dev

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm run dev:gateway
npm run dev:widget
npm run dev:admin
```

Sæt `DATAFORDELEREN_API_KEY` i `.env`. Læg ikke rigtige nøgler i `.env.example`.

One-command dev boot:

```powershell
.\start-dev.ps1
```

`start-dev.ps1` starter gateway uden `tsx watch`, fordi watch-mode kan fejle med `EBADF` når processen startes skjult med redirected logs på Windows.

Stop app-processerne igen:

```powershell
.\stop-dev.ps1
```

Stop app-processer og Docker Compose:

```powershell
.\stop-dev.ps1 -StopDocker
```

Python worker:

```powershell
cd apps/worker
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 4020
```

Redis/Postgres lokalt:

```powershell
docker compose up -d
```

## Implementeret nu

- DAWA autocomplete proxy i gateway.
- Instant estimate endpoint mod Datafordeler BBR. Endpointet fejler eksplicit, hvis credentials eller DAWA Husnummer ID mangler.
- Quote request endpoint, quote status endpoint og BullMQ queue integration når `REDIS_URL` er sat.
- Vanilla widget med adresse-søgning, instant estimate og verified quote request.
- Admin dashboard med quote list/detail og kort/polygon fra verificerede data.
- Python worker med FastAPI endpoint og Celery task-funktion for verified quote.
- Worker henter rigtige ortofoto tiles via Datafordeler WMTS og kører OpenCV-baseret tag-/vegetationsanalyse.

## Bevidste afgrænsninger

- BBR/Datafordeleren bruger GraphQL v1 med `DATAFORDELEREN_API_KEY`.
- Ortofoto bruger samme `DATAFORDELEREN_API_KEY` med adgang til `GeoDanmarkOrto/orto_foraar_webm`.
- OpenCV-segmenteringen er reel billedanalyse, men ikke en trænet tagmodel. Næste kvalitetsløft er at sætte `ROOF_SEGMENTATION_MODEL_PATH` op med en finetuned YOLOv8-seg model.
- BullMQ og Celery er begge Redis-baserede, men ikke wire-kompatible. Gatewayen bruger BullMQ som Node-kø, mens workerens FastAPI endpoint er den konkrete processeringskontrakt i første version. Næste tekniske beslutning er enten en lille queue bridge eller at standardisere worker-køen på Redis Streams.

## API

- `GET /health`
- `GET /api/addresses?q=vejnavn`
- `POST /api/estimates/instant`
- `POST /api/quotes/request`
- `GET /api/quotes`
- `GET /api/quotes/:quoteId`
- `POST /internal/quotes/:quoteId/verification`

## Widget embed

```html
<div data-tagrende-quote data-api-base-url="https://api.example.dk"></div>
<script src="https://cdn.example.dk/widget.js" async></script>
```
