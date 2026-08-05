# Task: run dev and prod on the one VPS

A task brief, written to be handed to an engineer or an agent with no prior
context. Everything here was verified against the repo — file paths and line
references are real. Read §2 before touching anything.

---

## 1. Goal

Stand up a second, isolated **development** backend on the existing VPS, so dev
and prod share one box without sharing data, credentials, or billing state.

**Do not buy a second VPS.** nginx is already the only public entrypoint and
already fronts more than one app (`juroc-site-api`), so a second stack is a
config change, not new infrastructure. Extra cost is ~300 MB RAM.

**Definition of done:** `https://dev-api.juroc.tech` serves the API from its own
database, its own secrets, and its own RevenueCat project, and a user created on
dev does not exist in prod.

---

## 2. Non-negotiable constraints

Read these first. Two of them can cause real damage.

### 2.1 A separate RevenueCat project for dev is mandatory

The RevenueCat App User ID is `String(user.id)` — set in
`frontend/app/_layout.tsx:86` and consumed server-side in
`server/src/services/billing/BillingService.ts:76`.

Two databases mean two independent `id` sequences. Pointing both environments at
the same RevenueCat project makes **dev user 7 and prod user 7 the same
customer**. Testing the founding-trainer grant on dev would hand a real
production trainer three months free; a dev revoke would strip a real one.

Use a separate RevenueCat project for dev. It is env vars only — no code change.
Namespacing the ID instead (`dev_7`) would require touching `Purchases.logIn`,
`fetchSubscriber`, and the webhook parser, which is far more surface for the same
result. Do not do that.

### 2.2 The dev DB user must not be able to reach the prod database

`server/src/tests/setup.ts:16` runs `sequelize.sync({ force: true })`, which
drops every table. `server/src/db.ts:32` picks the database purely from
`DB_NAME`. A single mistyped env var is enough to wipe production.

Grant the dev user rights on `trainee_dev` only, and revoke `CONNECT` on
`trainee` from `PUBLIC` (see the SQL in Phase 1 — revoking from `dev_app` alone
does nothing), so a misconfiguration fails with a permission error instead of
destroying data.

### 2.3 Dev and prod share the R2 bucket (accepted, not solved)

`.env.dev` reuses prod's `AWS_*` / `S3_*` values, so images uploaded on dev land
in the production bucket and are served from the production public URL. This is
a deliberate trade, not an oversight — but it is the one place where "dev and
prod share no data" is untrue.

What it does not break: object keys are UUIDs (`config/s3.ts` uses `uuidv4`), so
there are no collisions and dev cannot overwrite or delete a prod object.

What it does mean: dev test images accumulate in the prod bucket and are
publicly reachable on the prod CDN domain, and storage cost is shared. If that
becomes a problem, create a `trainee-assets-dev` bucket and give `.env.dev` its
own `AWS_S3_BUCKET` and `S3_PUBLIC_URL`. Nothing in the code needs changing.

### 2.4 Never run `docker compose down -v`

It deletes the shared `postgres_data` volume — **both** databases. Already
flagged in `server/DEPLOY.md:123`.

---

## 3. Current state (verified)

| Thing | Where |
|---|---|
| Compose stack: `db`, `app`, `nginx`, `certbot`, `juroc-site-api` | `server/docker-compose.yml` |
| Postgres 16 + PostGIS, **no published ports** | `server/docker-compose.yml` service `db` |
| nginx server blocks for `api.juroc.tech` | `server/nginx/conf.d/app.conf` |
| TLS bootstrap script | `server/init-letsencrypt.sh` |
| Multi-stage Node 20 build | `server/Dockerfile` |
| Prod env | `server/.env` (gitignored), template in `.env.example` |
| Deploy runbook | `server/DEPLOY.md` |
| App build profiles | `frontend/eas.json` |

Compose lives at `~/Trainee/server` on the VPS. DB container is `trainee_db`,
superuser `postgres` (compose's `POSTGRES_USER` default — `.env` does not set
`DB_USER`), prod database `trainee`.

Known wart to fix along the way: `frontend/eas.json`'s `preview` profile points
at production (`https://api.juroc.tech`) with production RevenueCat keys —
identical to the `production` profile. "Preview" builds are hitting live data
today.

---

## 4. Tasks

Ordered so nothing blocks anything after it.

### Phase 0 — Prerequisites

- [ ] Choose the hostname. This brief assumes `dev-api.juroc.tech`.
- [ ] Add a DNS **A record** → the VPS IP. Do this first and let it propagate;
      certbot fails without it.
- [ ] Create a **new RevenueCat project** for dev (see §2.1). Inside it create an
      entitlement whose identifier is exactly `Trainee Pro` — same string as
      prod, different project. Record its secret key and Apple/Google SDK keys.
- [ ] `free -h` — confirm ~300 MB headroom.

### Phase 1 — Database

- [ ] As superuser (`docker compose exec db psql -U postgres -d postgres`):

```sql
CREATE DATABASE trainee_dev OWNER postgres;
CREATE USER dev_app WITH PASSWORD '<pick-one>';
GRANT ALL PRIVILEGES ON DATABASE trainee_dev TO dev_app;
-- §2.2 guardrail. Must target PUBLIC, not dev_app: Postgres grants CONNECT on
-- every database to PUBLIC by default, and a privilege held via PUBLIC is not
-- removed by revoking it from an individual role. Revoking from dev_app alone
-- leaves it able to connect to prod. Safe for prod: `postgres` is the superuser
-- and bypasses privilege checks.
REVOKE CONNECT ON DATABASE trainee FROM PUBLIC;
```

