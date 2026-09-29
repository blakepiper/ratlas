#!/usr/bin/env bash
set -euo pipefail

if [[ -z ${GUIX_ENVIRONMENT:-} ]]; then
  printf 'Enter the development environment with ./ratlas-guix.\n' >&2
  exit 2
fi

export RATLAS_DEV_SHELL=1
export RATLAS_DEV_PLATFORM=guix
export RATLAS_NODE_VERSION=24.18.0
export RATLAS_PNPM_VERSION=10.34.0
export RATLAS_PLAYWRIGHT_VERSION=1.59.1
export RATLAS_TEST_BROWSER=firefox
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Only the explicitly prepared, matched project-local Firefox bundle is used.
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.ratlas/firefox-runtime"
export npm_config_build_from_source=true
export npm_config_force_build=1
export npm_config_jobs=2
export npm_config_nodedir
npm_config_nodedir=$(dirname -- "$(dirname -- "$(readlink -f -- "$(command -v node)")")")
export npm_config_python
npm_config_python=$(command -v python3)

if (( $# == 0 )); then
  exec bash --noprofile --norc
fi
exec "$@"
