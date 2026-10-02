# Changelog

All notable changes to this project are recorded here, newest last. Entries are
appended and never rewritten (AGENTS.md §33).

## 2026-10-02

### Added
- **The plan** (`clinic-management-app-planning.md`): the product, its
  specifications, the architecture, the data model, the API, the screens, the
  testing and release process, and the delivery phases 0 – 13 with a tracker.
  It replaces the initial draft, which is kept at
  `docs/planning/2026-10-02-initial-draft.md`; plan §43 lists every change.
- **The decision log** (plan §2, D1 – D22): self-serve sign-up; email invites;
  doctors limited to their own patients; bills with a patient balance;
  prescriptions, vitals and alerts in V1; dental later; database-enforced
  booking with walk-in tokens and closures; web + PWA; India only; a developer
  console with plan extension; the trial and subscription with grace and
  read-only; 1-month audit and 7-day error retention; our own design system;
  100% coverage enforced; Brio's release process; a landing page with pricing;
  numbered bills without GST; SMTP mail; AGENTS.md; and business rules as
  platform settings.
- **`AGENTS.md`** — how to work in this repository, adapted from Brio's —
  and **`CLAUDE.md`**, which loads it.
- This changelog.

### Changed
- `README.md` now points to the plan, AGENTS.md and this changelog.

### Validation
- Planning only; no code yet.

### Blockers
- None. The open questions in plan §41 each carry a default that is built if
  no answer arrives before its tracker row starts.

## 2026-10-02 — planning, second round

### Changed
- **The front desk runs the queue** (plan D43 – D46, §11.4, §12.1, §15.6).
  Staff send patients in and mark them done; the doctor has one **Next
  patient** button. Visits open and close with the queue and may close with
  nothing recorded. Assistants may type notes and, with the new
  `prescriptions.write`, prescriptions in the doctor's name. Every finished
  visit is *To bill*, *Billed* or *No charge*, and checkout is a To-bill list.
  Each clinic chooses whether the consultation fee is taken at arrival or after.
- **Access** (D23 – D25): one clinic per person in V1; exactly one owner;
  owners see everything.
- **Billing** (D26, D27, D29, D30): a per-doctor consultation fee; bill numbers
  per financial year (`2026-27/0001`); discounts and price changes need the
  new `payments.discount`; a small ClinicDesk footer on documents.
- **Clinic-owned lists** (D32, D40): appointment types and expense categories
  are per clinic, seeded from `src/constants/seeds.ts`.
- **Accounts** (D39, D42): sign in with email or mobile; one free trial per
  owner mobile, remembered as a keyed hash that outlives the clinic.
- **Deleting a clinic** (D37, D41): the owner requests and may cancel; the
  admin deletes after `deletion_cooling_days` (a new platform setting); the
  owner can export CSVs at any time.
- **Look and print** (D28, D31, D33 – D36): A4 and A5; °F; name, mobile,
  age/DOB and gender required for a patient; queue refresh every 15 s; light
  and dark themes; "ClinicDesk" is a working name behind one constant.
- **Commits** are authored `jaFFa <jafakash.14@gmail.com>` (D38).
- `AGENTS.md` follows all of the above. Plan §41 marks which questions are
  answered; Q1 (final name), Q2 (renewal contact), Q3 (domain) and Q22
  (legal review) remain open.

### Validation
- Planning only; section cross-references checked.

### Blockers
- None.

## 2026-10-02 — planning, third round

### Changed
- **Front desk and patients** (plan D47 – D52): WhatsApp click-to-send for
  reminders, bills and prescriptions (§22.1); a day-end collection summary by
  method and receiver (§18); patient import from CSV/Excel, parsed in the
  browser and never stored (§10.5). No token display, self-booking or referral
  source in V1.
- **Doctors and reports** (D53, D54): Monthly revenue by doctor (billed and
  paid to date — bills now record their doctor); repeat last prescription and
  per-doctor prescription templates (§13).
- **Reliability and security** (D55 – D57): online-only with nothing lost —
  an offline banner, retried saves, nothing of a patient on the device; no
  idle lock; two-factor authentication later.
