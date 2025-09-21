#!/usr/bin/env bash
set -e
# Default port 8000
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
