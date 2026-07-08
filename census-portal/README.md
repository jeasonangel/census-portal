# Cameroon Census Data Portal

A full-stack web platform that publishes Cameroon census-style demographic data
(population, literacy, water/electricity access, employment, etc.) for every
administrative level of the country — region, department, district and
village — through both a browsable web UI and a public/authenticated REST
API. Built as an academic/portfolio project to demonstrate a realistic
government open-data portal: hierarchical geographic data, API-key issuance
and quota management, role-based access, and a small internal analytics
layer.

> This document is a technical summary of everything implemented in the
> project, written to be handed to an AI assistant (or a reader unfamiliar
> with the codebase) as source material for an academic report. It describes
> what exists **today**, why it was built that way, and which concrete bugs
> were found and fixed during development.

---

## 1. Project Purpose

National statistics offices publish census data, but the raw data is often
locked in PDFs or spreadsheets that are hard to query programmatically. This
project simulates what a modern, developer-friendly version of that portal
looks like:

- A **public-facing website** where anyone can browse population and
  socio-economic indicators by drilling down Region → Department → District
  → Village.
- A **REST API** that NGOs, researchers, journalists and app developers can
  register for, get an API key, and pull the same data into their own
  applications, dashboards, or research pipelines.
- **Free/paid tiering** on API access, mirroring how real data-platform APIs
  (e.g. World Bank Open Data, government open-data portals) commonly manage
  access at scale.

The underlying dataset (populations, literacy rates, etc.) is **synthetic**
— clearly labelled in the data as `Fictitious Census 2026` — because
Cameroon's real next census has not been published. The point of the project
is the *platform engineering* (data modeling, API design, auth, access
control), not claiming to be an authoritative statistical source.

---

## 2. High-Level Architecture

```
┌─────────────────────────┐        HTTPS/JSON        ┌──────────────────────────┐
│   Frontend (React SPA)  │ ────────────────────────▶ │  Backend (Express API)  │
│  Vite + TypeScript      │ ◀──────────────────────── │  Node.js + TypeScript   │
└─────────────────────────┘                            └────────────┬─────────────┘
                                                                      │ SQL (pg)
                                                                      ▼
                                                          ┌──────────────────────┐
                                                          │   PostgreSQL 15+     │
                                                          └──────────────────────┘
```

- **Frontend** (`frontend/`): a single-page React application (React 19 +
  Vite 8 + TypeScript) that consumes the backend's public REST endpoints for
  the browsing experience, and its authenticated endpoints for account/API
  key management.
- **Backend** (`backend/`): a Node.js/Express REST API that owns all
  business logic — geography hierarchy, indicator data, authentication,
  API-key issuance, quota enforcement, and a small internal analytics layer.
- **Database**: PostgreSQL, accessed via the `pg` driver with hand-written
  SQL (no ORM), using a `spatial_geo` self-referencing table to model the
  4-level administrative hierarchy.

Nothing runs server-side rendered; the frontend is a pure client-side SPA
served as static assets, calling the API over `fetch`/`axios`.

---

## 3. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 19 + TypeScript | Function components, hooks only, no class components |
| Build tool | Vite 8 | Dev server + production bundler |
| Styling | Tailwind CSS 3.4 | Utility-first CSS; small custom design-token layer (`cam-*` colors) and a handful of `@apply`-based component classes (`.card`, `.btn-primary`, `.input`, etc.) |
| Routing | React Router 7 | Client-side routing, 5 routes |
| HTTP client | Axios | Wrapped in a small `src/lib/api.ts` module exposing typed API clients |
| Icons | lucide-react | Icon set used throughout the UI |
| Charting library | Recharts | Installed, available for future data-visualization work (not currently rendering a chart) |
| Backend runtime | Node.js + Express 5 | REST API, no GraphQL |
| Language | TypeScript (strict mode) | Both frontend and backend are fully typed; `tsc --noEmit` is used as a CI-style gate |
| Database | PostgreSQL | Accessed via the `pg` driver directly (raw parameterized SQL, no ORM) |
| Auth | JSON Web Tokens (`jsonwebtoken`) + API keys | Two independent auth schemes for two different audiences (see §6) |
| Password hashing | bcrypt | 10 salt rounds |
| Security middleware | `helmet`, `cors`, `compression` | Standard Express hardening middleware |
| Dev tooling | `ts-node-dev` | Hot-reloading backend dev server |

---

## 4. Database Design

