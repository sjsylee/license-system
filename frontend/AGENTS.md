<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend AGENTS.md — LicenseOS Frontend Playbook

Frontend-specific guidance for autonomous coding agents working in `frontend/`.
Apply this file **together with** `../AGENTS.md`.

## 1) Frontend structure (current)

- `app/`: Next.js App Router pages/layouts
  - `app/layout.tsx`: root layout, theme/provider wiring, metadata
  - `app/page.tsx`: landing page
  - `app/login/page.tsx`: login UI
  - `app/admin/**`: admin routes
- `components/`: reusable UI components (`AdminShell`, `ThemeToggle`, etc.)
- `lib/`: client-side domain helpers (`api.ts`, `auth.ts`, `utils.ts`)
- `public/`: static assets
- Config files:
  - `package.json`
  - `tsconfig.json`
  - `eslint.config.mjs`
  - `next.config.ts`
  - `postcss.config.mjs`

## 2) Commands you should actually run

Run from `frontend/`.

- Install dependencies: `npm ci`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Build (CI parity): `NEXT_PUBLIC_API_URL=http://localhost:8001 npm run build`
- Start production build: `npm run start`

Notes:
- CI uses Node 20 and `npm ci`.
- Build depends on `NEXT_PUBLIC_API_URL`; set it when validating locally.

## 3) Testing status and single-test execution

Current frontend state:
- No `test` script in `package.json`
- No test framework config (`vitest`, `jest`, `playwright`)
- No `*.test.ts(x)` or `*.spec.ts(x)` test files

Implication:
- There is currently no frontend-native “run all tests” command.
- There is currently no frontend-native “run single test” command.

If you add tests in a PR, add all of the following in the same PR:
- framework setup/config
- `package.json` scripts (`test`, optional `test:watch`)
- single-test usage documentation
- CI workflow update (if tests should run in CI)

## 4) TypeScript and typing conventions

- `strict: true` is enabled (`tsconfig.json`).
- Use explicit domain types from `lib/api.ts` where possible.
- Keep API helpers strongly typed (`request<T>()`, typed response models).
- Avoid introducing new `any` usage.
  - Existing `catch (e: any)` appears in legacy admin pages; do not spread this pattern.

## 5) Import and module conventions

- Use alias imports via `@/*` for internal modules.
- Prefer import grouping order:
  1. framework/external packages
  2. alias imports (`@/...`)
  3. relative imports (`./`, `../`)
- Use `import type` for type-only imports when practical.

## 6) Next.js component conventions

- Client components must include top-level `"use client";`.
- Server layout files (`app/layout.tsx`) can remain server components unless client-only APIs are required.
- Keep route-level UI logic in `app/**/page.tsx` and shared layout/navigation logic in `components/`.

## 7) Styling and UI conventions

- Primary UI layer is Ant Design (`antd`) with custom inline style objects.
- Design token usage is common: `theme.useToken()` and token-driven colors/spacing.
- Tailwind is installed and used mostly at global/base layer (`app/globals.css`), not as dominant page-level utility styling.
- For consistency in this codebase:
  - match existing AntD component composition
  - prefer explicit styles over introducing a new styling system

## 8) API/auth usage patterns (frontend)

- API base URL comes from `NEXT_PUBLIC_API_URL` with localhost fallback.
- `lib/api.ts` centralizes HTTP calls and throws `ApiError` on failures.
- `lib/auth.ts` handles in-memory access token + refresh flow.
- Standard UI error pattern: catch API errors and surface via AntD `message.error`.

## 9) Naming conventions

- Components/types/interfaces: `PascalCase`
- Variables/functions/hooks: `camelCase`
- Route segments and folder names: lowercase by Next.js route conventions
- Keep names domain-oriented (`programApi`, `licenseApi`, `refreshAccessToken`, etc.)

## 10) Lint and quality expectations

- Lint config extends:
  - `eslint-config-next/core-web-vitals`
  - `eslint-config-next/typescript`
- Ignore defaults include `.next/**`, `out/**`, `build/**`, `next-env.d.ts`.
- Before finishing frontend work, run:
  1. `npm run lint`
  2. `NEXT_PUBLIC_API_URL=http://localhost:8001 npm run build`

## 11) Environment variables used by frontend

- Required in practice:
  - `NEXT_PUBLIC_API_URL`
- Example local value:
  - `NEXT_PUBLIC_API_URL=http://localhost:8001`

Never commit secrets. Keep local env values in `.env.local`.

## 12) PR hygiene for frontend changes

- Keep changes scoped to frontend modules unless cross-layer change is required.
- If you change API contract usage, update both UI calls and related types in `lib/api.ts`.
- If you introduce a new dependency, justify it and keep bundle impact minimal.
- Avoid opportunistic refactors unrelated to the requested task.
