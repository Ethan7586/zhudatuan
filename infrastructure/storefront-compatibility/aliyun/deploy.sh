#!/usr/bin/env bash
set -euo pipefail

repo=/opt/smart-wing
cd "$repo"

git fetch origin main
git merge --ff-only origin/main
npm ci --include=dev
npm run build

install -m 0644 infrastructure/aliyun/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

pm2 startOrReload infrastructure/aliyun/ecosystem.config.cjs --update-env
if node --env-file=/opt/smart-wing/.env.production -e "process.exit(process.env.TAIR_HOST&&process.env.TAIR_PASSWORD&&process.env.CORE_READ_CACHE_URL&&process.env.CORE_READ_CACHE_TOKEN?0:1)"; then
  pm2 startOrReload infrastructure/aliyun/ecosystem.core-cache.config.cjs --update-env
fi
pm2 save
