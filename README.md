# Dufat — Immersive Product Showcase

Premium, animation-driven product showcase for **Dufat, Lda.** (Luanda, Angola) — street
lighting, luminaires and electrical material. The centerpiece is a scroll-driven 3D
street light "teardown" on the homepage: a procedurally modelled galvanized pole with a
Braytron ST89-style LED head that the camera orbits and zooms through five component
stops (LED head → arm → pole → base → driver compartment) while the sky cycles
dusk → night → dawn and the photocell switches the lamp off.

> The public site copy is in Portuguese (pt-AO) to match Dufat's market and brand
> material; code, comments and this README are in English.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript + React 19 |
| Styling | Tailwind CSS 4 (brand theme: `#114F8C` blue / white) |
| 3D | Three.js (r184) — procedural street light, hero scene, 360° product viewer |
| Animation | GSAP 3 + ScrollTrigger (`@gsap/react` for lifecycle-safe hooks) |
| Database | PostgreSQL via Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Cache / rate limiting | Redis (ioredis) — catalog cache, search cache, form rate limits |
| Validation | Zod 4 — every form, server action and API route |
| Auth | Signed JWT session cookies (jose) + bcryptjs |
| Monitoring | Sentry (`@sentry/nextjs`) — client, server and edge |
| Logging | Winston — structured JSON, daily rotation in prod, error-level → Sentry |
| Containers | Docker multi-stage build + docker-compose (app, postgres, redis, migrate) |

## Quick start (Docker — everything included)

```bash
docker compose up --build
```

This starts Postgres 17, Redis 7, runs migrations + seed (the `migrate` one-shot
service), then serves the app at **http://localhost:3000**.

## Local development

Prerequisites: Node 24+, Docker (for Postgres/Redis).

```bash
# 1. Infrastructure
docker compose up -d postgres redis

# 2. Environment
cp .env.example .env        # defaults already point at the compose services

# 3. Install + generate Prisma client (postinstall runs prisma generate)
npm install

# 4. Create schema + seed the sample catalog
npm run db:migrate          # prisma migrate dev
npm run db:seed             # Braytron ST89 luminaires, poles, arms, accessories…

# 5. Run
npm run dev                 # http://localhost:3000
```

### Admin area

`http://localhost:3000/admin` — credentials are seeded from `.env`:

- **Email:** `ADMIN_EMAIL` (default `admin@dufat.co.ao`)
- **Password:** `ADMIN_PASSWORD` (default `dufat-admin-2026`)

The admin provides CRUD for products (with spec rows and image upload to
`/public/uploads`), case studies, quote-request triage, and a dashboard with
page-view analytics (tracked via a `sendBeacon` endpoint) and form counters.

## Environment variables

See [.env.example](.env.example). Summary:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Prisma) |
| `REDIS_URL` | Redis connection; the app degrades gracefully if unreachable |
| `SESSION_SECRET` | HMAC secret for admin session JWTs (≥16 chars) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin credentials |
| `NEXT_PUBLIC_SENTRY_DSN` | Enables Sentry on client+server when set |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Source-map upload at build (optional) |
| `LOG_LEVEL` | Winston level (`debug` in dev, `info` in prod by default) |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata/sitemap |

## Project structure

```
prisma/                 schema, migrations, seed (real Braytron/Dufat catalog data)
src/
  app/
    (site)/             public pages: home, products(+[slug]/+ficha), solutions, about, contact
    admin/              login + protected CRUD area
    api/                track (page views), admin/upload
    sitemap.ts, robots.ts, opengraph-image.tsx
  components/
    home/               HeroSequence (the 3D teardown), WhyDufat, CategoryGrid, Testimonials
    products/           FilterBar, ProductCard, ProductViewer360, EnergyChart
    solutions/          CaseNarrative (pinned scroll storytelling)
    motion/             Reveal, Parallax, CountUp (GSAP primitives)
    forms/, admin/, layout/, brand/
  content/heroStages.ts annotation copy + scroll windows for the hero
  lib/
    three/              streetLightModel (procedural parts), HeroScene, quality tiers
    db.ts, redis.ts, logger.ts, auth.ts, validation.ts, catalog.ts, gsap.ts
  server/actions/       forms, auth, admin (all Zod-validated, rate-limited, logged)
```

## The hero sequence — how it works

- `HeroScene` (plain Three.js class, no react-three-fiber) builds the model from
  `streetLightModel.ts` and exposes `setProgress(0..1)` + `projectPart(name)`.
- `HeroSequence.tsx` pins a full-viewport canvas inside a 680 vh section. A GSAP
  tween with `scrub` smooths scroll into `setProgress`, which drives a Catmull-Rom
  camera path through 7 waypoints (eased per segment so the camera "dwells" at each
  component) and interpolates 5 sky keyframes (colors, star opacity, environment
  intensity, lamp level — the dawn keyframe turns the lamp off via the photocell).
- Annotation panels and SVG leader lines are choreographed by a second scrubbed
  timeline; leader endpoints are re-projected from 3D every scroll tick.
- The Three.js bundle is lazy-loaded (`import()` on mount) behind a branded loader.

### Performance & accessibility

- Device-tier detection (`lib/three/quality.ts`) lowers pixel ratio, particle count
  and removes the skyline on mobile/low-end hardware. No shadow maps are used —
  contact shadows and the light pool are cheap textured quads.
- `prefers-reduced-motion` renders a single static frame and replaces every pinned
  sequence with stacked, fully readable cards; GSAP reveals are skipped.
- Semantic landmarks, labelled controls, keyboard-reachable nav and forms.

## Search & caching

Product search uses Postgres full-text search (`websearch_to_tsquery`, Portuguese
dictionary, GIN expression index) with an ILIKE fallback, debounced on the client
(URL-driven so results stay server-rendered and shareable). Catalog queries are
cached in Redis (60 s TTL) and invalidated by admin mutations. Form submissions are
rate-limited per IP via Redis `INCR` (in-memory fallback when Redis is down).

## Logging & monitoring

- `lib/logger.ts`: Winston with JSON format; in production it writes daily-rotated
  `logs/app-%DATE%.log` + `logs/error-%DATE%.log`; error-level entries are also
  forwarded to Sentry when a DSN is configured.
- Sentry is initialised in `src/instrumentation.ts` (server/edge) and
  `src/instrumentation-client.ts` (browser); `next.config.ts` is wrapped with
  `withSentryConfig` and uploads source maps only when `SENTRY_AUTH_TOKEN` is set.

## Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (CI/containers) |
| `npm run db:seed` | Seed sample catalog + admin user |
| `npm run db:studio` | Prisma Studio |

## Notes

- The seeded catalog uses real Braytron BT42-99132/99432/99632 spec-sheet data and
  the Dufat pole/arm/anchor price list; case studies are **illustrative samples**.
- "Ficha técnica (PDF)" opens a print-optimised spec sheet (`/products/[slug]/ficha`)
  — use the print dialog to save as PDF.
- Image uploads are stored on the filesystem (`public/uploads`, a Docker volume in
  compose). Swap for object storage before deploying to serverless platforms.
