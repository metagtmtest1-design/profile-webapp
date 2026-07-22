# Setup Guide — Reproducible Cloudflare + GitHub + Docker

**For future LLMs, new contributors, or anyone cloning this repo.**
This is the **general setup + conventions** doc. It lets you reproduce the entire Cloudflare + GitHub deployment from scratch (alpha/prod isolation, D1/R2, Pages Functions).

**Different from root `README.md`:** Root README = project overview + current status. This `doc/Setup.md` = from-zero setup instructions.

**Reference:** Original design doc + architectural decisions in `DECISIONS.md`.

---

## 1. Overview

- **Repo:** `metagtmtest1-design/profile-webapp` (example, replace with your fork)
- **Frontend:** React + Vite TS in `src/` → `npm run build` → `dist/` → Cloudflare Pages CDN
- **Backend (Pages Functions):** `functions/` folder → each file = Worker route, auto-deployed by Pages
- **Config:** `wrangler.toml` — D1 + R2 bindings + vars (`ENVIRONMENT`, `SITE_URL`, working hours)
- **DB:** D1 SQLite, **Storage:** R2 (optional, see billing note)
- **Envs:** Single Pages project `profile-webapp` with branch-based isolation (see Branch Control screenshot)

---

## 2. Prerequisites

- Cloudflare account (free tier)
- GitHub account
- Docker + Docker Compose (required — host proxy breaks npm + wrangler without Docker)
- Node 20 (inside Docker, not host — host `npm install` may fail due to proxy)

---

## 3. Cloudflare API Token — How to Fetch

`wrangler login` (OAuth) fails behind proxy (`x2pagentd` on `:10054` blocks localhost callback `http://localhost:8976`). Use **API Token** instead (no browser needed).

**Steps:**

1. Go to **https://dash.cloudflare.com/profile/api-tokens** → **Create Token** → **Create Custom Token** (NOT template)

2. **Permissions** (Account Resources: your account):

   - Account:
     - `D1:Edit` — create DBs, migrations, queries
     - `Workers R2 Storage:Edit` — create R2 buckets
     - `Cloudflare Pages:Edit` — deployments, custom domains
     - `Workers Scripts:Edit` — Functions/Workers
   - Optional extras that don't hurt (from Worker template):
     - `Workers KV Storage:Edit`, `Workers Tail:Read`, `Workers Builds Config:Edit`, `Account Settings:Read`, `User Details:Read`, `Memberships:Read`
     - Zones: `Workers Routes:Edit` on All zones (if you manage route mappings)

   Example summary:

   ```
   Metagtmtest1@gmail.com's Account - Workers KV Storage:Edit, Workers Scripts:Edit, Account Settings:Read, Workers Tail:Read, Workers R2 Storage:Edit, Cloudflare Pages:Edit, Workers Builds Configuration:Edit, Workers Agents Configuration:Edit, Workers Observability:Edit, Containers:Edit, D1:Edit
   All zones - Workers Routes:Edit
   All users - User Details:Read, Memberships:Read
   ```

3. **Zone Resources:** `All zones` or specific zone if you have custom domain
4. **TTL:** 30 days / 6 months / no expiry
5. **Create → Copy token** (use Copy button, raw token only — no `Bearer` prefix, no quotes, no newline)

**Verify:**

```bash
# Host (disable proxy)
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
CLOUDFLARE_API_TOKEN=your_token npx wrangler whoami

# Docker (recommended, bypasses host proxy):
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=your_token node:20 npx wrangler whoami
```

**Error `Invalid request headers [code: 6003] Invalid format for Authorization header [code: 6111]`:**
- Wrapped in quotes `"token"` → remove quotes
- Trailing space/newline → `tr -d '\n'`
- `Bearer ` prefix → remove
- Truncated → re-copy full via button

**Store:**

```bash
export CLOUDFLARE_API_TOKEN=your_token
echo 'export CLOUDFLARE_API_TOKEN=your_token' >> ~/.zshrc
```

---

## 4. D1 + R2 Setup — Scripted (Idempotent)

