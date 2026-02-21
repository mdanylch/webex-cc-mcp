# Build context: repo root. Builds the Python MCP server only.
FROM python:3.12-slim

WORKDIR /app

RUN useradd -m -u 1000 appuser

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/lib/ ./lib/
COPY server/main.py .

ENV PORT=8080
EXPOSE 8080

USER appuser

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
