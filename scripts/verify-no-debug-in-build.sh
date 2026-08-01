#!/bin/sh
# The `!!!` traces carry visitor name/email; they must not survive into the bundle.
#   docker run --rm -v "$PWD":/app -w /app node:20 sh scripts/verify-no-debug-in-build.sh
set -e
npx vite build >/dev/null 2>&1
hits=$(grep -ro '!!! [A-Z_]*' dist/assets 2>/dev/null | sort -u || true)
if [ -n "$hits" ]; then
  echo "FAIL  developer traces survive into the production bundle:"
  echo "$hits" | head -10
  exit 1
fi
echo "PASS  no developer traces in the production bundle"
