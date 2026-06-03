#!/usr/bin/env bash
# Production deploy — run on the VPS (manually or via GitHub Actions SSH).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/WhatsApp-audit}"
BRANCH="${DEPLOY_BRANCH:-main}"
PM2_APP="${PM2_APP:-g6-audit}"
HEALTH_PORT="${PORT:-3010}"

echo "==> Deploying in ${APP_DIR} (branch ${BRANCH})"
cd "${APP_DIR}"

if [[ ! -f package.json ]]; then
  echo "ERROR: package.json not found in ${APP_DIR}" >&2
  exit 1
fi

if [[ ! -f .env.production ]]; then
  echo "ERROR: .env.production missing — create it once on the VPS (not in git)" >&2
  exit 1
fi

echo "==> Git: fetch and reset to origin/${BRANCH}"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "==> npm ci"
npm ci

echo "==> npm run build"
npm run build

echo "==> PM2 restart ${PM2_APP}"
if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
  pm2 restart "${PM2_APP}" --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "==> Health check"
sleep 2
if curl -sf -o /dev/null "http://127.0.0.1:${HEALTH_PORT}/login"; then
  echo "==> OK: http://127.0.0.1:${HEALTH_PORT}/login"
else
  echo "WARN: login endpoint did not return success — check: pm2 logs ${PM2_APP}" >&2
  exit 1
fi

echo "==> Deploy finished"
