# Deploying the backend to the VPS

The backend ships as a Docker Compose stack (`server/docker-compose.yml`):

| Service   | Role                                                        | Public? |
| --------- | ----------------------------------------------------------- | ------- |
| `db`      | PostgreSQL + PostGIS                                        | No (internal only) |
| `app`     | Node/Express API (built from `Dockerfile`), listens on 8000 | No (behind nginx) |
| `nginx`   | TLS termination + reverse proxy, ports 80/443              | **Yes** |
| `certbot` | Issues + auto-renews the Let's Encrypt certificate          | No |

Public domain: **`api.juroc.tech`** (configured in `nginx/conf.d/app.conf` and `init-letsencrypt.sh`).

On a **new** database the schema is created on first boot via
`sequelize.sync({ alter: false })` (`src/index.ts`). Specialization reference data
is seeded on every startup (`seedSpecializations()` in `src/index.ts`).

On an **existing** database `sync` creates missing tables but never alters
existing ones, so a new column on a table that is already there will NOT appear.
Those changes ship as manual SQL in `server/migrations/`, and each one must be
run once per environment — **before** the build that depends on it starts. See
[Migrations](#migrations).

---

## Prerequisites (one-time)

1. **Docker + Compose plugin** installed on the VPS.
2. **DNS**: an `A` record `api.juroc.tech → <VPS public IP>`, live *before* step 4
   (certbot validates over HTTP).
3. **Firewall**: open ports **80** and **443**, e.g. `sudo ufw allow 80,443/tcp`.
   Do not expose Postgres (5432) — it stays on the internal Docker network.

---

## First deploy

```bash
# 1. Get the code
git clone <your-repo-url>
cd Salvio/server

# 2. Create the production .env (NOT in git — use .env.example as the template)
#    Fill in real values. Key fields:
#      - NODE_ENV=production, PORT=8000, TRUST_PROXY=true
#      - DB_USER / DB_PASS / DB_NAME  (compose uses these for BOTH the db
#        container and the app connection; leave DB_HOST alone — compose sets it to `db`)
#      - JWT_SECRET, JWT_RESET_SECRET, CHECKIN_CODE_SECRET  (long random strings)
#      - Cloudflare R2: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET,
#        S3_ENDPOINT, S3_PUBLIC_URL
#      - Stripe keys + plan price ids (STRIPE_PRICE_ID_1M/3M/6M/12M)
#      - SMTP, RevenueCat, GOOGLE_PLACES_API_KEY
nano .env

# 3. Build the images
docker compose build

# 4. Obtain the first TLS certificate (once).
#    Vars in init-letsencrypt.sh are already set (api.juroc.tech + email).
#    Tip: set staging=1 in the script for a dry run first, then rerun with staging=0.
chmod +x init-letsencrypt.sh
./init-letsencrypt.sh

# 5. Start the full stack
docker compose up -d

# 6. Verify
docker compose ps            # everything up / db healthy
docker compose logs -f app   # expect DB connect + sync, no missing-env errors
curl -I https://api.juroc.tech
```

> If the `app` container exits on boot, it is almost always a **missing required
> env var** — the S3 config and `getRequiredEnv()` throw hard and name the
> variable in the log.

Then point the mobile app at it: set `EXPO_PUBLIC_API_URL=https://api.juroc.tech`
in `frontend/.env` and restart Expo with `npx expo start -c`.

---

## Seeding data

**Specializations** — automatic on every startup, nothing to run.

**Gyms** — run once after the stack is up. By default it inserts 5 sample gyms;
set the import flags for real data.

```bash
# Sample/fallback gyms (5 records):
docker compose exec app npm run seed:gyms:prod

# Real Romania gyms from OpenStreetMap (free, no key):
docker compose exec -e IMPORT_OSM_ROMANIA=1 app npm run seed:gyms:prod

# Real Romania gyms from Google Places (requires GOOGLE_PLACES_API_KEY in .env):
docker compose exec -e IMPORT_GOOGLE_PLACES_ROMANIA=1 app npm run seed:gyms:prod
```

The gym seed is idempotent (`findOrCreate`), so it is safe to re-run.

> `seed:trainer-specializations` is **demo data** (hardcoded trainer ids 1–5) and
> is intended for local development only — do not run it in production.

---

## Redeploying after code changes

```bash
git pull
# If this pull brings a new file in migrations/, run it FIRST — see below.
docker compose build app
docker compose up -d app
```

---

## Migrations

`sequelize.sync({ alter: false })` adds new *tables* but never new *columns* on a
table that already exists. Anything else is a numbered SQL file in
`server/migrations/`, applied by hand, once per environment:

| File | Adds |
| ---- | ---- |
| `001_add_trainer_image_category.sql` | `trainer_images.category` |
| `002_add_trainer_slug.sql` | `trainer_profiles.slug` |
| `003_add_app_release_notes.sql` | `app_release_notes` table |
| `004_add_trainer_gym_staff.sql` | `trainer_gyms.staff_*` (gym-staff affiliation) |

```bash
set -a; source .env; set +a
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/004_add_trainer_gym_staff.sql
```

**Order matters.** Run the migration *before* starting the build that uses it.
Start the app first and every query touching the changed table fails with
`column does not exist` until you catch up — for `004` that is the whole gym map,
a main screen. All migration files are idempotent, so re-running one is safe.

---

## TLS certificates

Let's Encrypt certificates last 90 days. The `certbot` container renews them on a
12-hour loop, and `nginx` reloads every 6 hours to pick up new files — so in
normal operation there is nothing to do on redeploys.

**That automation is only as alive as the `certbot` container.** It carries
`restart: unless-stopped` for exactly this reason; if it is ever missing,
renewals stop silently and the first symptom is the API going offline when a
certificate expires. Verify it is running after any change to the stack:

```bash
docker compose ps -a | grep certbot     # must show Up, not Exited or absent
```

Check expiry dates for every domain, and renew by hand if needed:

```bash
docker compose run --rm --entrypoint certbot certbot certificates
docker compose run --rm --entrypoint certbot certbot renew
docker compose exec nginx nginx -s reload
```

The `--entrypoint certbot` override is required: the service's own entrypoint is
the renewal loop, which would otherwise swallow the arguments.

Four lineages are in use — `api.juroc.tech`, `dev-api.juroc.tech`, `juroc.tech`
and `salvio.juroc.tech`. A renewal failure on any one of them takes down whatever
depends on it, so check all four, not just the API.

## Useful operations

```bash
docker compose logs -f app           # tail API logs
docker compose restart app           # restart just the API
docker compose down                  # stop the stack (keeps the db volume)
docker compose exec db psql -U "$DB_USER" -d "$DB_NAME"   # open a psql shell
```

Postgres data persists in the `postgres_data` Docker volume; certificates persist
in `certbot_conf`. Neither is removed by `docker compose down` (only by
`docker compose down -v`, which **deletes the database** — avoid in production).
