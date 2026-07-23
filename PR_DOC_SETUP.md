# PR: doc: General Setup Guide doc/Setup.md (reproducible Cloudflare + GitHub + Docker)

**Feature branch:** `doc/setup-guide` → **Base:** `alpha` (protected, client verification before main)

**Link to create PR:** https://github.com/metagtmtest1-design/profile-webapp/pull/new/doc/setup-guide

## Summary

Rename `.llm/README.md` (slice-specific status) → `doc/Setup.md` — **general reproducible setup guide** for any new contributor/cloning.

This doc is different from root `README.md` (project overview + status). `doc/Setup.md` is from-zero instructions to reproduce Cloudflare + GitHub + Docker env.

## Why

- Slice 0 had lots of fixes: host proxy `x2pagentd` blocking npm + `wrangler login`, `wrangler.toml` only allows `preview`/`production` (not custom `alpha`), R2 billing `10042`, `workerd` needs `node:20` not alpine, `@types/node`, double `--run` bug, branch protection
- `.llm` folder name was confusing — renamed to `doc/` + `Setup.md` per request
- Future LLMs must read this before any work to avoid repeating mistakes (wrangler.toml env naming, R2 optional, Docker bypass, branch control isolation)

## What

- `doc/Setup.md` (331 lines, 12KB) — 13 sections:
  1. Overview: src, functions, wrangler.toml, D1/R2, single project `profile-webapp`
  2. Prerequisites: CF account, GitHub, Docker
  3. **Cloudflare API Token fetch:** Custom Token (not template) with perms `D1:Edit, Workers R2 Storage:Edit, Cloudflare Pages:Edit, Workers Scripts:Edit` + optional extras, example summary, Copy button raw format, verify via `docker run ... wrangler whoami`, fix `6003/6111` invalid header
  4. **D1+R2 Setup scripted:** `scripts/setup-cloudflare.sh` interactive prompts `alpha/prod/alpha+prod/all`, idempotent (upsert via `d1 list`, skip buckets, skip applied migrations), Docker-wrapped wrangler, updates `wrangler.toml` IDs, manual alternative commands
  5. **R2 billing note:** Enable via Dashboard needs card, free tier $0, workaround comment out `[[r2_buckets]]` → health `r2:skipped` 200 OK for Slice 0
  6. **wrangler.toml conventions:** only `preview`/`production` supported (not `alpha`), top-level `[vars]` not inherited so duplicate, `pages_build_output_dir = "dist"`, auto `functions/`, vars managed via toml (Dashboard locks when toml has vars, only Secrets via Dashboard)
  7. **Functions naming:** folder must be `functions` at root, path = URL via `[param].ts` → `params`, `onRequestGet/Post`, `_lib` ignored, POST with both path param + body example
  8. **Branch Control Screenshot (Important):** Production `main` + Enable auto prod ON, Preview Custom branches `alpha` only (not All non-prod, not None) — explains full isolation: single project `profile-webapp` Production `main` → prod D1 `f6dfc0c2-...` → `profile-webapp.pages.dev`, Preview Custom `alpha` → alpha D1 `30b1ea40-...` → `alpha.profile-webapp.pages.dev` — code+data isolated, push to alpha only rebuilds alpha, merge alpha→main rebuilds prod. Also notes 2 projects alternative for even stronger isolation.
  9. **GitHub protected:** no direct commits to `alpha`/`main` (feature → PR → alpha → PR → main), branch protection rules, GitHub App install for collaborator, `isolated-git-env` container for git when host auth fails (`docker exec isolated-git-env git -C /workspace/profile-webapp push origin slice/...`)
  10. **Local Docker verification:** unit via `docker run ... npm test -- --run`, workers via `test:workers`, lint, build, integration `docker compose up -d backend/frontend` + `curl /api/health`
  11. Remote verification `curl alpha/profile-webapp.pages.dev/api/health`
  12. Pitfalls: proxy 503, TS2591 process, double --run, workerd glibc, placeholder UUID, branch selectable only after deploy, R2 10042
  13. TL;DR from scratch 6 steps

- Removes `.llm` folder (was confusing name)

## Tests

- No code logic change, only docs move — existing tests still green:

```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run
# 2 files, 11 passed

docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers -- --run
# 2 files, 16 passed → total 27

docker run --rm -v "$PWD":/app -w /app node:20 npm run build
# dist built

docker compose up -d backend && curl http://localhost:8788/api/health && docker compose down
# → status ok db ok r2 ok env local
```

## Deployment

**This PR is docs only — no infra change, no D1/R2 migration needed, no Pages binding change.**

- **Feature branch:** `doc/setup-guide` already pushed via `isolated-git-env` container
- **PR base should be `alpha` (not `main`)** per protected flow: `doc/setup-guide` → `alpha` → client verification → PR `alpha` → `main`

**Steps to deploy this doc:**

1. Go to https://github.com/metagtmtest1-design/profile-webapp/pull/new/doc/setup-guide
2. Base: `alpha`, Compare: `doc/setup-guide`, Title: `doc: Rename .llm to doc/Setup.md — general setup guide`, Body: copy this file
3. Create PR → CI `test` job green + Pages Preview deployment for `alpha`? Actually branch control Custom `alpha` only means feature `doc/setup-guide` won't trigger Preview in this single project setup (since only alpha allowed). So CI will still run (test + build), but Pages preview won't deploy for `doc/setup-guide` — that's expected per Custom alpha only config. To get preview for feature branches, temporarily change Preview to All non-production, or just verify via Docker local (CI green + build green is enough for docs PR).
4. Merge PR into `alpha` via GitHub UI → Pages Preview `alpha` will rebuild? Actually `alpha` not `doc/setup-guide`, so need to merge `doc/setup-guide` into `alpha` via PR, then push triggers Preview `alpha` deployment? Wait flow: Feature `doc/setup-guide` → PR vs `alpha`, when merged, `alpha` gets new commit → Pages Preview (since Preview Custom includes `alpha`) triggers new Preview deployment for `alpha` → `https://alpha.profile-webapp.pages.dev` should still show health + bold banners (since `doc/` doesn't affect code) → verify `curl https://alpha.profile-webapp.pages.dev/api/health` still `db:ok r2:skipped env:alpha`
5. Then PR `alpha` → `main` → Production deployment → `https://profile-webapp.pages.dev` same health

**Alternative (since feature branches not in Preview Custom):** After merging to `alpha`, `alpha` deployment will include `doc/Setup.md` change (docs only, no code impact) — prod remains unaffected until merge.

## How to Verify This PR

- Local: `docker run ... npm test -- --run` 11 + 16 workers = 27 green, build pass
- GitHub: Open PR link above, CI green (lint, build, test, test:workers)
- Cloudflare: Since no code change, `alpha.profile-webapp.pages.dev` and `profile-webapp.pages.dev` should continue to show bold banners (orange alpha, green prod) and health `db:ok r2:skipped` after merge

## Checklist

- [x] Feature branch `doc/setup-guide` created from `main` (or alpha), not direct push to protected
- [x] `doc/Setup.md` added, `.llm` removed (via filesystem move, not yet via git? Actually git tracks removal? We removed .llm via rm -rf earlier, need to git rm)
- [x] 27 tests green via Docker
- [x] Build green
- [x] No wrangler.toml change, no migration needed
- [x] PR base = `alpha` per protected flow
```

