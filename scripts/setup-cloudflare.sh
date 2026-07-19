#!/bin/bash
set -e

# Setup Cloudflare D1 + R2 for alpha / prod / preview
# Uses Docker to bypass host proxy. Prompts for API token securely.
# Idempotent: safe to re-run, will reuse existing DBs/R2 and apply pending migrations.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Portfolio Cloudflare Setup (D1+R2) ===${NC}"
echo ""

if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker not found. Install Docker Desktop.${NC}"
  exit 1
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo -e "${YELLOW}Get token: https://dash.cloudflare.com/profile/api-tokens → Create Custom Token${NC}"
  echo "Perms: D1:Edit, Workers R2 Storage:Edit, Cloudflare Pages:Edit, Workers Scripts:Edit"
  echo ""
  read -s -p "Enter CLOUDFLARE_API_TOKEN: " CLOUDFLARE_API_TOKEN
  echo ""
  if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${RED}Token empty, abort.${NC}"
    exit 1
  fi
fi

CLOUDFLARE_API_TOKEN=$(echo "$CLOUDFLARE_API_TOKEN" | tr -d '\n' | xargs)

echo ""
echo "Options:"
echo "  alpha       → only alpha (alpha.somewebsite.com)"
echo "  prod        → only prod (somewebsite.com)"
echo "  alpha+prod  → both (recommended)"
echo "  all         → preview + alpha + prod"
echo ""
read -p "Which envs? [alpha/prod/alpha+prod/all] [default: alpha+prod]: " ENVS
ENVS=${ENVS:-alpha+prod}

ENVS_TO_CREATE=()
if [[ "$ENVS" == "alpha" ]]; then
  ENVS_TO_CREATE=("alpha")
elif [[ "$ENVS" == "prod" ]]; then
  ENVS_TO_CREATE=("production")
elif [[ "$ENVS" == "alpha+prod" ]]; then
  ENVS_TO_CREATE=("alpha" "production")
elif [[ "$ENVS" == "all" ]]; then
  ENVS_TO_CREATE=("preview" "alpha" "production")
else
  echo -e "${RED}Invalid: $ENVS. Use alpha, prod, alpha+prod, or all${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Will create D1+R2 for: ${ENVS_TO_CREATE[*]}${NC}"
read -p "Continue? [y/N]: " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

wrangler_run() {
  docker run --rm \
    -v "$PWD":/app -w /app \
    -e CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
    node:20 npx wrangler "$@"
}

# Returns only UUID, prints logs to stderr
create_d1() {
  local name=$1
  echo -e "${GREEN}Creating D1: $name${NC}" >&2
  local output
  output=$(wrangler_run d1 create "$name" 2>&1 || true)
  echo "$output" >&2
  local id
  id=$(echo "$output" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
  if [ -z "$id" ]; then
    echo -e "${YELLOW}  Already exists? Checking list...${NC}" >&2
    local list_out
    list_out=$(wrangler_run d1 list 2>&1 || true)
    # Try to find line with name, then next lines have UUID
    id=$(echo "$list_out" | grep -A3 "\"$name\"\|'$name'\| $name " | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
    if [ -z "$id" ]; then
      # Fallback: grep name then 5 lines after for uuid
      id=$(echo "$list_out" | grep -B1 -A5 "$name" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
    fi
  fi
  if [ -n "$id" ]; then
    echo -e "${GREEN}  -> ID: $id${NC}" >&2
  else
    echo -e "${RED}  -> Failed to get ID for $name${NC}" >&2
  fi
  # Only ID to stdout for capture
  echo "$id"
}

create_r2() {
  local name=$1
  echo -e "${GREEN}Creating R2 bucket: $name${NC}" >&2
  local output
  output=$(wrangler_run r2 bucket create "$name" 2>&1 || true)
  echo "$output" >&2
  if echo "$output" | grep -q "already exists\|Created bucket\|already exists\|created"; then
    echo -e "${GREEN}  Bucket $name ready${NC}" >&2
  fi
  if echo "$output" | grep -q "Please enable R2"; then
    echo -e "${RED}  R2 not enabled for account! Go to https://dash.cloudflare.com/?to=/:account/r2/overview → Enable R2 (free tier, may require billing).${NC}" >&2
    echo -e "${YELLOW}  After enabling, re-run this script.${NC}" >&2
  fi
}

migrate_d1() {
  local name=$1
  echo -e "${GREEN}Migrating D1: $name (remote)${NC}" >&2
  wrangler_run d1 migrations apply "$name" --remote 2>&1 | tail -30 >&2
}

verify_d1() {
  local name=$1
  echo -e "${GREEN}Verifying tables in $name${NC}" >&2
  wrangler_run d1 execute "$name" --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" 2>&1 | tail -20 >&2
}

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

# Migrate only if ID found
for env in "${ENVS_TO_CREATE[@]}"; do
  case $env in
    preview) [ -n "$PREVIEW_ID" ] && migrate_d1 "portfolio-db-preview" ;;
    alpha) [ -n "$ALPHA_ID" ] && migrate_d1 "portfolio-db-alpha" ;;
    production) [ -n "$PROD_ID" ] && migrate_d1 "portfolio-db" ;;
  esac