Six tables, all in a single `schema.sql` applied via a custom migration
runner (`npm run migrate`, see §9 for a bug that was found and fixed in that
runner).

### `users`
Stores accounts. Key columns beyond the obvious (`email`, `password_hash`,
`full_name`, `organization`):
- `user_type` — a **role** of either `USER` or `ADMIN` (an earlier version
  had five separate NGO/researcher/journalist tiers with different monthly
  quotas; they were never reachable — registration always created
  `NGO_DEVELOPER` accounts with no way to pick or change tier — so they were
  collapsed into a single `USER` role). Each role has a **monthly request
  quota** (see `RATE_LIMITS` in `backend/src/config/index.ts`): `USER` gets
  150,000 requests/month, `ADMIN` is unlimited.
- `plan` — a separate **billing tier** axis (`FREE` or `PAID`), independent
  of `user_type`. This governs *how many API keys* an account may hold
  simultaneously, not the request quota. See §7.
- `monthly_limit` / `requests_used` — the numeric quota state, incremented
  on every authenticated API-key request.
- `is_active`, `is_verified` — account status flags.

### `api_keys`
One row per issued API key. Keys are never stored in plaintext: only a
bcrypt **hash** of the raw key plus a 12-character **prefix** (used to
quickly look up candidate rows before running the expensive bcrypt compare).
A key can be soft-deleted via `is_active = false` (revocation), never hard
deleted, preserving audit history.

### `spatial_geo`
A single self-referencing table modeling **all four geography levels**
(`region`, `department`, `district`, `village`) via a `parent_id` foreign
key pointing back into the same table. This is a classic adjacency-list
hierarchy: a village's parent is a district row, a district's parent is a
department row, a department's parent is a region row, and a region has no
parent. `code` is a globally-unique short identifier (e.g. `CE` for Centre
region, `MF` for Mfoundi department) used throughout the API instead of
numeric IDs. Includes `population`, `area_km2`, and unused `latitude` /
`longitude` columns reserved for a future real-map integration (a
`geom GEOMETRY` column was also carried in the schema for this but was
removed — the PostGIS extension was never enabled and nothing ever
populated or queried it; see §11).

### `indicators`
The catalogue of measurable statistics (10 seeded): `POP_TOT`, `POP_MALE`,
`POP_FEMALE`, `POP_URBAN`, `POP_RURAL`, `LIT_RATE`, `SCHOOL_ENROLL`,
`WATER_ACCESS`, `ELECTRICITY_ACCESS`, `EMPLOYMENT` — grouped into categories
(`Demography`, `Education`, `Housing`, `Economy`).

### `data_values`
The actual fact table: one row per `(geography, indicator, year, gender,
age_group)` combination, holding a decimal `value`. A `UNIQUE` constraint on
that tuple plus `ON CONFLICT DO UPDATE` upserts in the seed script make
re-seeding idempotent.


### `usage_logs`
A table for per-request audit logging (`endpoint`, `method`, `status_code`,
`response_time_ms`, `ip_address`, `timestamp`) — schema exists but is not
yet written to by the request pipeline; a natural next step (see §11).

---

## 5. Geographic Data Coverage (Seed Data)

The seed script (`backend/src/scripts/seed.ts`) populates the full
administrative hierarchy with **real Cameroon administrative divisions**,
not placeholder data:

| Level | Count | Notes |
|---|---|---|
| Regions | 10 | All 10 real regions of Cameroon |
| Departments | 58 | All 58 real departments, correctly distributed across their regions (e.g. Centre region has 10 departments, South has 4) |
| Districts (arrondissements) | 174 | 3 per department, mixing real arrondissement names where known with plausible chef-lieu-based names |
| Villages | 80 | A representative sample (2 per district) under the original 20 "pilot" departments |
| Indicators | 10 | Demography, Education, Housing, Economy categories |

Every department/district/village indicator value is either **hand-authored**
(the original 20 departments / 40 districts / 80 villages) or
**programmatically derived** (the remaining 38 departments / 134 districts)
by a small generator function (`deriveIndicators` in `seed.ts`) that scales
each region's real baseline statistics by a population-rank weight — larger,
more urban departments get proportionally higher literacy/water/electricity
access figures, smaller peripheral ones get lower figures, mirroring the
real-world urban/rural gap. This was a deliberate design choice: rather than
hand-typing ~2,300 additional numbers, the generator guarantees every new
department/district has **internally consistent, plausible** figures
(male+female sums to total, urban+rural sums to total, all percentages
clamped to realistic ranges).

