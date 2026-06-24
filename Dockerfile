# syntax=docker/dockerfile:1
# API image: build from repository root so COPY sees application.py and requirements.txt.
#   docker build -t chon-api .

FROM python:3.11-slim

WORKDIR /app

# No build-essential: prefer manylinux wheels (--prefer-binary). Re-add apt gcc only if pip must compile.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

# Runtime only needs application.py (SQL lives in repo / DB, not read from filesystem in API).
COPY application.py .

# Create non-root user
RUN groupadd -r appuser && useradd -m -g appuser appuser

# Fix permissions
RUN chown -R appuser:appuser /app

USER appuser

# ECS / Cloud Run / Beanstalk often set PORT (must never be empty — gunicorn exits: "'' is not a valid port number").
ENV PORT=5000
EXPOSE 5000

# Production WSGI (same target as Procfile: application:application). ${PORT:-5000} survives empty PORT from task defs.
# Single worker by default: two workers duplicate app memory and can OOM small Fargate allocations.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 4 --timeout 120 application:application"]
