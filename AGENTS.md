# AGENTS.md

# ClinicDesk — Agent Operating Guide

## 1. Purpose

This repository contains **ClinicDesk**, a mobile-first, responsive clinic
management web app for small and medium clinics in India — dental, general,
physiotherapy, dermatology and others. Owners, doctors and staff use it;
patients never do.

Primary stack:

- Next.js 16 (App Router, React Compiler) · TypeScript (strict)
- Supabase PostgreSQL · Supabase Auth · Supabase RLS · Supabase Storage
- pg_cron + pg_net (the database's scheduler) — no worker, no Redis, no queue
- Zod · React Hook Form · SWR · Tailwind CSS 4
- Vitest · Testing Library · Playwright
- Vercel (Mumbai) + Supabase Cloud (Mumbai)
- An installable PWA; no store app

The authoritative product and architecture specification is:

`clinic-management-app-planning.md`

**The plan is the source of truth.** Before implementing any feature or making
an architectural decision, read the relevant section of the plan. Its tracker
(plan §39) says what is next; its decision log (plan §2) and open questions
(plan §41) say what has been decided and what is still a default.

The conventions follow Brio (`/Users/jaffa/projects/ovenly`). When a Brio module
fits, port it — rename `bakery` → `clinic`, keep its tests — rather than
writing a new shape.

---

# 2. Non-Negotiable Rules

## 2.1 Follow the plan

Do not invent product requirements.

Do not add features because they are technically interesting.

Do not replace an approved architecture without explicit user approval.

If the plan puts a feature in a later phase, or in **Later** (plan §42), do not
build it now.

If something is ambiguous, stop and record the ambiguity as a blocker (§34)
instead of guessing.

## 2.2 No scope creep

The user requires:

> Never divert or build something new outside the plan.

Therefore:

- No unnecessary features, tables, services, abstractions or uploads.
- No speculative microservices, workers, queues or Redis.
- No premature optimisation.
- No feature creep disguised as "best practice."

Production hardening is allowed when it protects functionality the plan already
specifies.

## 2.3 User-mandated development rules

- **Commits:** commit after every completed feature or change. The message is
  **one short, straight conventional line** — `feat: add patient search` —
  with no body and **no co-author or other attribution trailer** (the user,
  2026-10-02). Commit as **`jaFFa <jafakash.14@gmail.com>`** (plan D38).
  Work on a branch and merge to `main` through a PR with CI green.
- **Testing mandate:** write unit, database, integration and E2E tests at each
  step — not later. Coverage is 100% and CI enforces it (§31).
- **Local environment:** Docker and the local Supabase. Every env variable is
  documented in `.env.example` and set in `.env.local`.
- **Ask, don't assume:** decisions that belong to the user are asked, with a
  recommended option, and recorded in the plan's decision log.

---

# 3. Required Agent Workflow

Every development task follows this sequence:

```text
1. Read AGENTS.md
2. Read the relevant plan sections and the tracker row
3. Inspect the existing implementation (and Brio's, when porting)
4. Identify dependencies and affected modules
5. Plan the smallest implementation that satisfies the plan
6. Implement
7. Write and run the tests (unit, DB contract, integration, E2E as relevant)
8. Run lint, format check, typecheck, coverage
9. Review for scope creep
10. Update changelog.md and the tracker row
11. Record blockers if any
12. Commit the completed change
```

Never skip the plan review.

---

# 4. Before Coding

Answer internally before touching code:

- What exact requirement am I implementing, and which plan section defines it?
- Which feature owns it?
- Which tables are affected? Do they carry `clinic_id`, cascade from
  `clinics`, have RLS, and appear in the isolation and deletion tests?
- Which **permission** does it need? Does it touch patient data, so the
  **doctor scope** (`can_see_patient`) applies?
- Is it a write? Then the **read-only** rule applies (`clinic_can_write()`).
- Is any rule in it a **platform setting** (§10) rather than a constant?
- Does it need an audit row? Does it put patient data anywhere it must not go
  (§12)?
- Which shared constants, schemas, components and hooks already exist?

If the answer needs something the plan does not name, do not implement it — use
the scope-change protocol (§35).

---

# 5. Architecture Rules

**Feature-based architecture.** Code is grouped by domain feature; anything
shared by more than one feature lives in `src/lib`, `src/components`,
`src/hooks` or `src/constants`.

```text
src/
├── app/                  # Next.js routes only — thin; no business logic
│   ├── (auth)/           # register, login, confirm, forgot/reset, accept-invite
│   ├── admin/            # the developer console (DEV only)
│   └── api/              # REST endpoints (plan §30)
├── assets/brand/         # the app's own marks
├── components/
│   ├── nav/              # AppShell, AppScreen, MoreSheet, QuickAdd, PlanBanner
│   └── ui/               # the shared kit
├── constants/            # messages, statuses, roles, permissions, platform, routes, …
├── features/<domain>/
│   ├── api.ts            # server data functions (pure, take a Tenant)
│   ├── api.client.ts     # the endpoints the browser calls
│   ├── components/       # PascalCase screens and sheets
│   ├── hooks/            # useXxx.ts
│   └── types.ts
├── hooks/                # shared hooks
├── lib/                  # api, audit, dates, env, errors, format, mail, pdf,
│                         # platform, pwa, query, supabase, text, validation, …
├── proxy.ts              # the signed-in/signed-out gate (not authorization)
└── instrumentation.ts
```

- **A feature's data functions take a `Tenant`** (`src/lib/supabase/tenant.ts`):
  the caller's client, clinic, acting user, membership, role, permissions and
  doctor id, as `withClinicRoute` builds them from the session. Never
  `(client, clinicId)` separately, never a `clinicId` from the request.
- **`src/lib` never imports from `src/features`.** Features compose lib.
- **No monolithic `service.ts` / `repository.ts` classes.** Small, pure,
  focused functions.
- **Pages are composition only.** A `page.tsx` declares its first reads
  (`AppScreen`) and renders a feature component. Logic in a page is a review
  failure (pages are excluded from coverage because they hold none).
- **Strict constant centralisation:** no magic strings, no inline messages.
  Every word is in `src/constants/messages.ts`; every vocabulary the database
  knows is in `src/constants/statuses.ts` (or `roles.ts`, `permissions.ts`).
- **Use the shared UI kit.** A screen does not restyle a button, field, list
  state, sheet or card. Needed twice → it belongs in `src/components/ui`.
- Files in `src/components/ui` are kebab-case; a feature's components are
  PascalCase; hooks are `useXxx.ts`.

---

# 6. Feature Boundaries

```text
features/
├── auth/           sessions, registration, password, profile
├── clinic/         clinic details, logo, price list, closures, deleting a clinic
├── team/           members, invites, permissions, doctor profiles
├── subscription/   plan state, the owner's Plan screen
├── patients/       patients, alerts, search, profile, timeline
├── appointments/   booking, calendar, statuses, walk-ins, tokens, the queue
├── visits/         visits, vitals
├── prescriptions/  prescriptions and their items
├── treatments/     treatments, sessions, follow-ups
├── billing/        price-list bills, payments, refunds, balances, outstanding
├── expenses/
├── dashboard/      Home
├── reports/        daily and monthly
├── activity/       the clinic's audit trail (owner)
├── documents/      the bill and prescription PDFs
└── admin/          the developer console
```

Do not create a feature the plan does not list. Audit, the error log, mail,
platform settings and PDF drawing are infrastructure in `src/lib`, not
features.

---

# 7. Multi-Tenancy

The **clinic** is the tenant. Every clinic-owned table has:

```text
clinic_id uuid not null references clinics(id) on delete cascade
```

**Supabase RLS is mandatory on every table.** Never rely on frontend or
route-only filtering for isolation. Never trust a `clinic_id` the client sends:

```text
auth.uid() → clinic_members (ACTIVE) → clinic_id → RLS → rows
```

Every change is evaluated for: the authenticated user, their membership and
role, their permissions, the doctor scope, the subscription state, and RLS.

Clinic A must never reach Clinic B's data — not through the app, not through
the REST API with a valid token.

**A new clinic-owned table** must: carry `clinic_id` with the cascade, enable
RLS with the policy pattern (plan §27.4), lead an index with `clinic_id`, carry
`created_by`/`updated_by` if it holds clinical or financial data, and get a row
in the tenant-isolation test and the clinic-deletion test.

---

# 8. Roles and Permissions

Clinic roles (`clinic_members.role`):

```text
OWNER    the clinic's registrant; every permission, implicitly, clinical records
         included; exactly one per clinic
DOCTOR   granted permissions, limited to their own patients
STAFF    exactly the permissions granted
```

One person belongs to one clinic in V1 (the schema allows more).

Platform role (`profiles.platform_role`):

```text
DEV      the developer console only; never any clinic's data
```

- Permissions are the catalogue in `src/constants/permissions.ts` (plan §8.1),
  mirrored by a database `CHECK`. Do not invent a permission at a call site.
- **Every route names its permission** (`withClinicRoute(request, {
  permission }, …)`); there is no default. RLS checks it again through
  `has_permission()`.
- **Patient data needs `patients.view`**, and any `appointments.*`,
  `visits.*` or `payments.*` permission implies it.
- **The doctor scope:** a doctor reaches a patient only through
  `can_see_patient()` — assigned doctor, or any appointment, visit or
  treatment with them (`patient_doctors`).
- **A prescription belongs to the visit's doctor** (who must have a
  registration number). The doctor writes it, or staff with
  `prescriptions.write` type it for them; `entered_by` records who typed it.
