# Alternative path to the same API image. Build from **repository root** — not from backend/.
#   docker build -f backend/Dockerfile -t chon-api .
#
# application.py lives at the repo root; there is no app.py here. A previous version used
# `gunicorn app:app`, which fails because the Flask app object is `application` in application.py.

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

COPY application.py .

RUN groupadd -r appuser && useradd -m -g appuser appuser
RUN chown -R appuser:appuser /app

USER appuser

ENV PORT=5000
EXPOSE 5000

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 4 --timeout 120 application:application"]
