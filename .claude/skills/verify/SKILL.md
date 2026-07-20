---
name: verify
description: Build, run, and drive the Dufat Next.js app in a real browser to verify a change works end-to-end.
---

# Verifying changes in the Dufat app

Surface is **pixels** — Next.js 16 (App Router, Turbopack) + React 19. Drive a
real browser; don't settle for typecheck or a fetched HTML string.

## Prerequisites

Postgres (**5433**) and Redis (**6381**) must be listening — the app uses
non-default ports because other instances occupy 5432/6379.

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5433,6381,3000 -ErrorAction SilentlyContinue
npm run dev    # only if 3000 isn't already listening
```

## Driving the browser

Playwright is a devDependency (`npm i -D playwright`, `npx playwright install chromium`).

Scripts placed outside the repo can't resolve `playwright`. Either put the
script in the repo, or resolve via the project's `package.json`:

```js
import { createRequire } from "node:module";
const require = createRequire("c:/Users/USER/Documents/DOCS/SoftWise/Softwise-Proj/Dufat/package.json");
const { chromium } = require("playwright");
```

## Admin area

Seeded credentials (`prisma/seed.ts`, overridable via env):
`admin@dufat.co.ao` / `dufat-admin-2026`

`/admin/*` is behind `requireAdmin()` — log in through the real form at
`/admin/login` and `waitForURL("**/admin")`; don't try to forge a session.

## Gotcha: theme transitions hide the truth

`.admin-shell` has `transition: background-color 0.3s`. Sampling
`getComputedStyle(...).backgroundColor` right after `networkidle` catches a
**mid-transition** value that looks like the wrong theme. Either wait ~1s for
it to settle, or — better — sample on a timeline from `waitUntil: "commit"` to
distinguish "wrong theme" from "correct theme, arriving late".

A flash-of-wrong-theme is a real bug and only a timeline shows it. The admin
theme is applied by an inline script in `<head>` (`src/app/layout.tsx`) that
stamps `data-admin-theme` on `<html>` before first paint; CSS keys off
`[data-admin-theme="light"] .admin-shell` in `globals.css`. Anything that
defers this to a React effect reintroduces the flash.

Worth probing: corrupt `localStorage` value, and `localStorage` throwing
(blocked storage) — both must fall back to dark without crashing.