- **Plan receipts** (D58): a receipt PDF for every plan payment, numbered
  `R/2026-27/0001`, from new platform settings for the business name and
  address.
- `AGENTS.md`: no patient data on the device; the import is not an upload;
  messaging is click-to-send only.

### Validation
- Planning only; section and decision cross-references checked.

### Blockers
- None.

## 2026-10-02 — design direction

### Added
- **`PRODUCT.md`** (Impeccable init): users, purpose, the four positioning
  claims, the operating context, warm-and-reassuring voice, the user's binding
  visual constraints (no gold, light and dark, the centre ＋), and the
  accessibility needs of older doctors, staff new to software, budget phones
  in bright rooms, and the shared reception desktop.
- **The visual direction, "The Clinic Map"** (plan D59, §32.1; Impeccable
  shape, seed `d61c6e96`): the guide-map world chosen by the user, translated
  for a clinic — a flat green land field with a coastline edge leads each
  screen; capsule controls whose chip travels when live; the lake (the
  patient with the doctor) and the coral pin (the one thing not to miss);
  green + ink + one coral; no yellow, gold, photos or bounce; light and dark.
  The brief covers the shell, Quick Actions and five screens: Home, Queue,
  Patient profile, Visit, Checkout.

### Changed
- The user's design references moved to `design-references/`, git-ignored, as
  in Brio; Impeccable's working folders are git-ignored too.
- Plan §32 split into 32.1 (the direction) and 32.2 (the rules); Phase 2 and
  rows R2.1 – R2.3 follow it. `AGENTS.md` §30 points to it.

### Validation
- Planning only.

### Blockers
- None. The exact colour values and the typeface are settled at R2.2 against
  contrast and ₹ coverage.

## 2026-10-02 — Phase 0, groundwork

### Added
- The Next.js 16 app: TypeScript strict, Tailwind 4, React Compiler, ESLint
  (with `src/lib` barred from importing features), Prettier, Node 22.
- The test harness: Vitest unit and integration projects (integration refuses
  a hosted Supabase), coverage enforced at 100% (proved to fail on an
  untested file), Playwright at phone and desktop widths with an axe check,
  and the test-path checker.
- The local Supabase on 553xx ports, an 8-character minimum password,
  `.env.example`, and the readme's setup and checks.
- CI: lint, format, types and unit tests; then the local Supabase, coverage
  across unit and integration, the build and the journeys.
- The core library, ported from Brio and adapted: errors and their mapping,
  the route handler and response envelope (now `Cache-Control: no-store`),
  the browser client, idempotency keys, paging, the SWR hooks, env
  validation, a logger that also redacts patient identity and clinical
  fields, input hygiene, validation primitives, money in paise, +91 mobiles
  and WhatsApp links with a message, currency and date formatting, the
  clinic's calendar with the financial year, ages and estimated birth dates,
  and the routes with open-redirect protection.

### Changed
- Commit messages are one short line with no co-author trailer (the user);
  every earlier commit was rewritten to match, and `AGENTS.md` §2.3 says so.

### Validation
- Lint, format check and typecheck clean; 272 unit tests pass with 100%
  coverage of lines, branches, functions and statements; the production
  build and the smoke journey pass at phone and desktop widths, axe clean.

### Blockers
- Status: OPEN
- Area: CI and the local database
- Description: CI has never run, and `npm run db:start` is unverified.
- What was attempted: everything else ran locally.
- Why it is blocked: there is no GitHub remote yet, and Docker was not running.
- Required decision/input: create the GitHub repository and push; start Docker.
- Temporary workaround: none needed until Phase 1's integration tests.

## 2026-10-02 — Phase 1, identity, tenancy and security

