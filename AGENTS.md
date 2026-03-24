# AGENTS.md — LicenseOS Agent Playbook

Repository-specific guidance for autonomous coding agents.
All commands and conventions below are derived from the current codebase/config.

## 1) Repo layout

- `frontend/`: Next.js 16 + TypeScript + Ant Design + Tailwind 4
- `backend/`: FastAPI + SQLAlchemy + MariaDB
- `.github/workflows/`: CI/CD pipelines
- `docker-compose.dev.yml`: local DB for development

## 2) Source-of-truth files (read before changes)

- Frontend scripts: `frontend/package.json`
- Frontend lint: `frontend/eslint.config.mjs`
- Frontend TS rules: `frontend/tsconfig.json`
- Backend deps: `backend/requirements.txt`
- Backend entrypoint: `backend/app/main.py`
- CI files:
  - `.github/workflows/frontend-ci.yml`
  - `.github/workflows/backend-ci.yml`
  - `.github/workflows/backend-deploy.yml`
- Process docs: `README.md`, `DEV.md`

## 3) Build / lint / test commands

Run from repo root unless noted.

### Frontend (`frontend/`)

- Install: `npm ci`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Build: `NEXT_PUBLIC_API_URL=http://localhost:8001 npm run build`
- Start production build: `npm run start`

Notes:
- CI also sets `NEXT_PUBLIC_API_URL`.

### Backend (`backend/`)

- Setup venv:
  - `python -m venv venv`
  - `source venv/bin/activate`
  - `pip install -r requirements.txt`
- Run API locally:
  - `uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload`
- CI-equivalent build check:
  - `docker build ./backend`

### Local infrastructure

- Start dev DB: `docker compose -f docker-compose.dev.yml up -d`
- Check DB state: `docker compose -f docker-compose.dev.yml ps`

## 4) Test status + single-test execution

Current repo state:
- No configured test runner for frontend or backend
- No `test` script in `frontend/package.json`
- No test config (`pytest.ini`, `vitest.config.*`, `jest.config.*`, etc.)
- No test files in common patterns (`*.test.ts[x]`, `test_*.py`, etc.)

Implication:
- There is currently no project-native “run all tests” command.
- There is currently no project-native “run single test” command.

If you add a test framework in a PR, also add:
- Full test command
- Single-test command
- CI workflow update
- AGENTS.md update

## 5) Frontend code style conventions

### Type safety

- TypeScript strict mode is enabled (`strict: true`).
- Prefer explicit domain types (see `frontend/lib/api.ts`).
- Avoid introducing `any`; existing `catch (e: any)` usage is legacy and should not spread.

### Imports

- Use path alias `@/*` for internal imports (from `tsconfig.json`).
- Typical order:
  1. Framework/external libs
  2. Internal alias imports (`@/...`)
  3. Relative imports
- Use `import type` for type-only imports when practical.

### Component/file conventions

- App Router files live under `frontend/app/**/page.tsx` and `layout.tsx`.
- Shared UI in `frontend/components/`; API/auth helpers in `frontend/lib/`.
- Client components use top-level `"use client";`.
- Naming:
  - Components/types: `PascalCase`
  - variables/functions/hooks: `camelCase`

### Styling and error handling

- UI uses Ant Design heavily; inline style objects are common in admin pages.
- Tailwind is available but mostly used at global/base layer now.
- API layer throws `ApiError`; UI catches and reports via AntD `message.error`.

## 6) Backend code style conventions

### Layering and responsibilities

- `routers/`: request validation + HTTP status/exception boundaries
- `crud/`: DB read/write logic
- `schemas/`: Pydantic request/response contracts
- `models/`: SQLAlchemy entities

### Typing and modeling

- Keep full type hints on function signatures and return values.
- Use SQLAlchemy 2 typed ORM style:
  - `Mapped[...]`
  - `mapped_column(...)`
- Use Pydantic v2 style (`model_config = {...}`).

### Naming and error handling

- Python identifiers: `snake_case`
- Classes: `PascalCase`
- Module constants: `UPPER_SNAKE_CASE`
- Raise `HTTPException` with explicit status codes in routers.
- Prefer fail-fast checks before side effects.
- Avoid broad `except Exception` unless translating into explicit result payloads.

### Time/auth conventions

- Use UTC-aware datetimes (`datetime.now(timezone.utc)`).
- Keep JWT + refresh token rotation logic centralized in auth/security modules.

## 7) DB schema change rule (critical)

- Project uses `Base.metadata.create_all(...)`; Alembic migration flow is not present.
- New tables can auto-create, but altering existing tables requires manual SQL migration.
- When schema changes, update models + schemas + CRUD/router logic together.

## 8) CI alignment expectations

- Frontend CI: `npm ci` + `npm run build` in `frontend/`
- Backend CI: Docker build for `./backend` (no image push)
- Backend CD: push to `main` + backend path changes triggers deploy workflow

## 9) Security/secrets rules

- Never commit `.env`, tokens, or credentials.
- Use `.env.example` only as templates.
- Keep auth cookie behavior aligned with current backend policy.

## 10) Cursor / Copilot instruction files

Checked and found none at:
- `.cursorrules`
- `.cursor/rules/**`
- `.github/copilot-instructions.md`

If these files are added later, this AGENTS.md must be updated.

## 11) Existing frontend-local AGENTS rule

- `frontend/AGENTS.md` contains a Next.js warning:
  - This Next.js version may differ from model priors.
  - Read docs in `node_modules/next/dist/docs/` when changing Next APIs.
- Apply both files when working inside `frontend/`.
