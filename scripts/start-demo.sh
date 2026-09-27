#!/usr/bin/env bash
set -euo pipefail

source scripts/ensure-deps.sh
exec pnpm demo "$@"
