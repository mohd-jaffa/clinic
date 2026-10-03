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

## 2026-10-02 — R2.3, the UI kit (built; waiting for the user's look)

### Added
- Decisions D65 (the pickers are the app's own) and D66 (the calendar grid
  and the charts come with their screens, R5.3 and R10.3), from the user.
- `src/components/ui`, the §32.2 kit in the Clinic Map's look:
  - capsules: `capsule` (the travelling chip, trailing until live), `button`
    (primary, danger, secondary, quiet; `LinkButton`, `IconButton`),
    `status-pill`, `alert-chip`, `pin`, `avatar` (initials);
  - fields: `field` (the well, label, hint, error), `text-field` (and
    textarea), `phone-field` (+91), `money-field` (₹, text to paise by the
    schema), `select-menu` and `select-field`, `date-picker` and
    `date-field`, `time-field`, `segmented-control` (the chip travels to the
    choice), `choice-chips` (on the ground or the land), `checkbox-group`,
    `search-field`; `anchored-popover` for the lists and the calendar;
  - overlays: `modal` (native dialog; inert page, focus in and back, Tab
    loop, kept mounted), `top-layer`, `sheet` (bottom sheet on a phone, side
    panel from 768 px), `dialog` (the card the confirm and response cards
    will use);
  - screens: `coast-header` (the land and its coastline, a pin on it),
    `page-header`, `section-heading`, `row` (rows with their own action),
    `stat-tile`, `lake`, `quick-actions` (the lobe), `empty-state`,
    `skeleton` (the land draws first), `screen-notice`, `list-screen`,
    `tabs`, `date-strip`; the text `wordmark` (R2.1).
- Ported from Brio: `useArrowSelection`, `KeyboardInset` (mounted in the
  root layout), the modal, popover, select, calendar and tabs, with their
  tests.
