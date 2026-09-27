#!/usr/bin/env bash
set -euo pipefail

config=$1
source scripts/ensure-deps.sh
pnpm build
pnpm db:migrate --config "$config"
printf 'Starting built ratlas API with %s; press Ctrl-C to stop.\n' "$config"
exec env NODE_ENV=production node apps/service/dist/main-api.js --config "$config"
