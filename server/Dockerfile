# Webex Contact Center MCP Server - production image
FROM python:3.12-slim

WORKDIR /app

# Non-root user (security)
RUN useradd -m -u 1000 appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY lib/ ./lib/
COPY main.py .

# App Runner and many AWS services use port 8080
ENV PORT=8080
EXPOSE 8080

USER appuser

# Use PORT so it works with App Runner / ECS
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