An admin user and its default API key are also created by the seed script,
credentials sourced from environment variables (`ADMIN_EMAIL`,
`ADMIN_PASSWORD` in `.env`).

---

## 6. Authentication Model — Two Schemes for Two Audiences

This is one of the more interesting design decisions in the project. The
API deliberately uses **two independent authentication mechanisms** for two
different kinds of caller:

### a) JWT (session) auth — "I am managing my own account"
Used for `/auth/login`, `/auth/register`, and everything under
`/protected/keys` and `/protected/usage`, and all `/admin/*` routes.
A user logs in with email/password, receives a signed JWT
(`jsonwebtoken`, 7-day expiry, `HS256`), and sends it as
`Authorization: Bearer <token>` for anything that's about *their own
account* — listing their keys, creating a new key, checking their usage,
or (for admins) managing other users.

### b) API key auth — "I am consuming the data API"
Used for `/protected/data` and everything under `/analytics/*`.
The caller sends `X-API-Key: <raw key>`. The server looks up the key by its
12-character prefix, verifies the full key with `bcrypt.compare`, checks the
account's remaining monthly quota, increments `requests_used`, and updates
`last_used`. This is the scheme an external NGO application would use in
production — a long-lived credential embedded in server-side code, not tied
to a browser session.

**Why two schemes instead of one:** early in development, key management
endpoints (`GET /keys`, `POST /keys`) were *also* gated behind
`X-API-Key`, which created a chicken-and-egg problem — a user who logged in
on a fresh browser (no cached key in `localStorage`) had no way to view or
create their own keys, because doing so required already possessing a key.
This was found and fixed by splitting the middleware into
`authenticateApiKey` and `authenticateJWT` (`backend/src/middleware/auth.ts`)
and moving account-management endpoints onto the session-based scheme,
while data-consumption endpoints stayed on the API-key scheme. Registration
was also changed to issue a JWT immediately (previously only `login` did),
so a freshly-registered user can manage their account right away.

---

## 7. API Key Limits & the Free/Paid Plan System

A deliberate product constraint was implemented: **each account may hold
only 1 active API key on the free plan.**

- `PLAN_LIMITS` (`backend/src/config/index.ts`) maps a plan name to a
  maximum key count: `FREE → 1`, `PAID → 10`.
- `POST /protected/keys` counts the caller's currently-active keys and
  rejects creation with `403 PLAN_LIMIT_REACHED` (a custom error code, not
  just an HTTP status, so the frontend can branch on it specifically) once
  the limit is reached. `ADMIN`-role accounts bypass this check entirely.
- There is **no payment gateway** — upgrading a user from `FREE` to `PAID`
  is a manual/admin action: `PATCH /admin/users/:id/plan`, gated by a
  `requireAdmin` middleware that checks `user_type === 'ADMIN'`. This
  models a realistic soft-launch flow (support staff grant access) rather
  than building out full billing infrastructure, which was an explicit
  scope decision made with the project owner rather than an oversight.
- `GET /protected/usage` reports both the request-quota state *and* the
  key-count state (`plan`, `api_keys_used`, `api_keys_limit`) so the
  frontend can show "1/1 keys used — upgrade to create more" instead of a
  generic error.
- The frontend (`ApiKeyManager.tsx`) proactively disables the "Create Key"
  form and shows an explanatory notice once the limit is reached, rather
  than only reacting to a failed request.

This whole feature (schema column, backend enforcement, admin endpoint,
frontend UI) was built, then **verified end-to-end against a live local
Postgres database** with a scripted test: register → hit the 1-key limit →
confirm `403 PLAN_LIMIT_REACHED` → admin login → admin lists users → admin
upgrades the account to `PAID` → confirm a second key can now be created →
confirm `/usage` reflects the new plan and count.

---

## 8. API Surface

Base URL: `http://localhost:3001/api/v1` (configurable via `PORT`/`VITE_API_URL`).

### Public — no authentication (`/public/*`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/public/regions` | List all regions |
| GET | `/public/regions/:code/departments` | Departments in a region |
| GET | `/public/departments/:code/districts` | Districts in a department |
| GET | `/public/districts/:code/villages` | Villages in a district |
| GET | `/public/indicators` | List all indicators |
| GET | `/public/data?geography=&indicator=&year=` | Fetch a single data point |
| GET | `/public/search?q=` | Free-text search across all geography names |