- Tokens: `edge` (a field's 3:1 border), `action-soft`, `coral-soft`, the
  `scrim`, the token numeral size, the lake's and the lobe's shapes, and the
  sheet, card and lobe motion on the one curve. Status tones for member
  statuses and plan states (`statuses.ts`).
- Screenshots of every piece, phone and desktop, light and dark, with the
  list, the calendar, a sheet, a card and the lobe open, in
  `design-references/kit/` (not committed); the preview page they were taken
  from is not committed either.

### Changed
- `lucide-react` added (plan §24's icons).
- `AGENTS.md` keeps the note `next dev` writes, as its own comment says.

### Found while building
- Two classes setting the same property (`text-ink` and `text-action`) on
  one element let the stylesheet's order decide; the calendar's today and the
  date strip now choose one set of classes per state.
- At 360–390 px the lobe's two columns cut "Appointment" short: one column
  on a phone, two from 640 px. The card's actions stack full width on a
  phone, the main one on top.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (904), coverage 100%.
- Build passed; E2E passed (phone, desktop).

### Blockers
- None. R2.3 closes when the user has looked at the screenshots.

## 2026-10-02 — R2.3 closed; R2.4, the response and confirm cards

### Changed
- R2.3 is done: the user looked at the kit's screenshots and was happy with
  them.

### Added
- `src/components/ui/response-card.tsx`, ported from Brio: `ResponseProvider`
  (mounted in the root layout) and `useResponse()` — `success`, `info`,
  `warning`, `error`, `failure` (the API's words and request id, never raw
  text) and `confirm` (the confirm card, which answers yes or no). One card at
  a time: a graver card replaces a lighter one, the same card never stacks.
  - A card with a next step is a `Dialog` (a bottom card on a phone, centred
    from 768 px) with a mark in its tone — green for done, coral only for an
    error, a warning or a question about something that cannot be undone —
    up to three facts, the reference, and capsule actions; a destructive
    question starts on Cancel.
  - A card with nothing to do next is a notice above the bottom bar that
    closes itself after 3 s, its hairline clock paused while it is held; it
    is drawn inside the sheet on top, so it can be reached and is read out.
- `Dialog` takes a mark and a close button; `Button` takes a ref,
  `LinkButton` an `onClick`.
- `src/lib/motion.ts`: the map's one duration in script (`MAP_MS`), kept equal
  to `--duration-map` by the token contract test.
- Words: `UI_TEXT.actions.cancel`, `UI_TEXT.response`.

### Found while building
- The reduced-motion rule shortens every animation, which would close a
  notice at once; the notice's clock keeps its time, as it is not motion.
- The Quick Actions test followed a link, which jsdom cannot do; it now only
  chooses it.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1082), coverage 100%.
- Build passed; E2E passed (phone, desktop).

### Blockers
- None.

## 2026-10-03 — R2.5, the app shell

### Added
- `src/constants/navigation.ts`: the ten places (plan §31.1), each with its
  icon and who may open it (the same access as its screen, plan §31.2), in
  three groups; the phone's bar (Home · Queue · ＋ · Patients · More) and
  what lives behind More; `placesFor` and `quickAddFor` filter by the
  member's permissions. Quick add (D67) goes to each action's own screen with
  its form named by `?add=` (`ADD_PARAM`, `ADD_FORMS`).
- `src/components/nav/AppShell.tsx`, the frame of every signed-in screen,
  behind the session gate:
  - phone: no top bar (D68); a bottom bar on the ground, each place in a
    fixed column so the ＋ stays in the middle, the current one on a patch of
    land; the ＋ a round land-green chip rising out of the bar; More marked
    while a screen behind it is shown;
  - tablet: an icon rail, each name under its icon, the round ＋ at its top
    (D69), the account at its foot;
  - desktop: the sidebar on the ground — the clinic's name, the **Add**
    capsule (D69), the places in three groups, the account at its foot.
- `MoreSheet` (opens on who is signed in, leading to My account, then the
  places behind More with a line on each, then Sign out), `AccountMenu` (the
  rail's and sidebar's account: where they work, My account, Sign out),
  `AddButton` (the three ＋), `AppScreen` (a signed-in screen drawn on the
  server with its first data).
- `src/features/auth/AuthProvider.tsx` (ported from Brio): who is signed in —
  profile, membership, plan — read once and shared, arriving with the page;
  each account's reads in a cache of their own; sign out forgets everything
  and loads a new page. `useSignOut` asks first on a confirm card;
  `SignOutRow`; `RequireAuth` (signed out → sign in, remembering where they
  were going; the platform admin → the console; while checking, the land
  draws first).
- `src/features/auth/session.server.ts` (ported from Brio): the session read
  once per request; `readInitialSession` for the root layout;
  `readScreen` builds the `Tenant` and reads a screen's first data, only for
  those the screen is for (its `access`), never for the platform admin.
- `/home`: the land greets the person, their clinic under it; Home's own
  content comes with its phase. Each screen now names itself in the title
  ("Home · ClinicDesk").
- The kit's `IconChip`, a menu row's icon; the `--text-tab` size for the
  bar's and the rail's names; `--bottom-bar-offset` set while the bar is on
  screen, so a notice and a screen's last row clear it and its ＋.
- Words: `UI_TEXT.nav`, `UI_TEXT.auth`, `UI_TEXT.home`, the quick actions'
  names.
- Tests: unit for every piece; `tests/e2e/shell.spec.ts` — an owner's places,
  account and quick add, signing out (asked first, then out and staying out),
  and a member who sees only what they may open — at phone and desktop, axe
  clean.

### Changed
- The E2E accessibility check waits for what is still fading in, and names
  the elements at fault.

### Found while building
- The raised ＋ made the bar's row taller than the bar, pushing every name
  down; the bar is one fixed row, and the ＋ rises out of it.
- Sign out from the account menu left the focus nowhere once the question was
  answered "stay"; the menu now gives way to the question with the focus on
  the account button.
- The quick-add screens (Queue, Calendar, Patients, Billing, Expenses) are
  not built yet, so their links lead to not-found until their phases.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1012), coverage 100%.
- Build passed; E2E passed (16, phone and desktop), axe clean.

### Blockers
- None.

## 2026-10-03 — R2.5 closed; R2.6, the system screens

