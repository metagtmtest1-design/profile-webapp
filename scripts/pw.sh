#!/usr/bin/env sh
# Runs a Playwright script against the Docker dev stack.
#
# Playwright is not a project dependency. It lives in a cached module dir and is bind
# mounted package-by-package into node_modules — NODE_PATH does not apply to ESM
# imports, so `import { chromium } from 'playwright'` only resolves from there. Inside
# the compose network the app answers on http://frontend:5173, not localhost.
#
#   ./scripts/pw.sh scripts/uiux-round1.mjs
#
# Screenshots written to /app/tmp-e2e/ land in ./tmp-e2e/ on the host.
set -e

PW_CACHE="$HOME/.cache/pw-modules"
if [ ! -d "$PW_CACHE/node_modules/playwright" ]; then
  mkdir -p "$PW_CACHE"
  docker run --rm -v "$PW_CACHE":/pw -w /pw mcr.microsoft.com/playwright:v1.50.0-noble \
    npm install playwright@1.50.0 --no-audit --no-fund --silent
fi

mkdir -p "$(pwd)/tmp-e2e"

exec docker run --rm \
  --network profile-webapp_portfolio-net \
  -v "$(pwd)":/app \
  -v "$PW_CACHE/node_modules/playwright":/app/node_modules/playwright \
  -v "$PW_CACHE/node_modules/playwright-core":/app/node_modules/playwright-core \
  -w /app \
  mcr.microsoft.com/playwright:v1.50.0-noble \
  node "$@"