- **Discounts and price changes need `payments.discount`**; without it the
  server holds the bill to the price list and the doctor's fee.
- **No escalation:** a member grants only permissions they hold, never
  `team.manage` (owner only), never to the owner or themselves.
- A role is never read from or written to Supabase `user_metadata`.
- Do not introduce new roles or permissions unless the plan adds them.

---

# 9. Authentication and Sessions

As Brio:

- Supabase Auth, **email or mobile number + password** (a mobile is
  normalised to +91 E.164; both are unique per account). Sign-up creates the
  clinic (`register_clinic`, one transaction, compensated on failure). Team
  members join by **invite link**; password reset is by **recovery link**.
- The session lives in **HttpOnly cookies** set by the server, never in
  `localStorage` or a JS variable. `src/features/auth/cookies.ts` is the only
  place that names, builds or reads them (`HttpOnly`, `SameSite=Lax`,
  `Path=/`, `Secure` outside development).
- Sign-in, refresh and confirmation answer through `withSessionRoute`; the body
  carries the session view, **never a token**.
- `src/lib/api/client.ts` refreshes once and retries on an expired token.
- `src/proxy.ts` gates on cookie presence and renews expired tokens. **It is
  not an authorization check** — the route guard and RLS are.
- The root layout hands `AuthProvider` the session view (profile, membership,
  permissions, doctor id, subscription state). Every signed-in screen is an
  `AppScreen` that arrives with its first data.