### Changed
- R2.5 is done: the user looked at the shell's screenshots and was happy
  with them.
- The root layout takes the face from `src/app/fonts.ts`, which the global
  error screen shares.

### Added
- `src/components/ui/system-screen.tsx`, ported from Brio: a whole-screen
  stop on the ground, outside the shell (which may be what failed) — the
  wordmark at its top, a lobe with its mark (land for a page that is not
  there, coral for a failure), the title, why, a reference to quote, and a
  way on.
- `src/app/not-found.tsx`: "This page isn’t here", Go to Home; it names the
  tab through Next's metadata (one title, not two).
- `src/app/error.tsx`: a screen that failed — what was saved is safe, the
  digest as the reference (never the error's words), Try again, Go to Home.
- `src/app/global-error.tsx`: the root layout failed — its own document,
  title, face and the person's theme; Try again only.
- `src/instrumentation.ts`, ported from Brio: what Next catches itself goes to
  the error log (plan §36) under the digest the error screen shows, the path
  without its query.
- The loading skeleton between screens, ported from Brio
  (`src/lib/navigation/pending.ts`, `src/hooks/useNavigationPending.ts`): a
  screen still on its way after 150 ms shows its skeleton — the land first,
  rows under it — in the old one's place, the navigation kept; a quick one
  shows nothing in between.
- Words: `UI_TEXT.system`.
- Tests: unit for each; `tests/e2e/system.spec.ts` — an address the app does
  not have, signed in, at phone and desktop, axe clean.

### Found while building
- A `<title>` drawn by a screen came second to the layout's, so the tab kept
  the app's name; the not-found screen uses Next's metadata instead.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1082), coverage 100%.
- Build passed; E2E passed (18, phone and desktop), axe clean.

### Blockers
- None.

## 2026-10-03 — R2.7, the account screens

### Decided
- D70 (the user): the account screens are led by the land — above the form
  on a phone, the left half from 1024 px, its edge a coastline.

### Added
- `src/features/auth/components/AuthScene.tsx`: the frame every account
  screen shares (D70), with `OtherWayIn` under the form; `announce` takes the
  focus to the title of a screen that has just become another.
- **Sign in** (`/login`, plan §5.2): email or mobile and password; a new page
  for the account — where they were heading, Home, or the console for the
  platform admin; refusals in the API's words, and an unconfirmed email
  offered the link again.
- **Sign up** (`/register`, plan §5.1): you, then your clinic, each step
  checked before the next, both sent as one; a taken email or mobile goes
  back to its field. It becomes **Check your email** — with Send the link
  again, and, for a mobile that has had a free trial, why the clinic starts
  view-only (D42).
- **Confirm email** (`/confirm-email`): the link's tokens confirm and sign in,
  on a new page at Home; a spent link, or none, is offered the link again to
  the address typed.
- **Forgot and reset password** (`/forgot-password`, `/reset-password`, plan
  §5.3): the same answer whoever asks; the reset link's session is held in
  memory, the new password saved exactly as typed, and the person signed in.
- `src/features/auth/link.ts`: a link's tokens read from the address's
  fragment and wiped from it at once. `PasswordField` (show and hide),
  `ResendConfirmation`. `AuthClient` gains the account endpoints.
- The kit's `Checkbox` (one thing on or off), sharing its box with
  `CheckboxGroup`; an upright coastline (`side`) for land beside the ground.
- `newPasswordSchema` (the reset form) and input types for the email and
  link schemas.
- react-hook-form and @hookform/resolvers, the forms named by the stack.
- Words: `UI_TEXT.auth` for the five screens.
- Tests: unit for each; `tests/e2e/account.spec.ts` — sign in (refused, then
  in, back where they were heading), sign up through Check your email to a
  confirmation link that signs in, confirm without or with a spent link,
  forgot and reset by a real recovery link, then sign in with the new
  password — at phone and desktop, axe clean.

### Found while building
- A required field's label carries its star, so tests find a field by the
  start of its name.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1082), coverage 100%.
- Build passed; E2E passed (26, phone and desktop), axe clean.

### Blockers
- None.
