# syntax=docker/dockerfile:1

FROM python:3.11-slim

WORKDIR /app

# Install system build deps (only if needed by your Python libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY application.py .
COPY database ./database

# Create non-root user
RUN groupadd -r appuser && useradd -m -g appuser appuser

# Fix permissions
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 5000

CMD ["python", "application.py"]