# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LicenseOS is a monorepo license management system with a FastAPI backend, Next.js frontend, Nginx reverse proxy, and MariaDB database. It handles license key issuance, HWID-based device fingerprinting, and a public validation API used by desktop clients.

## Development Commands

### Local Infrastructure (start first)
```bash
docker compose -f docker-compose.dev.yml up -d    # Start dev DB (MariaDB on port 3307)
```

### Backend (from `backend/`)
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend (from `frontend/`)
```bash
npm ci
npm run dev          # Dev server on port 3000
npm run build        # Production build (requires NEXT_PUBLIC_API_URL env var)
npm run lint         # ESLint
```

There is currently **no test framework configured** for either frontend or backend.

## Architecture

```
Desktop Client ──→ POST /v1/validate (public, always HTTP 200)
Admin Console  ──→ Authenticated REST API (Bearer token)
                        ↓
              Next.js (Vercel)  ←→  FastAPI + Uvicorn
                                         ↓
                                    MariaDB 11
                        ↓
              Cloudflare Tunnel → Nginx (rate-limit, headers) → FastAPI
```

**Key design decisions:**
- The `/v1/validate` endpoint always returns HTTP 200 with `valid: true/false` + `error_code`. This prevents desktop app crashes on network errors and avoids exposing error semantics.
- Refresh tokens are stored as SHA-256 hashes (never plaintext). Token reuse triggers full revocation for all tokens belonging to that admin (theft detection).
- DB schema uses `create_all` (not Alembic). New tables are auto-created; **modifications to existing tables require manual `ALTER TABLE` SQL run in production**.

## Backend Code Structure

- `app/routers/` — API endpoint handlers (auth, programs, licenses, validate)
- `app/crud/` — DB operations layer; routers call CRUD, never query ORM directly
- `app/models/` — SQLAlchemy 2.x ORM (`Mapped`/`mapped_column` pattern)
- `app/schemas/` — Pydantic v2 request/response models
- `app/core/` — Config, database session, security utilities, rate limiter
- `app/dependencies.py` — FastAPI dependency injection (e.g., `get_current_admin`)

**Backend conventions:**
- All timestamps: `datetime.now(timezone.utc)` (never `datetime.utcnow()`)
- PATCH endpoints use `exclude_unset=True` semantics (only update fields explicitly sent)
- Rate limiting is in-memory (`InMemoryRateLimiter`); no Redis dependency
- Error codes for the public validate endpoint are intentionally limited to 4 values to prevent enumeration attacks

## Frontend Code Structure

- `app/` — Next.js App Router pages
- `app/admin/` — All admin dashboard routes
- `components/` — Reusable UI components
- `lib/api.ts` — API client with token refresh logic
- `lib/auth.ts` — Auth helpers
- UI: **Ant Design 6 + Tailwind CSS 4**; prefer Ant Design components for admin UI

**Frontend conventions:**
- Add `"use client"` only when needed (hooks, event handlers, browser APIs); default to Server Components
- Use `interface` over `type` for object shapes
- API calls go through `lib/api.ts`, never `fetch` directly in components
- Environment variable for API: `NEXT_PUBLIC_API_URL`

## Database Schema (Key Tables)

- `admins` + `refresh_tokens` — Admin auth
- `programs` + `program_meta_schemas` — Product definitions with typed metadata schemas
- `licenses` + `license_meta` + `devices` — License records, per-license metadata values, registered HWIDs

## Deployment

- **Frontend**: Vercel (auto-deploy on push to `main`)
- **Backend**: GitHub Actions builds Docker image → pushes to `ghcr.io` → SSH deploys to VPS via `docker compose pull && up -d --no-deps backend`
- **Infrastructure**: Cloudflare Tunnel handles HTTPS; Nginx sits in front of FastAPI for rate-limiting and security headers
- CI uses **path-based filtering**: frontend changes only trigger frontend CI, backend changes only trigger backend CI/CD

## Environment Variables

**Backend** (`backend/.env`):
```
DATABASE_URL=mysql+pymysql://license:<password>@localhost:3307/license_db
SECRET_KEY=<32+ random chars>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:8001
```