### Added
- **Migrations 0001 – 0008** (R1.1 – R1.8):
  - `0001_foundation`: the extensions, nothing open by default (EXECUTE taken
    from PUBLIC; tables, sequences and functions from the API roles), the
    `updated_at` and `created_by`/`updated_by` triggers, and the text-hygiene
    checks the app's normalising mirrors.
  - `0002_identity`, `0003_clinics_and_members`: profiles (email and mobile
    each unique), clinics, members (one owner per clinic, one clinic per
    person), doctors (only on an owner or doctor, in the same clinic), the
    permission catalogue and its dependencies as a `CHECK`, the DEV kept out of
    every clinic both ways, and the RLS helpers.
  - `0004_platform_settings`: the one row with plan §6's defaults and bounds,
    and `update_platform_settings` (DEV only, unknown names refused, audited
    from and to).
  - `0005_subscriptions`: the plan, payments with receipt numbers per financial
    year, trial claims kept as an HMAC, the state rule, `clinic_can_write()`,
    `require_clinic_write()` and `extend_clinic_subscription`.
  - `0006_logs`: the audit trail and the error log, and the hourly
    `clean_up_logs()` reading the retention settings.
  - `0007_clinic_catalogues`: price list, appointment types, expense categories,
    written with `settings.manage` while the clinic can write; archived, never
    deleted.
  - `0008_register_clinic`: sign-up's one transaction, seeding exactly
    `src/constants/seeds.ts`.
- **Constants:** roles, the permission catalogue with dependencies and presets,
  the vocabularies, the platform-setting defaults and bounds, the seeds, and the
  text limits each column and form share.
- **Server:** platform settings, the plan state (`subscriptionState`), audit and
  error logging, the mail service (nodemailer, Mailpit locally) with the
  confirmation and reset emails, registration with compensation and one trial
  per mobile, sessions in HttpOnly cookies (sign-in by email or mobile, refresh,
  sign-out, the session), `proxy.ts` with renewal, `withClinicRoute`,
  `withAccountRoute` and `withDevRoute` building the `Tenant`, password reset by
  link, change password and the profile — and the eleven `/api/auth/*` routes.
- **Tests:** a DB contract for every migration and for `supabase/config.toml`,
  each keeping a `CHECK`, default or bound equal to its constant; a contract
  over all migrations (RLS on every table, nothing granted to `anon`, an empty
  search path on every function, catalogue codes only, known permissions and
  roles, every clinic-owned table cascading and indexed); unit tests for every
  new file; and integration tests against the local Supabase — sign-up through
  Mailpit, tenant isolation, the permission matrix so far, read-only refusal
  through REST and the routes, the DEV seeing no clinic rows, settings taking
  effect at once, and the SQL and TS plan rules agreeing day by day.

### Changed
- `withApiHandler` puts a 5xx in the error log under the request id; a 4xx
  refusal goes to the output only.
- `fromSupabaseError` reads `22023` (an argument a function does not take) as
  a validation error.
- The email primitives take their bound from `TEXT_LIMITS.email`; the phone
  pattern and digit count are shared with `is_phone_number()`.
