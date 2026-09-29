#!/usr/bin/env bash
set -euo pipefail
if [[ ${RATLAS_DEV_PLATFORM:-} != guix ]]; then
  printf 'Use ./ratlas-guix bash scripts/prepare-firefox-runtime.sh\n' >&2
  exit 2
fi
mkdir -p .ratlas/firefox-artifact
guix build --max-jobs=0 --root=.ratlas/firefox-artifact/runtime-root patchelf gtk+ nss nspr alsa-lib libxt libx11 libxcb \
  libxcomposite libxcursor libxdamage libxext libxfixes libxi libxrandr \
  libxrender libxshmfence mesa > .ratlas/firefox-artifact/lib-paths.txt
archive=.ratlas/firefox-artifact/firefox-1511.zip
if [[ ! -f "$archive" ]]; then
  curl --fail --location --max-time 120 --silent --show-error \
    https://cdn.playwright.dev/dbazure/download/playwright/builds/firefox/1511/firefox-ubuntu-22.04.zip \
    --output "$archive"
fi
python3 scripts/prepare-firefox-runtime.py
