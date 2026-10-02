# ClinicDesk

A mobile-first, responsive clinic management web app for small and medium
clinics in India: patients, appointments and the walk-in queue, visits with
vitals and prescriptions, treatments and follow-ups, bills and payments,
expenses and reports.

**Stack:** Next.js 16 · TypeScript · Supabase (PostgreSQL, Auth, Storage, RLS) ·
Vercel. Installable as a web app (PWA).

- [`clinic-management-app-planning.md`](./clinic-management-app-planning.md) —
  the plan: the source of truth for what is built and in what order.
- [`AGENTS.md`](./AGENTS.md) — how to work in this repository.
- [`PRODUCT.md`](./PRODUCT.md) — product context for design work.
- [`changelog.md`](./changelog.md) — every change, as it is made.

---

## Running it locally

### What you need

- **Node 22** (`.nvmrc`; `nvm use` picks it).
- **Docker**, running — the local Supabase stack runs in it.
- **The Supabase CLI** (`brew install supabase/tap/supabase`).

### First run

```bash
nvm use
npm install
cp .env.example .env.local
npm run db:start        # Postgres, Auth, Storage and Mailpit, in Docker
npm run db:reset        # applies the migrations and loads the demo data
npm run dev
```

Then open <http://localhost:3000>.

ClinicDesk's local Supabase runs on **553xx** ports, so it can run beside
another local Supabase project:

| | |
|---|---|
| The app | <http://localhost:3000> |
| Supabase API | <http://127.0.0.1:55321> |
| Supabase Studio | <http://127.0.0.1:55323> |
| Mail (Mailpit) | <http://127.0.0.1:55324> |

`supabase status` prints every URL and key the running stack uses.

---

## Checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm test                          # unit tests
npm run test:integration          # against the local Supabase (npm run db:start)
npm run test:coverage             # unit + integration; fails below 100%
npm run build && npm run test:e2e # browser journeys, phone and desktop, port 3100
```

CI (`.github/workflows/ci.yml`) runs all of them on every push to `main` and
every pull request.