- Local Supabase: sign-up through the public key off; mobile sign-in on with no
  SMS sent; email links valid 24 hours; redirects to ports 3000 and 3100; the
  app's mail through Mailpit on 55325; the Auth rate limits raised **locally
  only**, since the test suites sign in hundreds of times a minute (production
  keeps Supabase's, reviewed at R13.1).
- Plan: R1.1 – R1.11 done; Q23 and Q24 added; R3.4 waits on Q23.

### Defaults taken where the plan was silent (open to change)
- A new clinic prints on **A4** and collects the fee **after the
  consultation** (Q24).
- A clinic's own phone is kept as typed, mobile or landline (6 – 15 digits),
  as its letterhead prints it; an account's mobile is +91 E.164.
- A confirmation or reset email can go again to the same account after 60
  seconds; the links work for 24 hours, the most Supabase allows.
- A mobile that has had its trial starts its new clinic view-only at once: its
  last day is set 61 days back, past the longest grace the bounds allow.
- Only money received gets a receipt number; a ₹0 extension has none.

### Found while building (Supabase Auth)
- Setting a password through the admin API ends every session of the account,
  the one asking included: changing and resetting a password answer with a
  fresh session.
- Updating a phone through the admin API does not refuse one another account
  holds: the profile's unique index is written first, and put back if Auth
  refuses.
- Signing out revokes refresh tokens only; an access token lasts until it
  expires. A deactivated member is stopped by the membership check on every
  request and in RLS, not by the token.

### Validation
- Lint, format check and typecheck clean.
- 583 unit and 53 integration tests pass; coverage 100% of lines, branches,
  functions and statements.
- The production build and the smoke journey pass at phone and desktop widths,
  axe clean.

### Blockers
- Resolution (Phase 0's blocker, in part): Docker runs; `supabase start`
  applies every migration and the integration suite passes against it.
  Still OPEN: CI has never run — the push to GitHub waits for the user.
- Status: OPEN
- Area: team invites (R3.4)
- Description: plan §8.4 sends the invite through Supabase's
  `generateLink({ type: "invite" })` and says the link works for
  `invite_valid_days` (up to 30); Supabase's links last at most a day, one
  value for every kind of link.
- What was attempted: `otp_expiry` set to its maximum, 86400.
- Why it is blocked: the setting cannot be honoured by a Supabase link.
- Required decision/input: Q23 — recommended, the app's own invite token.
- Temporary workaround: none needed before Phase 3.

## 2026-10-02 — Phase 2 questions answered

### Changed
- Plan decisions D60 – D63 (the user, before Phase 2):
  - D60: the typeface is chosen from a sample page of three faces in the
    Clinic Map's colours, light and dark, before the tokens and kit (R2.2).
  - D61: until the final name, the brand is a text wordmark only.
  - D62: Phase 1 stays local; Phase 2 branches from `phase-1/identity`, and
    both are pushed together later.
  - D63: invites use the app's own token (Q23 answered); §8.4, the member
    columns (`invite_token_hash`) and R3.4 follow it.
- Q24 (a new clinic's paper size and fee timing) keeps its default: A4, after
  the consultation.

### Validation
- Planning only.

### Blockers
- Resolution: the invite-link blocker of Phase 1 is settled by D63.
- CI still waits for the push (D62).

## 2026-10-02 — R2.2, the Clinic Map's tokens and themes

### Added
- The typeface sample (D60): Atkinson Hyperlegible Next, Public Sans and
  Figtree on a real queue, bill and prescription in both themes, shown as
  screenshots kept in `design-references/` (not committed). The user chose
  **Figtree** (D64). Fourteen candidates were checked for the ₹ sign and
  tabular figures first; Hanken Grotesk, Onest, Instrument Sans, Golos Text,
  Rethink Sans and Red Hat Text have no ₹.
- The direction contract in the surface brief
  (`.impeccable/surfaces/src-app-layout-tsx.md`).
- `src/app/globals.css`: the Clinic Map's tokens — land, ink, ground,
  surface, coral and their text colours — in light and dark; Tailwind's own
  palette, faces and sizes cleared so a screen can use only these; the type
  scale (body 17px, display numerals at 0.95); the soft radii, the raised
  shadow and the one curve; safe-area helpers (from Brio); 16px fields;
  themed selection, caret, scrollbars and focus; reduced motion made instant.
- Figtree through `next/font`, served by the app, with its `latin-ext`
  subset, where the ₹ sign is.
- Themes (D36), kept per device (`src/lib/theme`): System, Light, Dark; a
  pre-paint script so a chosen theme never flashes the other; the toolbar
  colour of each theme. Ported from Brio's two-direction switch.
- The coastlines (`src/assets/coastlines.ts`): three authored paths — wide,
  phone and the slim band.
- Tests: every text pair AA in both themes and the two dark blocks identical
  (`tests/contract/design-tokens.test.ts`); the theme script and provider;
  the coastlines; and in the browser, a dark device, a light device and a
  chosen Dark from the first paint, axe clean.

### Changed
- `@testing-library/user-event` added for component tests, as in Brio.

### Found while building
- A theme-color meta whose content is changed before hydration is taken by
  React for a new one, and another is added: the chosen toolbar colour is
  its own meta, placed first, and Next's are never touched.

### Blockers
- None.

## 2026-10-02 — R2.1, the wordmark

### Added
- `src/components/ui/wordmark.tsx`: the text wordmark (D61) — the working
  name from `UI_TEXT.appName` in Figtree bold, a little tight, in the colour
  of where it sits; a rename stays one constant. `cn` ported from Brio.

### Validation
- Typecheck, lint, format check passed; unit tests passed.

### Blockers
- None.