### Auth — no authentication required to call (`/auth/*`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create account + default API key + JWT, all in one call |
| POST | `/auth/login` | Exchange email/password for a JWT |

### Protected — mixed auth (`/protected/*`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/protected/keys` | JWT | List the caller's own API keys |
| POST | `/protected/keys` | JWT | Create a new key (enforces plan limit) |
| DELETE | `/protected/keys/:id` | JWT | Revoke a key |
| GET | `/protected/usage` | JWT | Quota + plan + key-count summary |
| GET | `/protected/data?geography=&indicator=&year=` | API key | The actual data-consumption endpoint external apps use |

### Analytics — API key required (`/analytics/*`)
Built as a second, richer data-access layer aimed specifically at NGO
developers embedding census data into their own products — **not surfaced
anywhere in the Data Explorer UI**, but fully live and documented so any
holder of a valid API key can use it. Counts against the same monthly quota
as `/protected/data`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/analytics/regions?year=` | Every region with its full indicator profile in one call (JSON-aggregated) |
| GET | `/analytics/regions/:code?year=` | Single region's full profile |
| GET | `/analytics/regions/rank/water?year=` | Regions ranked by water-access indicator |
| GET | `/analytics/departments/rank?indicator=&region=&order=&limit=&year=` | Generalized department ranking by any indicator, optionally scoped to one region |
| GET | `/analytics/compare/regions?codes=CE,LT,NO&year=` | Side-by-side comparison of 2+ regions across every indicator |
| GET | `/analytics/best-worst?indicator=&level=&year=` | Best- and worst-performing geography for any indicator at any level |

### Admin — JWT + ADMIN role required (`/admin/*`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/users` | List all accounts with plan, quota, and active-key count |
| PATCH | `/admin/users/:id/plan` | Grant/revoke a plan upgrade |

All error responses share a consistent shape: `{ "error": { "code": "...",
"message": "..." } }`, with domain-specific codes (e.g.
`PLAN_LIMIT_REACHED`) used where the frontend needs to branch on *why* a
request failed, not just that it failed.

---

## 9. Notable Bugs Found and Fixed During Development

Documented here because they're the kind of concrete "problems encountered
and solved" detail an academic report typically wants:

1. **Silent modal bug (frontend).** The "create API key" flow set the new
   key's value in state but never actually opened the modal that displays
   it (`setShowModal(true)` was missing), so users could generate a key but
   had no way to see or copy it. Found by code review, fixed, then the
   whole flow was re-verified live.

2. **Chicken-and-egg authentication bug (backend).** As described in §6,
   key-management endpoints originally required an API key to access, but
   a fresh login provides no API key — locking newly-logged-in users out of
   managing their own keys. Fixed by introducing a second, session-based
   (JWT) auth path for account-management endpoints.

3. **Non-functional migration runner (backend).** `migrate.ts` split the
   schema SQL file on `;` and skipped any resulting chunk that, after
   trimming, started with a `--` comment. Since **every single statement**
   in `schema.sql` is preceded by a `--` section-header comment, this meant
   `npm run migrate` silently skipped every statement and did nothing —
   the database had clearly been provisioned some other way (manual
   `psql`) rather than through this script. Fixed by stripping full-line
   comments before splitting into statements. Running the corrected script
   against the real local database then surfaced a **second**, previously
   masked bug — the `CREATE INDEX` statements lacked `IF NOT EXISTS`, so
   they failed on a database where the indexes already existed. Both fixes
   were verified by actually running `npm run migrate` against a live
   Postgres instance and inspecting `information_schema.columns`
   afterward to confirm the new `plan` column had landed.

4. **Pre-existing TypeScript errors (backend).** `req.user` and
   `req.apiKeyId` were being set at runtime (`middleware/auth.ts`) without
   ever being declared on Express's `Request` type, and a Postgres
   `rowCount` (which the `pg` types mark as possibly `null`) was compared
   directly with `> 0`. Both caused `tsc --noEmit` failures. Fixed with a
   proper `types/express.d.ts` global augmentation and a null-coalescing
   check (`?? 0`).

5. **Missing Vite environment types (frontend).** `import.meta.env` was
   used throughout `lib/api.ts` without the standard `vite-env.d.ts`
   triple-slash reference, so it failed to typecheck even though it worked
   at runtime. Added the missing declaration file.

6. **Accessibility regression caught during a UI redesign.** A full
   dark→light visual redesign (later reverted at the project owner's
   request, see §10) surfaced that the brand yellow (`#FCD116`) was being
   used as **text color** on light backgrounds in ~26 places (active nav
   links, breadcrumbs) — roughly a 1.4:1 contrast ratio, far below the
   WCAG AA minimum of 4.5:1 for normal text. This is documented here
   because it's a good concrete example of a contrast/accessibility issue
   surfaced by changing a design's background lightness, even though the
   final shipped state reverted to the original dark theme.

---

## 10. Frontend Structure

Five routed pages (`react-router-dom`), a shared `Header`/`Footer`, and a
small typed API client layer:

| Page | Route | Purpose |
|---|---|---|
| `Home.tsx` | `/` | Landing page: hero, stat cards, feature cards |
| `DataExplorer.tsx` | `/explorer` | The core browsing UI — a collapsible Region→Department→District→Village tree in a sidebar, an indicator picker, a breadcrumb trail, a results table, and CSV export. Calls only the public API (no auth needed to browse) |
| `ApiKeyManager.tsx` | `/api-keys` | Account dashboard: usage stats, plan badge, key creation/revocation, the one-time key-reveal modal |
| `Login.tsx` / `Register.tsx` | `/login`, `/register` | Auth forms, including a password-visibility (eye icon) toggle |

`src/lib/api.ts` centralizes all HTTP calls into three typed factories:
`publicApi` (no auth), `accountApi(token)` (JWT-bearer, for key/usage
management), and `protectedApi(apiKey)` (X-API-Key, for the actual data
endpoint) — deliberately kept as separate objects so it's obvious at every
call site which credential a given request needs.

Styling uses a small custom Tailwind design-token layer (`cam-green`,
`cam-red`, `cam-yellow` — the Cameroon flag colors — plus `cam-ink`,
`cam-panel`, `cam-line`, `cam-muted` for the neutral palette) defined once
in `tailwind.config.js` and consumed as utility classes everywhere,
alongside a handful of `@apply`-based shared component classes in
`index.css` (`.card`, `.btn-primary`, `.btn-secondary`, `.btn-outline`,
`.input`, `.label`, `.flag-bar`) so buttons/cards/inputs stay visually
consistent without a component library.

---

## 11. Known Limitations & Possible Future Work

Useful section for a report's "future work" discussion:

- **No real payment processing** — plan upgrades are admin-granted only;
  integrating a payment gateway (Stripe, etc.) would be the natural next
  step for a production version.
- **No admin UI** — the `/admin/*` endpoints exist and are tested, but
  there's no frontend page for them yet; an admin currently has to call the
  API directly.
- **`usage_logs` table is unused** — the schema supports detailed
  per-request audit logging but nothing currently writes to it; wiring it
  up would enable real usage analytics/rate-limit dashboards.
- **Only 80 of the eventual village-level rows have indicator data
  seeded** (the original 20 pilot departments' villages); the other
  villages under the 38 newer departments don't exist yet at all, and
  could be generated with the same population-weighted approach used for
  departments/districts.
- **No automated test suite** — verification so far has been TypeScript's
  strict-mode compiler checks, `vite build`, and manual/scripted
  end-to-end smoke tests run against a live database during development,
  not a committed Jest/Vitest suite.
- **No real map view** — `spatial_geo` carried an unused `geom GEOMETRY`
  column intended for PostGIS boundary data, but the extension was never
  enabled and nothing ever populated it, so it was removed; adding a real
  map would mean loading actual polygon/boundary data and re-enabling
  PostGIS properly, not resurrecting the empty column.
- **Recharts is installed but not used** — the Data Explorer currently
  renders results only as a table; a chart view was scoped out but the
  dependency is already in place.

---

## 12. Running the Project Locally

```bash
# Backend
cd backend
# create a .env with: PORT, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
# JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run migrate        # creates all tables (idempotent — safe to re-run)
npm run seed            # populates regions/departments/districts/villages/indicators + admin user
npm run dev              # starts the API on http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev              # starts the SPA on http://localhost:5173 (default Vite port)
```

The frontend expects the API at `VITE_API_URL` (defaults to
`http://localhost:3001/api/v1` if unset).


Database_URL: postgresql://postgres.rhnokcskctbqstdtahga:Mesanges1234@aws-1-us-west-2.pooler.supabase.com:5432/postgres
