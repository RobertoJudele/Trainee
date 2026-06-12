#!/usr/bin/env bash
# Run this ONCE on the VPS, after `docker compose build`, to obtain the first
# Let's Encrypt certificate. After this, the certbot container auto-renews and
# nginx auto-reloads. Re-running it replaces the existing certificate.
#
# IMPORTANT: edit the two variables below, and make sure your domain's DNS
# A record already points at this server (certbot validates over HTTP).
set -e

# ===== EDIT THESE =====
domain="api.juroc.tech"
email="robertojudele@juroc.tech"   # used for expiry/security notices from Let's Encrypt
staging=0                # set to 1 to test first (staging avoids rate limits)
# ======================

compose="docker compose"

echo "### Downloading recommended TLS parameters ..."
$compose run --rm --entrypoint "\
  sh -c 'mkdir -p /etc/letsencrypt && \
  wget -O /etc/letsencrypt/options-ssl-nginx.conf https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf && \
  wget -O /etc/letsencrypt/ssl-dhparams.pem https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem'" certbot

echo "### Creating a dummy certificate so nginx can boot ..."
$compose run --rm --entrypoint "\
  sh -c 'mkdir -p /etc/letsencrypt/live/$domain && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$domain/privkey.pem \
    -out /etc/letsencrypt/live/$domain/fullchain.pem \
    -subj /CN=localhost'" certbot

echo "### Starting nginx ..."
$compose up -d nginx

echo "### Removing the dummy certificate ..."
$compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domain /etc/letsencrypt/archive/$domain /etc/letsencrypt/renewal/$domain.conf" certbot

echo "### Requesting the real Let's Encrypt certificate ..."
staging_arg=""
if [ "$staging" != "0" ]; then staging_arg="--staging"; fi

$compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    --email $email \
    -d $domain \
    --rsa-key-size 4096 \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

echo "### Reloading nginx with the real certificate ..."
$compose exec nginx nginx -s reload

echo "### Done. https://$domain should now be live."
