Her er det konkrete teknologistak-setup, som skærer unødig kompleksitet væk og udnytter de bedste værktøjer til opgaven. Målet er en ultra-let frontend, en lynhurtig API-gateway og en Python-baseret AI-motor, der kan tygge geo-data.

# Project Specification: AI-Driven Gutter Cleaning Quote SaaS (Danmark)

## 1. Objective & Core Value Proposition

To build a plug-and-play B2B2C SaaS platform that allows Danish gutter cleaning companies ("tagrendensere") to embed a lightweight JavaScript widget on their websites. The system automatically calculates precise pricing for gutter cleaning jobs using Danish public registries (BBR) and computer vision AI on high-resolution aerial photography (SDFI), eliminating the need for manual on-site inspections.

---

## 2. Architecture & High-Level Workflow

To prevent user drop-off during heavy image processing and protect the contractor from pricing errors, the workflow is split into a **synchronous instant estimate** and an **asynchronous verified quote**.

1. Frontend: JS Widget (widget.js)

Ingen frameworks. Ren JavaScript sikrer, at tagrendemandens WordPress-, Wix- eller Shopify-side ikke bliver sløvet.

• Adresse-Autocomplete: AWS Location Service eller det danske DAWA API (styret af SDFI). DAWA er gratis, leverer officielle danske adresser og returnerer direkte det KommuneKode og Ejendomsnummer, du skal bruge til BBR-opslaget.

• UI/Komponenter: Vanilla JS + Shadow DOM. Ved at pakke widgetten ind i en Shadow DOM sikrer du, at tagrendemandens eget CSS-design på hjemmesiden ikke ødelægger din widgets knapper og felter.

• Bundling: Vite til at pakke koden i én enkelt minificeret fil, som hostes på et lynhurtigt CDN (f.eks. Cloudflare).

2. Backend API Gateway (Node.js + TypeScript)

Håndterer integrationer, API-nøgler fra kunderne, hurtige BBR-opslag og kø-styring. Node.js er eminent til asynkron I/O.

• Framework: Fastify (hurtigere end Express) skrevet i TypeScript.

• BBR & Kort-opslag: Datafordeleren.dk (SDFI). Det er her, du laver det lynhurtige synkrone kald på adressen for at hente byggeri_bebygget_areal og antal_etager til det første prisestimat.

• Message Broker / Kø-system: Redis med BullMQ. Når kunden trykker "Få fast tilbud", smider Node.js en besked i BullMQ-køen. Det er ekstremt robust, nemt at skalere og sikrer, at webserveren ikke knækker under tunge AI-kald.

• Database: PostgreSQL (Hosted på f.eks. Supabase eller Neon). Perfekt til at holde styr på kunder, API-nøgler og gemme geo-koordinater via PostGIS-udvidelsen, hvis du senere vil lave avanceret kort-matematik.

3. AI & Image Worker (Python)

Python er det eneste rigtige valg her, da alle de bedste computer vision- og geo-biblioteker ligger her.

• Framework: FastAPI + Celery. Celery overvåger Redis-køen og trækker opgaverne ind til computer vision-modellerne.

• SDFI Billed-hentning: OWSLib (Python-bibliotek til at kalde WMS/WMTS-services). Du fodrer den med koordinaterne fra DAWA, og biblioteket dumper det knivskarpe luftfoto (ortofoto) og skråfoto ned som en PNG/TIFF-fil til AI'en.

• Tag-Segmentering (AI): Ultralytics YOLOv8-seg eller Meta SAM (Segment Anything Model).

• Anbefaling: Start med en pre-trained YOLOv8-seg, som du finetuner på 500-1000 danske luftfotos, hvor du manuelt har tegnet tagkanter op. Den er ekstremt hurtig (kører på få millisekunder) og kan let køre på en billig CPU-server i starten, så du slipper for dyre GPU-regninger.

• Træ-detektion (Risiko): OpenCV + Grøn-segmentering (HSV color masking). Du behøver faktisk ikke en tung AI til at finde træer. OpenCV kan analysere billedet rundt om husets tagkant og tælle mængden af dybgrønne/brune pixels. Hvis den grønne farve (træer) overlapper tagkanten, trigger det automatisk dit risiko-tillæg.

4. Admin Dashboard (Mester-Panel)

Hvor tagrendemanden godkender tilbuddene på farten fra sin telefon.

• Frontend: Next.js (React) eller Vue 3 (Vite) hostet på Vercel.

• Kort-visning: Mapbox GL JS eller Leaflet. Her indlæser du SDFI-luftfotoet som baggrund og tegner den polygon (linje), som din Python-AI har beregnet, ovenpå i et farvet lag. Mester skal kunne trække i linjens punkter, hvis AI'en har ramt 2 meter forkert.

• Notifikationer & Kommunikation:

• SMS-afsendelse: GatewayAPI (dansk, pålideligt og billigt). Bruges til at sende push-notifikationer til mester ("Nyt tilbud klart") og det endelige tilbud til kunden.

• E-mail: Resend eller SendGrid til pæne, HTML-formaterede tilbuds-PDF'er