- Account boundaries (sign in, sign out) are a new page load; no account's
  cached reads are shown to the next.

Never: log a password or token, expose an auth secret, return a token in a
response body, or use the service role to act for a clinic user.

---

# 10. Business Rules Are Settings, Not Code

**The user's rule (2026-10-02):** a business rule the platform admin may want
to change is **not hard-coded**. It is a column of `platform_settings`, edited
by the DEV in the developer console (`/admin/settings`), audited, and read at
runtime.

Today that is (plan §6): trial length, monthly and yearly price, the expiry
warning window, the grace period, the expiry email days, audit retention,
error-log retention, invite validity, the lapsed follow-up window, the
deletion cooling-off, and the renewal contact details.

Rules a **clinic** sets for itself (paper size, when the consultation fee is
collected, its price list, appointment types, expense categories, doctors'
fees) live on the clinic's own rows and screens — also never in code. Code
holds only what a new clinic is seeded with (`src/constants/seeds.ts`, kept
equal to `register_clinic` by a test).

- `src/constants/platform.ts` holds **defaults and bounds only**. The migration
  seeds the row from the same values; a DB contract test keeps them equal.
  Code never uses a default as the live value.
- The database reads the row directly (`subscription_state()`,
  `clean_up_logs()`); the server reads it through `getPlatformSettings()`
  (`src/lib/platform/settings.ts`).
- Only `update_platform_settings` (DEV) writes it, within its `CHECK` bounds,
  with an audit row of old and new values.
