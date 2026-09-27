#!/usr/bin/env bash
set -euo pipefail
trap 'exit 130' INT
trap 'exit 143' TERM

config=$1
source scripts/ensure-deps.sh
pnpm build
pnpm db:migrate --config "$config"
mode=$(node --input-type=module -e \
  'import { loadConfig } from "./apps/service/dist/commands/config.js"; process.stdout.write(loadConfig(process.argv[1]).mode)' \
  "$config")
if [[ "$mode" == live ]]; then
  printf 'Refreshing configured observations once before serving…\n'
  if ! node apps/service/dist/main-collector.js --once --config "$config"; then
    printf 'ratlas refresh failed; serving previously stored observations.\n' >&2
  fi
fi
printf 'Starting built ratlas API with %s; press Ctrl-C to stop.\n' "$config"
exec env NODE_ENV=production node apps/service/dist/main-api.js --config "$config"
