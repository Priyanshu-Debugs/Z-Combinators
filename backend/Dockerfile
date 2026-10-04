# ========================================================
# Z-Combinators Backend Dockerfile (Render Free Tier 512MB RAM)
# ========================================================
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies for psycopg2 and C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final lean runtime stage
FROM python:3.11-slim as runner

WORKDIR /app

# Install runtime PostgreSQL client library
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY app/ ./app/
COPY main.py ./main.py
COPY chroma_data/ ./chroma_data/

# Environment defaults
ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    CHROMA_PERSIST_DIR=/app/chroma_data

EXPOSE 8000

# Health check to monitor cold starts and service readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
