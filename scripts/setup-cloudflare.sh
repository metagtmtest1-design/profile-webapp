#!/bin/bash
set -e

# Setup Cloudflare D1 + R2 for alpha + prod (and optionally preview)
# Uses Docker to bypass host proxy (x2pagentd). Prompts for API token securely.
# Usage: ./scripts/setup-cloudflare.sh
#        CLOUDFLARE_API_TOKEN=xxx ./scripts/setup-cloudflare.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Portfolio Cloudflare Setup (D1+R2) ===${NC}"
echo "This will create D1 databases + R2 buckets for alpha + prod via Docker (bypasses host proxy)"
echo ""

# Check docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker not found. Please install Docker Desktop.${NC}"
  exit 1
fi

# Prompt for token if not set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo -e "${YELLOW}Get token from: https://dash.cloudflare.com/profile/api-tokens → Create Custom Token${NC}"
  echo "Required perms: D1:Edit, Workers R2 Storage:Edit, Cloudflare Pages:Edit, Workers Scripts:Edit"
  echo ""
  read -s -p "Enter CLOUDFLARE_API_TOKEN: " CLOUDFLARE_API_TOKEN
  echo ""
  if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${RED}Token empty, abort.${NC}"
    exit 1
  fi
fi

# Trim whitespace/newlines
CLOUDFLARE_API_TOKEN=$(echo "$CLOUDFLARE_API_TOKEN" | tr -d '\n' | xargs)

# Ask envs
echo ""
read -p "Which envs to setup? [alpha] / alpha+prod / all (preview+alpha+prod) [default: alpha+prod]: " ENVS
ENVS=${ENVS:-alpha+prod}

# Determine list
ENVS_TO_CREATE=()
if [[ "$ENVS" == "alpha" ]]; then
  ENVS_TO_CREATE=("alpha")
elif [[ "$ENVS" == "alpha+prod" ]]; then
  ENVS_TO_CREATE=("alpha" "production")
elif [[ "$ENVS" == "all" ]]; then
  ENVS_TO_CREATE=("preview" "alpha" "production")
else
  echo -e "${RED}Invalid choice: $ENVS. Use alpha, alpha+prod, or all${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Will create D1+R2 for: ${ENVS_TO_CREATE[*]}${NC}"
read -p "Continue? [y/N]: " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# Helper to run wrangler via Docker
wrangler_run() {
  docker run --rm \
    -v "$PWD":/app -w /app \
    -e CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
    node:20 npx wrangler "$@"
}

# Function to create D1 and extract ID
create_d1() {
  local name=$1
  echo ""
  echo -e "${GREEN}Creating D1: $name${NC}"
  local output
  output=$(wrangler_run d1 create "$name" 2>&1 || true)
  echo "$output"
  # Extract UUID (database_id)
  local id
  id=$(echo "$output" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
  if [ -z "$id" ]; then
    # Maybe already exists - try list
    echo -e "${YELLOW}Could not extract ID, checking if already exists...${NC}"
    local list_out
    list_out=$(wrangler_run d1 list 2>&1 || true)
    id=$(echo "$list_out" | grep -A2 "$name" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
  fi
  echo "$id"
}

create_r2() {
  local name=$1
  echo ""
  echo -e "${GREEN}Creating R2 bucket: $name${NC}"
  local output
  output=$(wrangler_run r2 bucket create "$name" 2>&1 || true)
  echo "$output"
  if echo "$output" | grep -q "already exists\|Created bucket"; then
    echo -e "${GREEN}Bucket $name ready${NC}"
  fi
}

migrate_d1() {
  local name=$1
  echo ""
  echo -e "${GREEN}Migrating D1: $name (remote)${NC}"
  wrangler_run d1 migrations apply "$name" --remote 2>&1 | tail -20
}

verify_d1() {
  local name=$1
  echo ""
  echo -e "${GREEN}Verifying tables in $name${NC}"
  wrangler_run d1 execute "$name" --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" 2>&1 | tail -20
}

# Track IDs for wrangler.toml update
PREVIEW_ID=""
ALPHA_ID=""
PROD_ID=""

for env in "${ENVS_TO_CREATE[@]}"; do
  case $env in
    preview)
      PREVIEW_ID=$(create_d1 "portfolio-db-preview")
      create_r2 "portfolio-images-preview"
      ;;
    alpha)
      ALPHA_ID=$(create_d1 "portfolio-db-alpha")
      create_r2 "portfolio-images-alpha"
      ;;
    production)
      PROD_ID=$(create_d1 "portfolio-db")
      create_r2 "portfolio-images"
      ;;
  esac
