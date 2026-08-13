# Paginile publice ale antrenorilor — punere în funcțiune

Runbook pentru `salvio.juroc.tech/t/<slug>`. Comenzile se rulează pe VPS, în
`~/Trainee/server`.

**Domeniu ales:** `salvio.juroc.tech`, temporar, pe domeniul deja deținut.
Structura căii e cea definitivă, deci migrarea la un domeniu propriu e o
redirecționare 301, nu o rescriere — vezi ultima secțiune.

**Începe cu dev.** Secțiunea următoare nu cere DNS, certificat sau vreo
modificare de nginx.

---

## 0. Probă pe dev-api, înainte de orice

Ruta `/t/:slug` e montată pe routerul principal, iar blocul HTTPS al lui
`dev-api.juroc.tech` are `location /` care trimite tot către `app-dev`. Deci
pagina e disponibilă acolo imediat ce containerul de dev are codul nou —
**fără A record, fără certbot, fără să atingi `salvio-web.conf`.**

Nimic din pașii ăștia nu afectează producția: bază de date separată
(`trainee_dev`), container separat, gazdă separată.

Toate comenzile `docker compose` se rulează din `~/Trainee/server` — acolo stă
`docker-compose.yml`. Rulate din `~/Trainee` sau din `frontend/`, eșuează.

```bash
cd ~/Trainee && git pull && cd server
```

Verifică întâi că pull-ul chiar a adus migrația; dacă lipsește, commit-urile nu
au ajuns pe remote:

```bash
ls migrations/002_add_trainer_slug.sql
```

**Verifică extensia de care depinde backfill-ul.** Migrația folosește
`unaccent()`; dacă lipsește, eșuează. Ar trebui să existe — `app-dev` nu ar
porni fără ea, fiindcă `ensureDatabaseExtensions` nu prinde eroarea — dar
costă o secundă:

```bash
docker compose exec db psql -U postgres -d trainee_dev \
  -c "select extname from pg_extension where extname in ('unaccent','postgis','pg_trgm');"
```

Dacă `unaccent` lipsește, creeaz-o ca superuser (`dev_app` nu are voie):

```bash
docker compose exec db psql -U postgres -d trainee_dev \
  -c "CREATE EXTENSION IF NOT EXISTS unaccent;"
```

**Migrația, pe baza de dev:**

```bash
docker compose exec -T db psql -U dev_app -d trainee_dev \
  < migrations/002_add_trainer_slug.sql
```

**Codul nou:**

```bash
docker compose build app-dev && docker compose up -d app-dev
docker compose logs -f app-dev    # confirmă pornirea curată, apoi Ctrl-C
```

**Ce slug-uri există pe dev** — baza de dev e separată, deci poate fi goală. Dacă
nu apare niciun rând, creează-ți un antrenor din aplicație pointată pe dev
(profilul `preview` din `eas.json`).

```bash
docker compose exec db psql -U dev_app -d trainee_dev \
  -c "select slug from trainer_profiles where slug is not null limit 5;"
```

**Testează:**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://dev-api.juroc.tech/t/<slug>   # 200
curl -sS -o /dev/null -w "%{http_code}\n" https://dev-api.juroc.tech/t/nu-exista # 404
curl -sS https://dev-api.juroc.tech/t/<slug> | grep -E '<title>|og:'
```

Pentru previzualizarea linkului, pune în `server/.env.dev`:

```
PUBLIC_WEB_URL=https://dev-api.juroc.tech
```

apoi `docker compose up -d app-dev`. Lipește linkul într-un mesaj de WhatsApp —
dacă apare cardul cu poză și titlu, `og:` e corect și poți trece la producție.

Când ești mulțumit, continuă cu pașii 1–6 pentru `salvio.juroc.tech`.

---

## Ordinea contează

nginx refuză să pornească dacă `ssl_certificate` arată către un fișier
inexistent, iar containerul ăsta servește **și** `api.juroc.tech`. Un bloc HTTPS
adăugat înainte de certificat **pică producția odată cu el**. De asta blocul
HTTPS din `nginx/conf.d/salvio-web.conf` e livrat comentat.

---

## Pași

### 1. DNS

Adaugă un **A record** `salvio` → IP-ul VPS-ului, în zona `juroc.tech`. Lasă-l să
se propage înainte de pasul 3; certbot eșuează dacă nu rezolvă.

Verificare:

```bash
dig +short salvio.juroc.tech
```

### 2. Migrația bazei de date

Fără ea coloana `slug` nu există, iar **crearea de antrenori se rupe** — nu doar
paginile publice.

```bash
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" \
  < migrations/002_add_trainer_slug.sql