- **When adding a rule, ask:** could the platform admin reasonably want this
  different without a deploy? If yes, it is a setting — add it to plan §6
  first. Vocabularies, transition tables and column-protecting limits stay
  constants.

---

# 11. Subscription and Read-Only

Every clinic has a subscription (`TRIAL`, `MONTHLY`, `YEARLY`) with a
`valid_until` date. Its state — `ACTIVE`, `EXPIRING`, `GRACE`, `READ_ONLY` — is
derived from that date and the settings, by `subscription_state()` in SQL and
`subscriptionState()` in TS, kept equal by a test.

**In `READ_ONLY`, nothing new is written**, enforced in three places: the UI
disables the control and says why; `withClinicRoute` refuses with
`CLINIC_PLAN_EXPIRED`; and every write policy and write function checks
`clinic_can_write()`. Reading, searching, printing and sharing existing records,
changing one's own password, the Plan screen and deleting the clinic still work.

Only the DEV extends a plan (`extend_clinic_subscription`); payments happen
outside the app and are recorded, never processed.

**One free trial per owner mobile**, ever: `trial_claims` keeps an HMAC of the
mobile (`TRIAL_CLAIM_SECRET`), never the number, and survives clinic deletion.

---

# 12. Patient Data

Clinics hold medical records. Treat every patient field as sensitive.

- **Never** put patient data in logs, the error log, URLs' query strings,
  analytics, or anything the DEV can read. The logger and `captureError`
  redact by key; a test proves it.
- Audit rows record **values** for non-clinical changes (statuses, amounts) and
  **field names only** for clinical text.
- **Bills and prescriptions are never stored** — generated on demand,
  streamed with `no-store`.
- The service worker caches no screen, API answer or PDF. Every API answer is
  `Cache-Control: no-store`.
- Clinical and financial records are **archived or voided, never deleted**;
  `created_by`, `updated_by`, `archived_by`, `voided_by` keep who did it after
  the audit purge.
- **Nothing of a patient is written to the device**: no `localStorage`,
  IndexedDB or cache. When the connection drops, what is being typed stays in
  memory on screen and saves retry with their idempotency key — nothing more.
- When the app starts keeping something new, `/privacy` changes with it.

---

# 13. Error Handling

As Brio: **one error class**, `AppError` (`src/lib/errors/AppError.ts`), with
`code` (its wording in `ERROR_MESSAGES`), `kind` (fixes the HTTP status) and
`traceId`. Built only through the factories in `src/lib/errors/kinds.ts`:

```text
validationError        → 400
authenticationError    → 401
authorizationError     → 403
notFoundError          → 404
conflictError          → 409
businessRuleError      → 422
externalServiceError   → 502
internalError          → 500
```

Never invent an error string at a call site. Never expose stack traces, SQL or
Supabase errors, secrets, tokens or passwords; a driver failure goes through
`fromSupabaseError`. Database refusals (exclusion constraint, a `CHECK`, a
function's `raise`) map to their catalogue codes (`APPOINTMENT_SLOT_TAKEN`,
`CLINIC_PLAN_EXPIRED`, …).

---

# 14. Logging and Audit

- Structured JSON logs (`src/lib/logger.ts`) with the request id, redacted.
- Every API answer carries `x-request-id`; error cards show it.
- **Audit** every mutation of patients, alerts, appointments, visits,
  prescriptions, treatments, bills, payments, expenses, team, settings and the
  clinic, through `logActionSafe(tenant, entry)` — the server writes it (service
  role), it never fails the request, and it takes the clinic and actor from the
  tenant. Platform actions (extensions, settings) are audited with
  `clinic_id = null`.
- **The error log** takes the server's own failures through `captureError`
  (5xx from `withApiHandler`, render failures from `instrumentation.ts`, side
  work that fails). 4xx refusals are not logged there.
- Both are purged by `clean_up_logs()` per `audit_keep_days` and
  `error_log_keep_days` (§10).

---

# 15. Dates and Time

A clinic's day is counted in **its timezone** (`clinics.timezone`, Asia/Kolkata
in V1). `src/lib/dates` is the only place that decides what "today", "this
month" or a local date is — on the server and in SQL alike (`local_date`
columns set by triggers). Store instants as `timestamptz`; store days as `date`.
Never `new Date().toISOString().slice(0, 10)`.