done

# Migrate
for env in "${ENVS_TO_CREATE[@]}"; do
  case $env in
    preview) migrate_d1 "portfolio-db-preview" ;;
    alpha) migrate_d1 "portfolio-db-alpha" ;;
    production) migrate_d1 "portfolio-db" ;;
  esac
done

# Verify
for env in "${ENVS_TO_CREATE[@]}"; do
  case $env in
    preview) verify_d1 "portfolio-db-preview" ;;
    alpha) verify_d1 "portfolio-db-alpha" ;;
    production) verify_d1 "portfolio-db" ;;
  esac
done

# Update wrangler.toml with IDs if found
echo ""
echo -e "${YELLOW}Updating wrangler.toml with IDs...${NC}"

# Use Python to update TOML safely (handles sections)
python3 <<PY
import re, sys
path = "wrangler.toml"
with open(path, "r") as f:
    content = f.read()

def update_id(env_name, new_id):
    global content
    if not new_id:
        return
    # Match [env.xxx] section then database_id within that section
    # Replace database_id = "..." under [env.xxx]
    pattern = rf'(\[env\.{env_name}\][^\[]*?database_id\s*=\s*")[^"]+(")'
    # Use DOTALL to span lines until next section
    # More robust: find section start, then replace next database_id
    def repl_section(match):
        section = match.group(0)
        # Replace first database_id occurrence in this section
        new_section = re.sub(r'(database_id\s*=\s*")[^"]+(")', rf'\g<1>{new_id}\g<2>', section, count=1)
        return new_section
    # Find section [env.xxx] to next [env or end
    content_new = re.sub(rf'\[env\.{env_name}\].*?(?=\n\[env\.|\Z)', repl_section, content, flags=re.DOTALL)
    content = content_new

preview_id = "${PREVIEW_ID}"
alpha_id = "${ALPHA_ID}"
prod_id = "${PROD_ID}"

if preview_id:
    update_id("preview", preview_id)
if alpha_id:
    update_id("alpha", alpha_id)
if prod_id:
    update_id("production", prod_id)

with open(path, "w") as f:
    f.write(content)

print(f"Updated wrangler.toml: preview={preview_id}, alpha={alpha_id}, prod={prod_id}")
PY

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo "Created:"
for env in "${ENVS_TO_CREATE[@]}"; do
  case $env in
    preview) echo "  - portfolio-db-preview (ID: $PREVIEW_ID) + portfolio-images-preview" ;;
    alpha) echo "  - portfolio-db-alpha (ID: $ALPHA_ID) + portfolio-images-alpha" ;;
    production) echo "  - portfolio-db (ID: $PROD_ID) + portfolio-images" ;;
  esac
done
echo ""
echo "wrangler.toml updated with real IDs."
echo ""
echo "Next steps:"
echo "  1. Cloudflare Dashboard → Pages → Create → Connect to Git → Select hohodsj/FanWebApp (owner needs to grant app access if collaborator)"
echo "  2. Settings → Functions → Bindings:"
echo "     - For Slice 0 quick alpha: set Preview env to use portfolio-db-alpha + portfolio-images-alpha, ENVIRONMENT=alpha"
echo "     - Production: portfolio-db + portfolio-images, ENVIRONMENT=production"
echo "  3. Custom domain: alpha.somewebsite.com → branch alpha"
echo "  4. Push alpha branch: git checkout -b alpha && git push -u origin alpha"
echo "  5. Verify: curl https://alpha.somewebsite.com/api/health → {db:ok,r2:ok,env:alpha}"
echo ""
echo "To re-run verification:"
echo "  docker run --rm -v \"\$PWD\":/app -w /app -e CLOUDFLARE_API_TOKEN=\$CLOUDFLARE_API_TOKEN node:20 npx wrangler d1 execute portfolio-db-alpha --remote --command \"SELECT name FROM sqlite_master WHERE type='table'\""
