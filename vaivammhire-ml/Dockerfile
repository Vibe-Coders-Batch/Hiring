FROM python:3.11-slim-bookworm

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl gcc \
  && rm -rf /var/lib/apt/lists/*

COPY . .
RUN pip install --no-cache-dir pip setuptools wheel hatchling \
  && pip install --no-cache-dir -e ".[api]"

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://127.0.0.1:8080/health || exit 1

CMD ["uvicorn", "inference.server:app", "--host", "0.0.0.0", "--port", "8080"]