```

Idempotentă. Verificare:

```bash
docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" \
  -c "select count(*) filter (where slug is null) as fara_slug, count(*) as total from trainer_profiles;"
```

`fara_slug` trebuie să fie 0.

### 3. Blocul HTTP și certificatul

`git pull` aduce `nginx/conf.d/salvio-web.conf` cu blocul HTTP activ și cel HTTPS
comentat.

```bash
docker compose restart nginx
curl -I http://salvio.juroc.tech/.well-known/acme-challenge/test   # 404 de la nginx = bine, ruta merge
```

Emite certificatul (aceeași metodă ca pentru celelalte gazde — vezi
`init-letsencrypt.sh`):

```bash
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d salvio.juroc.tech --email <email> --agree-tos --no-eff-email
```

### 4. Activează HTTPS

Decomentează blocul din `salvio-web.conf`, apoi:

```bash
docker compose restart nginx
curl -sS -o /dev/null -w "%{http_code}\n" https://salvio.juroc.tech/t/andrei-popescu
```

Trebuie să dea `200`. Verifică și că producția e neatinsă:

```bash
curl -sS https://api.juroc.tech/
```

### 5. Variabila de mediu

În `server/.env`:

```
PUBLIC_WEB_URL=https://salvio.juroc.tech
```

Apoi `docker compose up -d app`. Fără ea pagina se randează, dar fără `canonical`
și fără `og:url` — linkurile distribuite nu au previzualizare corectă.

`PUBLIC_APP_STORE_URL` e opțională; linkul de descărcare are valoare implicită.

### 6. Verificare finală

```bash
curl -sS https://salvio.juroc.tech/t/andrei-popescu | grep -E 'og:|canonical|<title>'
curl -sS -o /dev/null -w "%{http_code}\n" https://salvio.juroc.tech/t/nu-exista   # 404
```

Testează și previzualizarea reală: lipește linkul într-un mesaj de WhatsApp sau
într-un story. Dacă nu apare cardul cu poză, `PUBLIC_WEB_URL` sau `og:image`
lipsesc.

---

## Migrarea la domeniul propriu

Când apare `salvio.ro`, structura căii rămâne aceeași, deci:

1. DNS + certificat pentru domeniul nou, aceeași ordine ca mai sus.
2. Bloc HTTPS identic, cu `server_name salvio.ro`.
3. Schimbă `PUBLIC_WEB_URL` — `canonical` și `og:url` se mută singure.
4. **Nu șterge gazda veche.** Înlocuiește-i blocul cu o redirecționare permanentă:

```nginx
server {
    listen 443 ssl;
    server_name salvio.juroc.tech;
    ssl_certificate     /etc/letsencrypt/live/salvio.juroc.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/salvio.juroc.tech/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://salvio.ro$request_uri;
}
```

`$request_uri` păstrează calea, deci `salvio.juroc.tech/t/andrei-popescu` ajunge
la `salvio.ro/t/andrei-popescu`. Orice link pus deja într-un bio de Instagram sau
tipărit pe un afiș continuă să funcționeze, iar 301 transferă și autoritatea SEO
acumulată.

Ține redirecționarea pe termen nedefinit. Costă un bloc de nginx; alternativa e
să ceri câtorva zeci de antrenori să-și schimbe linkul din bio, ceea ce jumătate
nu vor face.