---

# 16. Money

- **Never floating point.** Integer **paise**. `src/lib/money.ts` is the only
  converter: it reads the digits typed ("₹1,500"), never multiplies a float.
- Screens show money through `formatPaise` and never divide by 100.
- A bill's totals come from one formula, `src/features/billing/totals.ts`, used
  by the preview and the server; the database recomputes and checks them.
- **Server calculations are authoritative.** The client never decides a
  total, a balance or a bill number.
- Issued bills are never edited — void and re-issue. Payments are never
  deleted — void, or refund.
- Bills and payments take an idempotency key: a double tap makes one.
- Bill numbers come from the clinic's per-financial-year counter
  (`2026-27/0001`, April – March in the clinic's timezone), never
  `max() + 1`.
- Every completed visit is `TO_BILL`, `BILLED` or `NO_CHARGE`; nothing is
  billed without a person issuing it.

---

# 17. Appointments and the Queue

- Double-booking is refused by the **database** (exclusion constraint on
  `BOOKED` appointments per doctor); the server maps it to
  `APPOINTMENT_SLOT_TAKEN`. Do not replace this with a read-then-write check.
- Statuses move only as `APPOINTMENT_STATUS_TRANSITIONS` allows, mirrored by
  `appointment_status_next()` in SQL and kept equal by a test. The same holds
  for treatments.
- Tokens come from the per-doctor, per-day counter under a row lock — never
  `max(token) + 1`.
- Closures (holidays, leave) are checked by the booking function.
- **The front desk runs the queue.** `IN_PROGRESS` and `COMPLETED` are reached
  only through `send_in`, `mark_done` and `next_patient`, which open and close
  the visit with the appointment. **Never require a doctor to record anything
  to finish a consultation** — a visit may close empty; the doctor's only
  queue control is **Next patient**.

---

# 18. Clinical Records

- A visit belongs to one patient, one doctor and at most one appointment.
- Clinical records may be typed by an assistant for the doctor: notes through
  `visits.edit`, prescriptions through `prescriptions.write`. A prescription
  is always in the visit doctor's name.
- Allergies show wherever a prescription is written and at the top of every
  visit.
- Clinical text is bounded and normalised like every other input (§24).
- Nothing clinical is deleted; corrections are recorded with `updated_by`.

---

# 19. Documents

The bill and the prescription PDFs (`src/features/documents`, drawn with
`src/lib/pdf`) are generated **on demand** from the stored records and **never
stored**: no table of generated documents, no storage bucket, no cache. They
print in **A4 or A5** (the clinic's paper size) from one layout tested at both.
The letterhead carries the clinic's own name, logo, address and phone; the app
is credited in a small footer only.

---

# 20. File Upload Policy

The **only** user-uploaded file is the **clinic logo**:

- At most 500 KB; PNG, JPG or WebP, typed by its first bytes, never the
  browser's word; validated server-side.
- Private bucket `clinic-logos`, `clinics/{clinic_id}/logo/{id}`, reachable
  only through `GET /api/clinic/logo` by the clinic's members.
- One active logo; the old one is deleted only after the new one is stored.
- Never expose a storage path.

No other upload — patient files, profile pictures, receipts, attachments — is
added unless the plan is changed (file attachments are in plan §42).

A **patient import** (plan §10.5) is not an upload: the CSV/Excel file is parsed
in the browser and only validated rows are sent, in batches; the file is never
sent or stored.

---

# 21. Background Work

**There is no worker, queue or Redis.** Work happens in the request. The two
timed jobs use the database's scheduler:

- `clean_up_logs()` hourly, by pg_cron.
- The plan emails, daily: pg_cron calls `POST /api/cron/subscription-notices`
  through pg_net with `CRON_SECRET` as a bearer token; its address and secret
  live in Supabase Vault, never in a migration. The app does the work, in the
  request, idempotently.

A failed email never undoes what it was for; it is logged. Do not add a worker,
an Edge Function or a queue until the plan brings one in.

**Messaging patients is click-to-send only** (plan §22.1): a `wa.me` link or the
share sheet with words from `WHATSAPP_TEXT`, sent by a person. No WhatsApp API,
SMS gateway or automated message until the plan brings one in.

---

# 22. PWA

The manifest (`src/app/manifest.ts`), the icons, and a service worker
(`public/sw.js`) that keeps only the app's hashed static files and an offline
page fetched without cookies. **It never caches a screen, an API answer or a
PDF.** It is set up in a built app only. **Install app** lives with the other
menus and is hidden inside the installed app.

---

# 23. UI/UX

- **Mobile first:** 360, 390 and 414 px first; **every screen ships phone,
  tablet and desktop together** (up to 1440 px).
- **Tokens only** (`src/app/globals.css`); a screen never picks a colour, a
  size or a shadow. Status and danger carry text and icon, never colour alone.
- **Light and dark themes**: every screen ships, and is checked, in both.
- **Safe areas** through `--safe-*`; heights in `dvh`, never `vh`; inputs at
  16 px; touch targets ≥ 44 px.
- **One way to report an outcome:** the **response card** (`useResponse()`).
  Field validation stays inline; a screen that cannot load shows
  `ScreenNotice` with Retry; an error card shows the API's message and its
  `requestId`, never raw text.
- **Irreversible actions ask first** on a confirm card: cancel an appointment,
  void a bill or payment, archive, deactivate a member, delete the clinic, sign
  out, extend a plan, save platform settings.
- **Read-only mode** disables write controls with the reason.
- **Accessibility is mandatory:** semantic HTML, labels, keyboard navigation,
  visible focus, focus trapped in sheets and returned, AA contrast, screen-reader
  support, accessible errors, reduced motion respected.
- `DESIGN.md` (Phase 2) is the design system; follow it.

---

# 24. Validation

- **Zod + React Hook Form.** All schemas — including form schemas — live in
  `src/lib/validation/schemas/`. A component never declares a schema of its
  own.
- Reusable pieces in `src/lib/validation/primitives.ts` (`requiredLine`,
  `optionalLines`, `indianMobile`, `optionalEmail`, `paiseText`, …), bound to
  `VALIDATION_MESSAGES`.
- Each schema exports `XxxInput` (`z.input`) and `XxxPayload` (`z.output`). A
  payload is parsed **once**, at the route boundary; `api.ts` takes the parsed
  value.
- **Input hygiene:** every text input is trimmed, whitespace collapsed,
  zero-width and control characters removed, and bounded to fit its column.
  **Passwords are never altered, not even trimmed.**
- Every message comes from `VALIDATION_MESSAGES`; a schema never falls back to
  Zod's English (a test fails if one does).
- Validate on the client for UX; again on the server; the database's `CHECK`s
  are the last word.

---

# 25. Database

- Supabase migrations only: `supabase/migrations/NNNN_snake_name.sql`,
  sequential, never edited once released. Never change a production schema by
  hand.
- Foreign keys, unique constraints, `CHECK`s for every vocabulary and bound,
  indexes for real query patterns.
- **Every vocabulary in `src/constants` that the database also knows has its
  `CHECK` kept equal by a DB contract test.** The same for platform-setting
  defaults and for transition tables.
- Every multi-row or rule-heavy write is **one SQL function** (security
  definer, `set search_path = ''`, permission and `clinic_can_write()` checked
  inside), never several client calls.
- RLS helpers are called as `(select fn())` in policies.
- Every migration has a DB contract test; behaviour that matters has an
  integration test.
- Seed data (`supabase/seed.sql`) is for local development only and never
  loaded into a hosted project.

---

# 26. API

REST route handlers, wrapped in `withApiHandler` through `withClinicRoute`,
`withDevRoute` or `withSessionRoute`. One envelope:

```json
{ "success": true, "data": {} }
```

```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "Human-readable message", "requestId": "req_..." }
}
```

- Bodies and queries are parsed by their schema (`readJson`, `readQuery`).
- Critical creates (bills, payments, appointments, walk-ins, patients) are safe
  against duplicate submission (`Idempotency-Key`).
- Every answer is `Cache-Control: no-store`.
- `apiRoutes` (`src/lib/query/keys.ts`) names every endpoint once; screens read
  through `useApiQuery` / `useApiPages` and write through `useApiMutation`.

OpenAPI is later (plan §42).

---

# 27. Constants

| File | Holds |
|---|---|
| `messages.ts` | `ERROR_MESSAGES`, `VALIDATION_MESSAGES`, `UI_TEXT`, `MAIL_TEXT` — every word |
| `statuses.ts` | every status, transition table, method, type and category, with labels and tones |
| `seeds.ts` | what a new clinic starts with (appointment types, expense categories, Consultation) |
| `roles.ts` | clinic and platform roles |
| `permissions.ts` | the permission catalogue, dependencies, presets |
| `platform.ts` | platform-setting **defaults and bounds** only (§10) |
| `routes.ts`, `navigation.ts` | screens, public paths, nav items with their permission |
| `limits.ts` | column-protecting bounds, page size, refresh intervals |
| `clinical.ts` | vital limits, prescription frequencies and timings |
| `uploads.ts`, `privacy.ts`, `terms.ts` | the logo rules, the legal pages |

---

# 28. Deleting a Clinic

**The owner requests, the DEV deletes** (plan §9.1). The owner requests it
from Settings (clinic name + password) and may cancel; after
`deletion_cooling_days` the DEV deletes it from the console. `delete_clinic`
(service role, one transaction) removes the clinic, every row hanging from it,
the logo, and the auth users of members in no other clinic — but not the trial
claim. **A new clinic-owned table must cascade from `clinics`**, and the
deletion test must find it empty afterwards. The owner can export the
clinic's data as CSV at any time, read-only included.

---

# 29. Developer Console

`/admin`, DEV only, behind `withDevRoute`: clinics and their subscriptions
(flagged **No trial** and **Deletion requested**), **Extend plan**, **Delete
clinic** (after the cooling-off), **platform settings**, accounts, the error
log and the platform audit. **It shows no clinic data** — no patients, no clinical or financial
records, no clinic activity. Every console write asks first and is audited.

---

# 30. Impeccable

Impeccable is a design-quality tool. It must not change product scope.

Use it to improve UX, accessibility, responsive behaviour, hierarchy,
typography, layout, consistency and polish — never as a reason to invent
features.

`PRODUCT.md` (product truth for design work) and the direction, **"The Clinic
Map"** (plan §32.1, D59), were set on 2026-10-02. Every screen is built in that
world; a screen never invents its own colour, shape or motion. `DESIGN.md` is
written at the end of Phase 2 from the built world and is then the design
system's authority.

```text
/impeccable shape <screen>             before building a screen not shaped in §32.1
/impeccable audit <screen>             after building it
/impeccable polish <screen>            before its phase closes
```

---

# 31. Testing

Every test lives under **`tests/`**; `src/` holds only code that ships:

```text
tests/
├── unit/          mirrors src/ exactly — src/lib/money.ts → tests/unit/lib/money.test.ts
├── contract/      route-shape contracts
├── db/            migration contracts (SQL read as text)
│   └── integration/   feature functions and RPCs against the local Supabase
├── e2e/           Playwright journeys
└── support/       setup, factories, auth helpers
```

- **One test file, one subject.** A unit test's path is its subject's path with
  `src/` → `tests/unit/` and `.test` before the extension.
  `scripts/check-test-paths.mjs` runs before every `npm test` and fails on an
  orphan or a test inside `src/`.
- **Imports and mocks use `@/` and `@tests/` paths**, never `./` or `../`.
- **Coverage is 100%** — lines, branches, functions, statements — over
  `src/**`, measured across the unit and integration projects
  (`npm run test:coverage`), **enforced in CI**. Excluded: `src/app/**/layout.tsx`,
  `src/app/**/page.tsx` (composition only, covered by E2E),
  `src/instrumentation.ts`. `/* v8 ignore */` only with a reason on the same
  line.
- **Components** are tested with Testing Library: query by role and accessible
  name, never by class or test id; mock the `api.client.ts` layer.
- **Integration tests** (`npm run test:integration`) run against the local
  Supabase only (they refuse a hosted URL), register their own clinics through
  the app's registration, act through the feature functions, and delete the
  clinics after. Every clinic-owned table has a tenant-isolation row; every
  permission a permission-matrix row (allowed and refused, by route and by RLS).
- **E2E** (`npm run build && npm run test:e2e`): the built app on port 3100, at
  **phone (390×844) and desktop (1440×900)**, against the local Supabase, with
  an **axe** check on every screen visited. A step finds a control by its role
  and its words from `UI_TEXT`.

Must cover: bill totals and discounts, balances, refunds and voids, status
transitions, tokens, the exclusion constraint, subscription states, permission
rules, the doctor scope, read-only refusal, validation and error mapping,
redaction of patient data, platform-setting bounds.

The critical journey is plan §34.4.

---

# 32. Quality Gates and Release

**CI** (`.github/workflows/ci.yml`) on every push to `main` and every PR:

```text
checks: install → lint → format check → typecheck → unit tests
app:    local Supabase (every migration) → test:coverage (unit + integration, 100%)
        → build → E2E (phone + desktop, axe)
```

**A release deploys; a push does not** (`.github/workflows/release.yml`):
publishing a GitHub release `vX.Y.Z` equal to `package.json`'s version re-runs
CI on the tag, applies new migrations to the hosted Supabase, builds on GitHub,
checks the output (`scripts/check-deploy-output.mjs`: no source, source maps or
env files), and uploads it with `vercel deploy --prebuilt`. **Vercel is never
connected to the repository.** No staging. `docs/RELEASE.md` is the guide.

Node 22 everywhere (`.nvmrc`, `engines`). The server runs in Mumbai
(`vercel.json`, `bom1`) beside the database (`ap-south-1`).

Formatting is Prettier's (120 columns). `npm run format` writes it;
`npm run format:check` is the gate. Markdown is left as written.

---

# 33. Changelog

Every development change is recorded in `changelog.md`, appended, never
rewritten:

```markdown
## 2026-10-02

### Added
- …

### Changed
- …

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed, coverage 100%.
- E2E passed (phone, desktop).

### Blockers
- None.
```

Each entry names the change, the affected module, the reason, the validation,
the blocker status, and migration notes if any. The matching tracker row in
the plan is set to **DONE (date · commit)**.

---

# 34. Blocker Log

A blocker is recorded in `changelog.md` immediately:

```markdown
### Blocker

- Status: OPEN
- Area:
- Description:
- What was attempted:
- Why it is blocked:
- Required decision/input:
- Temporary workaround:
```

Do not silently work around an architectural blocker. Do not choose an
alternative architecture without approval. When resolved, append a resolution
entry.

---

# 35. Scope-Change Protocol

If the work appears to need something outside the plan:

1. Stop that part.
2. Record it in `changelog.md`.
3. Explain why the plan is insufficient.
4. Ask the user for a decision, with a recommendation.
5. Record the decision in the plan's decision log (§2) and the section it
   changes; only then implement.

Especially for: new tables, new external services, new user-facing features,
new roles or permissions, new upload types, new authentication methods, new
infrastructure, a worker or queue, Redis, microservices, replacing Supabase, or
a business rule that should be a platform setting.

---

# 36. Definition of Done

A task is complete only when:

- The requirement matches the plan and its tracker row.
- Architecture boundaries are respected.
- Validation exists at the client, the route and the database.
- Errors are catalogue errors, mapped and shown through the response card.
- Permissions, the doctor scope, read-only and RLS are correct — and tested.
- Audit logging is added where required; no patient data leaks into logs.
- No hard-coded words, vocabularies or business rules.
- The screen works at phone, tablet and desktop widths with no axe violations.
- Tests are written and green, coverage is 100%.
- No unrelated feature was added.
- `changelog.md` and the tracker are updated; open blockers recorded.
- The change is committed.

---

# 37. Final Agent Rule

When uncertain:

```text
Do not guess.
Do not expand scope.
Do not invent.
Read the plan.
Record the blocker.
Ask for the decision.
```

The plan wins over agent preferences. The user's explicit requirements win over
generic "best practices".

<!--
`next dev` appends a "This is NOT the Next.js you know" block here on first
run (Next 16). Keep it: it tells an agent to read node_modules/next/dist/docs
before writing Next.js code, because APIs differ from older training data.
-->
