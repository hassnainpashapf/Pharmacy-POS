FROM python:3.12-slim

WORKDIR /app

# Install curl and sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends curl sqlite3 && rm -rf /var/lib/apt/lists/*

COPY mobile_server.py /app/mobile_server.py
COPY __init__.py /app/__init__.py

# Create data directory for persistent SQLite database
RUN mkdir -p /app/data && chmod 700 /app/data

ENV MOBILE_HOST=0.0.0.0
ENV MOBILE_PORT=8787
ENV MOBILE_DB=/app/data/inventory.sqlite3
ENV MOBILE_ORIGINS=https://pharmacy-pos.ellahabad.workers.dev,https://pharmacy-api.150.230.52.29.sslip.io,http://pharmacy-api.150.230.52.29.sslip.io,http://localhost:5173,http://127.0.0.1:5173,http://150.230.52.29:8787,http://150.230.52.29,http://localhost:8787,http://127.0.0.1:8787

EXPOSE 8787

VOLUME ["/app/data"]

CMD ["python3", "/app/mobile_server.py"]
