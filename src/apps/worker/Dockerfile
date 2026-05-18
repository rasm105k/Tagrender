FROM python:3.11-slim

WORKDIR /app

# Installer systemafhængigheder til OpenCV / OpenCV-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    glib-2.0 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Kopier og installer requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Hvis du vil installere vision-specifikke pakker (YOLO osv.) med det samme:
COPY requirements-vision.txt ./
RUN pip install --no-cache-dir -r requirements-vision.txt

# Kopier kildekoden
COPY app/ ./app

EXPOSE 4020

# Start FastAPI worker API for synchronous model verification calls from the gateway.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4020"]
