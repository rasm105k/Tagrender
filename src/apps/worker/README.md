# TagrendeQuote Worker

Python-service for den tunge verificering: billedhentning, tag-/tagrende-geometri og risikoanalyse.

Servicen henter rigtige ortofoto tiles via Datafordeler WMTS og kører en OpenCV-baseret analyse af tagkandidat og vegetation omkring tagkanten. Hvis Datafordeler credentials mangler, fejler endpointet eksplicit i stedet for at opfinde billeddata.

## Lokal kørsel

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 4020
```

Når vi begynder at køre egentlig billedanalyse lokalt:

```bash
pip install -r requirements-vision.txt
```

## Celery

```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

Bemærk: Gatewayen bruger BullMQ, mens Celery ikke direkte kan forbruge BullMQ jobs. Første rigtige integration bør enten være en lille queue bridge eller et skifte til Redis Streams/SQS som neutral kontrakt.