- [ ] Reconnect to the new database (`\c trainee_dev`) and run:

```sql
GRANT ALL ON SCHEMA public TO dev_app;    -- required on PG15+
CREATE EXTENSION IF NOT EXISTS postgis;   -- superuser only; the app cannot self-serve this
```

The extension must be created here. `ensureDatabaseExtensions()` runs at app
boot but a non-superuser cannot `CREATE EXTENSION postgis`; pre-creating it makes
that call a harmless no-op.

### Phase 2 — Dev env file

- [ ] Create `server/.env.dev` from `.env`. **Gitignored — never commit it.**

| Var | Value |
|---|---|
| `DB_NAME` | `trainee_dev` |
| `DB_USER` / `DB_PASS` | `dev_app` / password from Phase 1 |
| `DB_HOST` | `db` |
| `NODE_ENV` | `development` |
| `REVENUECAT_SECRET_API_KEY` | dev project secret key |
| `REVENUECAT_ENTITLEMENT_ID` | `Trainee Pro` |
| `REVENUECAT_WEBHOOK_AUTH` | a fresh value |
| `STRIPE_*` | test-mode keys |
| `SMTP_USER` / `SMTP_PASS` | blank or a throwaway inbox |
| `AWS_*` / `S3_*` | copied from prod — shared bucket, see §2.3 |
| `JWT_SECRET`, `JWT_RESET_SECRET`, `CHECKIN_CODE_SECRET` | **different from prod** |

Different JWT secrets matter: shared ones let a dev token authenticate against
prod. Blank SMTP matters because the app sends real verification email on signup.

### Phase 3 — Compose service

- [ ] Add an `app-dev` service to `server/docker-compose.yml`, mirroring `app`:
      same `build: .`, `container_name: trainee_api_dev`, `env_file: .env.dev`,
      `environment: DB_HOST: db`, `depends_on: db (service_healthy)`,
      `restart: unless-stopped`, `expose: "8000"`.
- [ ] **No `ports:` mapping.** nginx stays the only public entrypoint.

### Phase 4 — nginx and TLS

Order matters: an HTTPS block referencing a cert that does not exist yet makes
nginx fail to start, taking prod down with it.

- [ ] Add only the **HTTP** server block for `dev-api.juroc.tech` (ACME challenge
      + redirect), mirroring the existing one in `nginx/conf.d/app.conf`.
- [ ] `docker compose restart nginx`, then issue the cert (extend
      `init-letsencrypt.sh`, or run certbot for the new host).
- [ ] Only now add the **HTTPS** block. Copy the prod one and change:
      `server_name dev-api.juroc.tech`, the two `ssl_certificate*` paths, and
      `set $trainee_app app-dev:8000`.
- [ ] Keep `client_max_body_size 25M` and the `resolver 127.0.0.11` line — the
      first prevents 413s on image upload, the second stops nginx hard-failing
      when the app container is briefly unresolvable.
- [ ] `docker compose build app-dev && docker compose up -d app-dev && docker compose restart nginx`

### Phase 5 — App build profile

- [ ] In `frontend/eas.json`, repoint the **`preview`** profile:
      `EXPO_PUBLIC_API_URL` → `https://dev-api.juroc.tech`, and swap
      `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY` / `_GOOGLE_API_KEY` to the dev
      project's SDK keys. Leave `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` as
      `Trainee Pro`.
- [ ] Leave the `production` profile untouched.
- [ ] From then on: dev builds `--profile preview`, releases `--profile production`.

### Phase 6 — Verify

- [ ] `curl https://dev-api.juroc.tech/` → `Salvio API is running` JSON
- [ ] `docker compose logs -f app-dev` → DB connect, no missing-env errors
- [ ] `curl https://api.juroc.tech/` still works — prod unaffected
- [ ] **Isolation check.** Register a user on dev, then:
      `docker compose exec db psql -U postgres -d trainee -c "SELECT count(*) FROM users WHERE email='<dev-test>';"`
      → must be `0`
- [ ] **Guardrail check.** Confirm `dev_app` cannot read prod:
      `docker compose exec db psql -U dev_app -d trainee -c 'SELECT 1;'` → permission denied
- [ ] In the **dev** RevenueCat project, add a webhook →
      `https://dev-api.juroc.tech/billing/webhooks/revenuecat`, Authorization
      header matching `.env.dev`'s `REVENUECAT_WEBHOOK_AUTH`, environment
      including Production, event types including `NON_RENEWING_PURCHASE` and
      `EXPIRATION`.

---

## 5. Ongoing operation

```bash
# deploy dev
git pull && docker compose build app-dev && docker compose up -d app-dev

# deploy prod (unchanged)
git pull && docker compose build app && docker compose up -d app

# logs
docker compose logs -f app-dev
```

Never `docker compose down -v` (§2.4).

---

## 6. Out of scope

- The four unpushed commits on `dev` and the production rollout of the
  founding-trainer grant. That still needs `git push`,
  `REVENUECAT_ENTITLEMENT_ID=Trainee Pro` set on **prod**, and a redeploy.
- Backfilling existing trainers with the promotional grant.
- CI, staging beyond this dev box, or automated migrations.

## 7. Acceptance criteria

1. `https://dev-api.juroc.tech` responds, backed by `trainee_dev`.
2. `https://api.juroc.tech` is unchanged and still backed by `trainee`.
3. A user created on dev is absent from the prod database.
4. `dev_app` is denied access to the `trainee` database.
5. Dev uses a different RevenueCat project from prod.
6. `frontend/eas.json`'s `preview` profile targets dev; `production` targets prod.
7. No new published ports — nginx remains the only public entrypoint.