**Script:** `scripts/setup-cloudflare.sh` — creates D1+R2 via Docker, runs migrations, updates `wrangler.toml` IDs. Safe to re-run.

```bash
chmod +x scripts/setup-cloudflare.sh
./scripts/setup-cloudflare.sh
# Prompt: token, then envs: alpha / prod / alpha+prod / all, y

# Non-interactive:
CLOUDFLARE_API_TOKEN=your_token ./scripts/setup-cloudflare.sh
```

What it does per env:

- `d1 create portfolio-db[-alpha/-preview]` → UUID, handles already-exists via `d1 list`
- `r2 bucket create portfolio-images[-alpha/-preview]` → if `Please enable R2 [code: 10042]`, enable via Dashboard → R2 Overview (requires card, free tier $0) or make R2 optional
- `d1 migrations apply --remote` → runs `migrations/*.sql`, skips already applied
- Verifies tables, updates `wrangler.toml` database_id

**Manual:**

```bash
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 create portfolio-db-alpha
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler r2 bucket create portfolio-images-alpha
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 migrations apply portfolio-db-alpha --remote
```

**R2 optional:** Without billing, comment out `[[r2_buckets]]` in `wrangler.toml`, health returns `r2:skipped` 200 OK if DB ok.

---

## 5. wrangler.toml Conventions

```toml
name = "portfolio-site"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

[vars]
ENVIRONMENT = "local"
# ... common vars

[[d1_databases]]
binding = "DB"
database_name = "portfolio-db"
database_id = "<prod-id>"

# R2 optional
# [[r2_buckets]]
# binding = "R2_BUCKET"
# bucket_name = "portfolio-images"

[env.preview]
[[env.preview.d1_databases]]
binding = "DB"
database_name = "portfolio-db-alpha"
database_id = "<alpha-id>"

[env.preview.vars]
ENVIRONMENT = "alpha"
SITE_URL = "https://alpha.profile-webapp.pages.dev"

[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "portfolio-db"
database_id = "<prod-id>"

[env.production.vars]
ENVIRONMENT = "production"
SITE_URL = "https://profile-webapp.pages.dev"
```

**Rules:**

- Pages only supports `env.preview` and `env.production`, NOT `env.alpha` — build fails `Configuration file contains environment names not supported: "alpha"`. Use `preview` for alpha DB/vars.
- Top-level `[vars]` not inherited by envs — duplicate into each env vars or warning.
- `pages_build_output_dir = "dist"` = static output. Functions auto `functions/`.
- When vars in toml, Dashboard says "Environment variables are being managed through wrangler.toml. Only Secrets can be managed via Dashboard" — manage vars via toml, secrets via Dashboard or `wrangler secret put`.

---

## 6. Pages Functions Naming

- Folder must be `functions` at root — typo not treated as Functions.

| File | URL | Method |
|------|-----|--------|
| `functions/api/health.ts` line 27 `onRequestGet` | `/api/health` | GET |
| `functions/api/content/[slug].ts` | `/api/content/:slug` → `/home` | `params.slug` |
| `functions/api/cancel/[token].ts` | `/api/cancel/:token` | `params.token` |
| `functions/_lib/env.ts` | NOT route — `_` prefix ignored | lib |

POST with both path param + body allowed:
```ts
export const onRequestPost = async ({ request, params, env }) => {
  const id = params.id as string
  const body = await request.json() as { reason?: string }
}
```

---

## 7. Branch Control — Isolation (Screenshot)

**Dashboard → Pages → Settings → Builds → Branch control**

```
Production branch: main
  Enable automatic production branch deployments: ON

Preview branch: Custom branches
  alpha
```

**Meaning — Single project isolation:**

- 1 project `profile-webapp`
- Production `main` → Production env (`[env.production]`) → prod D1 → `https://profile-webapp.pages.dev`
- Preview Custom `alpha` only → Preview env (`[env.preview]`) → alpha D1 → `https://alpha.profile-webapp.pages.dev`

Code AND data isolated:

- Push to `alpha` → only alpha rebuilds (alpha DB), prod untouched
- Merge `alpha` → `main` → only prod rebuilds (prod DB)

