#!/usr/bin/env bash

if [[ ! -x node_modules/.bin/tsc || ! -x apps/web/node_modules/.bin/vite ]]; then
  pnpm install --frozen-lockfile
fi