done

for env in "${ENVS_TO_CREATE[@]}"; do
  case $env in
    preview) [ -n "$PREVIEW_ID" ] && verify_d1 "portfolio-db-preview" ;;
    alpha) [ -n "$ALPHA_ID" ] && verify_d1 "portfolio-db-alpha" ;;
    production) [ -n "$PROD_ID" ] && verify_d1 "portfolio-db" ;;
  esac
done

# Update wrangler.toml - handle empty IDs safely
echo -e "${YELLOW}Updating wrangler.toml with IDs...${NC}"

python3 <<PY
import re

path = "wrangler.toml"
with open(path, "r") as f:
    content = f.read()

def update_section_id(section_name, new_id):
    global_content = content
    if not new_id or len(new_id) < 10:
        print(f"Skipping {section_name} - no valid ID")
        return global_content
    # Replace database_id in [env.xxx] section and also top-level if needed
    # For portfolio-db (prod), also update top-level [[d1_databases]] with database_name portfolio-db
    def repl_env_section(match):
        sec = match.group(0)
        new_sec = re.sub(r'(database_id\s*=\s*")[^"]+(")', rf'\1{new_id}\2', sec, count=1)
        return new_sec

    # Update env section
    pattern = rf'(\[env\.{section_name}\][^\[]*?database_id\s*=\s*")[^"]+(")'
    # Use function to avoid over-replacing across sections
    updated = re.sub(rf'\[env\.{section_name}\].*?(?=\n\[env\.|\Z)', repl_env_section, global_content, flags=re.DOTALL)
    return updated

# Read IDs from env vars passed via bash
preview_id = "${PREVIEW_ID}".strip()
alpha_id = "${ALPHA_ID}".strip()
prod_id = "${PROD_ID}".strip()

# Clean IDs - keep only first uuid in case of multiline
import re as re2
uuid_re = r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'
def clean_id(raw):
    m = re2.search(uuid_re, raw or "")
    return m.group(0) if m else ""

preview_id = clean_id(preview_id)
alpha_id = clean_id(alpha_id)
prod_id = clean_id(prod_id)

print(f"Cleaned IDs - preview:{preview_id} alpha:{alpha_id} prod:{prod_id}")

with open(path, "r") as f:
    content = f.read()

def update_id_in_section(content, env_name, new_id):
    if not new_id:
        return content
    def repl(match):
        sec = match.group(0)
        return re2.sub(r'(database_id\s*=\s*")[^"]+(")', rf'\1{new_id}\2', sec, count=1)
    pattern = rf'\[env\.{env_name}\].*?(?=\n\[env\.|\Z)'
    return re2.sub(pattern, repl, content, flags=re2.DOTALL)

if preview_id:
    content = update_id_in_section(content, "preview", preview_id)
if alpha_id:
    content = update_id_in_section(content, "alpha", alpha_id)
if prod_id:
    content = update_id_in_section(content, "production", prod_id)
    # Also update top-level [[d1_databases]] with database_name = "portfolio-db" (prod) - used by migrations apply without --env
    # Replace first top-level occurrence before any [env.]
    # Find first [[d1_databases]] block before [env.
    parts = content.split("[env.")
    if len(parts) >= 1:
        top = parts[0]
        top = re2.sub(r'(\[\[d1_databases\]\][^\[]*?database_name\s*=\s*"portfolio-db"[^\[]*?database_id\s*=\s*")[^"]+(")', rf'\1{prod_id}\2', top, count=1, flags=re2.DOTALL)
        # Also handle if top-level id is placeholder without env
        if prod_id not in top and 'local-placeholder' in top:
            top = re2.sub(r'(database_id\s*=\s*")[^"]+(")', rf'\1{prod_id}\2', top, count=1)
        content = "[env.".join([top] + parts[1:])

with open(path, "w") as f:
    f.write(content)

print(f"Updated wrangler.toml")
PY

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
for env in "${ENVS_TO_CREATE[@]}"; do
  case $env in
    preview) echo "  - portfolio-db-preview (ID: $PREVIEW_ID) + portfolio-images-preview" ;;
    alpha) echo "  - portfolio-db-alpha (ID: $ALPHA_ID) + portfolio-images-alpha" ;;
    production) echo "  - portfolio-db (ID: $PROD_ID) + portfolio-images" ;;
  esac
done
echo ""
echo "Next: Cloudflare Dashboard → Pages → Create → Connect to Git → $REPO"
echo "Bindings: set Preview to alpha DB/R2 for quick alpha test, Production to prod DB/R2"