Preview options:

- `All non-Production branches` → all `slice/*` + PRs share Preview env (alpha DB) — okay solo dev
- `None` → no preview deployments
- `Custom branches` → `alpha` only → only alpha gets preview → full alpha-only isolation (screenshot, recommended)

**2 projects alternative (full per-branch isolation):**

- `profile-webapp` Prod=`main` → prod D1, Preview=None → prod domain
- `profile-webapp-alpha` Prod=`alpha` → alpha D1, Preview=None → alpha domain

We use single project Custom `alpha` only as screenshot.

---

## 8. GitHub — Protected Branches

- Branches: `main` (prod), `alpha` (alpha env), `slice/*` feature

**Protected for verification:**

- Do NOT commit directly to `alpha` and `main` — use `slice/N-name` → PR vs `alpha` → client verifies `alpha.pages.dev` → PR `alpha` → `main` → prod

GitHub Settings → Branches → Rules:

- `main`: Require PR, Require status checks (CI + Pages)
- `alpha`: Require PR (lighter)

**GitHub App for Pages (collaborator):**

If repo not visible in Cloudflare Connect:

- GitHub → avatar → Settings → Applications → Installed GitHub Apps → Cloudflare Pages → Configure → Select repos → add repo → Save, refresh Cloudflare.

**Isolated Git Env container:**

Host git may have auth issues. Container `isolated-git-env` at `/workspace`:

```bash
docker exec isolated-git-env git -C /workspace/profile-webapp status
docker exec isolated-git-env git -C /workspace/profile-webapp push origin slice/1-content
```

---

## 9. Local Verification — Docker

**Why Docker:** Host `x2pagentd` proxy on `:10054` blocks npm + wrangler. Docker bypasses.

Compose: frontend `node:20-alpine` Vite 5173 proxies `/api` → `http://backend:8788`, backend `node:20` debian (workerd needs glibc, not alpine).

```bash
# Unit
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers -- --run
docker compose --profile test run --rm tests

# Lint + Build
docker run --rm -v "$PWD":/app -w /app node:20 npm run lint
docker run --rm -v "$PWD":/app -w /app node:20 npm run build

# Integration full stack
docker compose up -d backend
sleep 25
curl http://localhost:8788/api/health | jq
docker compose up -d frontend
curl http://localhost:5173/api/health | jq
docker compose down -v
```

---

## 10. Remote Verification

```bash
curl https://alpha.profile-webapp.pages.dev/api/health | jq
curl https://profile-webapp.pages.dev/api/health | jq
```

Browser: banner shows env, health badge DB:ok R2:skipped/ok green.

D1 remote:
```bash
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 \
npx wrangler d1 execute portfolio-db-alpha --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

---

## 11. Pitfalls

- npm 503 `x2pagentd` → Docker
- TS2591 `process` → add `@types/node` + `node` to tsconfig types
- Double `--run` → `package.json` test: `vitest` not `vitest --run`, CI adds `-- --run`
- workerd ENOENT → backend `node:20` debian not alpine
- Invalid uuid → placeholder ID in toml → replace with real from `d1 create`
- Env vars managed via toml → only Secrets via Dashboard
- Branch not selectable for custom domain → needs successful deployment first
- R2 `10042` → enable in Dashboard (needs card) or make optional

---

## 12. TL;DR From Scratch

```bash
git clone https://github.com/metagtmtest1-design/profile-webapp.git
cd profile-webapp
export CLOUDFLARE_API_TOKEN=your_token
chmod +x scripts/setup-cloudflare.sh
./scripts/setup-cloudflare.sh  # alpha+prod, y
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run
docker compose up -d backend && curl http://localhost:8788/api/health && docker compose down
# Dashboard → Pages → Create → Connect Git → profile-webapp → Project name profile-webapp, Prod main, Build npm run build, Output dist, Node 20, Branch control main + Custom alpha only
curl https://alpha.profile-webapp.pages.dev/api/health
curl https://profile-webapp.pages.dev/api/health
```
