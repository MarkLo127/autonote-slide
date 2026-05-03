# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AutoNote&Slide** is an AI-powered PDF analysis system that converts PDF documents into structured summaries with word clouds. It uses a Next.js 15 frontend and FastAPI backend communicating via NDJSON streaming.

## Development Commands

### Frontend
```bash
pnpm -C frontend i          # Install dependencies
pnpm -C frontend dev        # Start dev server (Turbopack)
pnpm -C frontend build      # Build for production
pnpm -C frontend lint       # Run ESLint
```

### Backend
```bash
conda create -n autonote python=3.12
conda activate autonote
pip install -r backend/requirements.txt
python -m backend            # Start with auto-reload
```

### Docker (Full Stack)
```bash
docker compose up -d         # Start both services
docker compose down -v       # Stop and remove volumes
```

## Architecture

**Frontend** (`frontend/src/`) — single-page Next.js app with one main component (`app/page.tsx`) that handles file upload, NDJSON stream parsing, and PDF report generation via `pdf-lib`. State is managed entirely with React hooks.

**Backend** (`backend/app/`) — layered FastAPI application:
- `routes/` — HTTP endpoints (`POST /analyze`, `GET /health`)
- `services/analyze/` — core pipeline: `page_classifier.py` → `summary_engine.py` → concurrent OpenAI calls via `llm_client.py`
- `services/nlp/` — language detection, keyword extraction (jieba for Chinese, NLTK for English)
- `services/wordcloud/` — word cloud generation with CJK font support
- `services/parsing/` — PyMuPDF-based PDF text/image extraction
- `core/config.py` — path configuration and auto-discovery of CJK fonts in `backend/assets/fonts/`

**Data flow**: PDF upload → parse pages → classify pages (skip covers/TOC/refs) → concurrent LLM summarization → global summary → keyword extraction → word cloud → StreamingResponse (NDJSON)

**Streaming protocol**: Backend returns `application/x-ndjson`. Each line is either `{"type":"progress","progress":N,"message":"..."}` or `{"type":"result","progress":100,"data":{...}}`.

## Key Configuration

Backend env vars: `ALLOWED_ORIGINS`, `MAX_BODY_MB` (default 50), `OPENAI_API_KEY`, `APP_HOST`, `APP_PORT`, `PORT` (Railway overrides APP_PORT).

Frontend env vars: `NEXT_PUBLIC_BACKEND_URL` (backend API base URL), `PORT` (default 3000).

Font discovery: `config.py` auto-scans `backend/assets/fonts/` for CJK fonts, preferring NotoSansTC/NotoSansCJK/SourceHanSans. Override with `FONT_ZH_PATH` env var.

Storage: uploaded PDFs go to `storage/uploads/`, word cloud images to `storage/wordclouds/` — both served as static files.
