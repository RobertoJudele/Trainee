---
description: Use for any work in this Trainee monorepo (frontend Expo app and server Express API) to enforce production-ready changes, safe edits, and mandatory documentation updates.
applyTo: "**/*.{ts,tsx,js,jsx,json,md,sql}"
---

## Project Context

- Monorepo with two apps:
	- `frontend`: Expo Router + React Native + Redux Toolkit/RTK Query
	- `server`: Express + sequelize-typescript + PostgreSQL
- Backend default port is `8000`.
- Frontend API base URL is configured in `frontend/src/constants/config.ts`.
- Core domains include auth, trainer discovery, gyms, billing, issues, and trainer scheduling.

## Primary Goals

- Prefer production-safe, minimal, and maintainable changes.
- Keep existing architecture patterns and naming conventions.
- Avoid introducing dead code, silent behavior changes, or unnecessary refactors.

## Coding Rules

- Use TypeScript style and patterns already present in the touched module.
- Make focused edits only in relevant files.
- Preserve existing public API contracts unless user explicitly asks to change them.
- Keep role-based behavior intact (`client`, `trainer`, `admin`).
- Do not hardcode secrets, tokens, API keys, passwords, or credentials.
- Never commit `.env` contents or reveal secret values in responses.

## Backend Rules

- For new backend behavior, wire all layers consistently:
	- controller logic
	- route registration
	- request validation/guards
	- response shape consistency
- Follow existing response helpers (`sendSuccess`, `sendError`) patterns.
- Reuse existing models and enums before introducing new structures.

## Frontend Rules

- Prefer existing RTK Query slices/hooks for API interactions.
- Keep screen behavior aligned with current navigation and auth flow.
- Reuse existing theme and UI patterns where possible.
- Ensure loading, empty, success, and error states are handled.

## Quality and Verification

- After edits, check diagnostics/errors for all touched files.
- If a build/test script exists, run it for the changed area.
- If script is missing, state that clearly and validate with available checks.
- Do not claim tests/build passed unless they were actually run successfully.

## Mandatory Documentation Policy

When changes are made, the agent must document them and update README.

Required behavior:

1. Update `README.md` whenever features, setup, scripts, routes, env vars, or architecture details change.
2. Document each meaningful change in an existing project doc when applicable.
3. If no specific doc exists for that area, add a concise note under the most relevant README section.
4. In final response, explicitly list which docs were updated.

## Change Communication

- Summarize what changed, why, and impacted files.
- Call out risks, assumptions, and any follow-up actions.
- Keep explanations clear and implementation-focused.
