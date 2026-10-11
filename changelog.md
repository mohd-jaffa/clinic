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

## 2026-10-03 — R2.8, Settings and My account

### Decided
- D71: the Settings index lists every row now, each to those who may open
  it; a row whose screen a later phase builds opens the not-found screen
  until then.
- D72: My account changes the name, the mobile and the password each in a
  sheet of its own; the email is shown, not changed (later); the theme
  switches on the screen.

### Added
- **Settings** (`/settings`, plan §31.2): the land names it and the clinic;
  You (My account), Clinic setup (`settings.manage`), Plan and records (the
  owner), then Sign out, asking first. Two columns from 1024 px.
  `SETTINGS_GROUPS` and `settingsFor` in `src/constants/navigation.ts`.
- **My account** (`/settings/account`, plan §5.4): who they are on the land;
  Name and Mobile number open their sheets (`NameSheet`, `PhoneSheet`), the
  email shown; **Change password** (`ChangePasswordSheet`) asks for the
  current one first, says a wrong one beside it, and keeps this device signed
  in while the others are signed out; the theme — System, Light, Dark — kept
  on the device (D36); Sign out.
- The kit's `FormSheet` (ported from Brio): a sheet holding a form, its
  submit capsule in the foot. `IconChip` takes the coral `attention` tone,
  for Delete clinic.
- `profileNameSchema` and `profilePhoneSchema`, from which
  `updateProfileSchema` is now built. `AuthClient.updateProfile` and
  `.changePassword`.
- Words: `UI_TEXT.settings`, `UI_TEXT.account`, `actions.save`/`saving`,
  `theme.hint`.
- Tests: unit for each; `tests/e2e/settings.spec.ts` — the owner's index and
  a member's, the name, mobile and password changed and signed in with, the
  theme kept from the first paint — at phone and desktop, axe clean.

### Fixed
- `RowList` is one column no wider than the list: a long line — an email, a
  hint — was widening the page on a phone instead of ending in "…".
- A `Row` that opens something (a button) lined up like one that goes
  somewhere (a link): the button was sitting on a text line, a little low.
- `Modal` passes over a hidden field when it puts the cursor in the first
  one (the username a password manager files a new password under).

### Not in this row
- Read-only mode (R2.9) will disable Name and Mobile number in a view-only
  clinic and say why; until then the server refuses them with
  `CLINIC_PLAN_EXPIRED`, on the error card. Change password stays allowed.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1133), coverage 100%.
- Build passed; E2E passed (34, phone and desktop), axe clean.

### Blockers
- None.

## 2026-10-03 — R2.9, the plan banner and read-only mode

### Decided
- D73: the plan banner is a slim band across the top of every signed-in
  screen, above its land — quiet while the plan ends soon, coral once it has
  ended and while the clinic is view-only. Plan §7.2's "amber" and "red"
  banners and §32.1's read-only line now say so.
- D74: the owner's **How to renew** opens the Plan screen (`/settings/plan`,
  R11.1); until then it opens the not-found screen, as D71's rows do.

### Added
- `src/components/nav/PlanBanner.tsx` (plan §7.2): from the session view, no
  request of its own. Ending soon: "Your plan ends on 12 Nov." Ended: the day
  it ended and the day the clinic becomes view-only. View-only: says so, with
  no date (a clinic with no trial ended before it began). The owner is told
  of their plan and offered How to renew; a member, of the clinic's. State in
  words and icon, never colour alone. It stays through a navigation.
- `useReadOnly()` and `ReadOnlyNote` (`src/features/subscription`): whether
  the clinic is view-only, and the one reason every turned-off control gives
  — "Your clinic is view-only until its plan is renewed.", the server's own
  `CLINIC_PLAN_EXPIRED` words.
- Read-only in the shell: the ＋ still opens its actions, each turned off and
  described by the reason (`QuickActions` takes `blocked`). My account's Name
  and Mobile number no longer open their sheets and say why; Change password,
  the theme and Sign out still work (plan §7.2).
- `PLAN_ROUTE`; words in `UI_TEXT.plan`.
- Tests: unit for each; `tests/e2e/plan.spec.ts` — a clinic's plan moved
  through ending soon, ended and view-only for its owner, the ＋ and My
  account turned off, the server refusing the write; a member's banner — at
  phone and desktop, axe clean.

### Fixed
- The land (`CoastHeader`) pays the top safe area: on a phone drawn edge to
  edge, a screen's title sat under the status bar. Under the plan banner, the
  banner pays it instead.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1152), coverage 100%.
- Build passed; E2E passed (38, phone and desktop), axe clean.

### Blockers
- None.

## 2026-10-03 — R2.10, the sign-up journey

### Added
- `tests/e2e/journey.spec.ts` (plan §34, Phase 2's exit): an owner signs up
  through the two steps, is turned away at sign-in until the email is
  confirmed — with the link offered again — confirms by the link the app
  emails and lands on Home, signs out from Settings (asked first), signs in
  again with their mobile number typed with a leading 0 and a space, and
  lands on Home inside the shell. Home is then checked at 360, 390 and 414 px
  (the phone project) and 768, 1024, 1280 and 1440 px (the desktop project),
  each in light and dark — the theme really drawn, the bar or the rail and
  sidebar in place, nothing wider than the screen, axe clean.

### Changed
- `authLinkTo` (`tests/support/e2e.ts`): the email link, made as the app
  makes it, moved out of `account.spec.ts` so both journeys share it.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests unchanged (1152), coverage 100%.
- E2E passed (40, phone and desktop), axe clean at every width and theme.

### Blockers
- None.

## 2026-10-03 — R2.11, online-only, nothing lost

### Added
- The offline banner (`src/components/nav/OfflineBanner.tsx`, plan §21,
  D55): when the connection drops, a slim coral band across the top of every
  signed-in screen — the same kind as the plan banner (D73), above it when
  both show — says so, and that what is being typed stays until it can be
  saved. It goes by itself when the connection is back. Its place is always
  there and polite, so the words are read out as they arrive.
- `src/lib/network/connection.ts` (`isOnline`, `onConnectionChange`,
  `backOnline`, `NETWORK_RETRY_DELAYS_MS`) and `useOnline`
  (`src/hooks/useOnline.ts`): the connection as the browser knows it; the
  server draws every page as online.
- `NETWORK_OFFLINE` and `NETWORK_UNREACHABLE` in `ERROR_MESSAGES`, and
  `UI_TEXT.offline.banner`.
- Q25 in the plan (a default, R2.11): which saves wait for the connection.
- The offline band has the plan band's rhythm: 16 px above and below its words.

### Changed
- `src/lib/api/client.ts`: a save that carries an idempotency key waits while
  the device is offline and goes when the connection returns, and is tried
  again after 1, 2 and 4 s if the server cannot be reached while online —
  its key makes it land once. Any other request that cannot reach the server
  is refused at once with `NETWORK_OFFLINE` or `NETWORK_UNREACHABLE`, shown on
  the error card; the sheet stays open with what was typed (D55).
- A band across the top is marked `data-band` (was `data-plan-banner`): the
  first one pays the top safe area, and every band stays while the next
  screen's skeleton shows.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1169), coverage 100%.
- Build passed; E2E passed (42, phone and desktop), axe clean —
  `tests/e2e/offline.spec.ts`: the band, a save refused offline with the name
  kept in its sheet, then saved once the connection is back.

### Blockers
- None.

## 2026-10-03 — R2.12, the Phase 2 finish review and DESIGN.md

### Changed
- The Impeccable finish review of the built world (the kit, the shell and the
  account screens; 68 captures at phone and desktop, light and dark; the
  design detector found nothing) asked for eight fixes. All eight were made
  and scored resolved on recapture; disposition **ship**.
  - Menus are one list on the ground (D75, the user): Settings, My account
    and the More sheet list each section as one continuous list parted by
    hairlines, each icon bare — `RowList look="menu"`, `Row look="menu"` and
    `RowIcon` (`src/components/ui/row.tsx`); `IconChip` is gone. The
    response, confirm and notice cards set their icon bare beside the title.
  - Quick Actions drops from its ＋ on tablet and desktop (D76, the user):
    beside the rail's ＋ or the sidebar's **Add**, at the top, its lower edge
    the coastline; on a phone it still rises from the bottom. Each action's
    chip rides the trailing edge, as every capsule's at rest.
  - The not-found screen stands inside the shell for someone signed in
    (`src/components/nav/NotFoundScreen.tsx`, `SystemNotice`).
  - The More sheet fits a 390 × 844 phone whole, Sign out included.
  - The line under a land heading steps up from 768 px (20 px, a clear gap).
  - A required field's asterisk is muted: coral is kept for attention.
  - The textarea has no browser resize grip, and grows with its text where
    the browser can.

### Added
- `DESIGN.md` and its sidecar `.impeccable/design.json`, written from the
  shipped code by the Impeccable documenter: the tokens of both themes, type,
  shapes, depth, motion, each component by its file and export, and the
  rules. From now on it is the design system's authority (AGENTS.md §23).
- Plan D75 and D76; tracker row R2.12.

### Known gaps (found by the documenter, not repaired)
- The coastline does not yet reshape between screens or flatten on scroll
  (§32.1 Motion).
- The offline and coral plan bands are straight-edged, where §32.1 says
  "coast band".
- `Lake`, `Pin` and `Capsule` wait for their screens (the Queue, patients).
- `checkbox.tsx` uses a radius outside the tokens; Quick Actions builds its
  capsule by hand rather than from `capsuleClasses`.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1173), coverage 100%.
- Build passed; E2E passed (42, phone and desktop), axe clean.
- The tablet path (820 px, the rail's ＋ lobe) checked by screenshot, light
  and dark.

### Blockers
- None.

## 2026-10-03 — R3.1, clinic details and the logo

### Added
- `0009_clinic_profile.sql` (D77: numbered in build order; the team is now
  `0011`, closures `0010`): `clinics.logo_path`, held to the clinic's own
  folder; `update_clinic_profile(p_changes)`, `set_clinic_logo`,
  `clear_clinic_logo` (D79), each through `require_clinic_settings()` —
  `settings.manage` and a clinic that can write; the private `clinic-logos`
  bucket (500 KB; PNG, JPEG, WebP) with policies opening a clinic's folder to
  its members to read and to `settings.manage` to store or remove.
- `src/features/clinic` (plan §9): `getClinic`, `updateClinic`,
  `replaceLogo` (typed by its first bytes; stored, switched, and only then the
  old file removed), `removeLogo`, `readLogo` — each change audited with its
  values; `GET, PATCH /api/clinic` and `GET, POST, DELETE /api/clinic/logo`
  (the logo answered as the image only, `no-store`).
- Clinic details — `/settings/clinic` (D78): the logo with Add/Change and
  Remove (asked first); the details as rows opening one sheet (name, type,
  address, city, phone, email, GSTIN); the paper size and the consultation
  fee's timing saved the moment they are picked. View-only, it shows
  everything and changes nothing, saying why.
- The clinic's logo beside its name at the top of the desktop sidebar (plan
  §31.1), from the session view (`clinicLogoUrl`).
- The `paper` colour token (white in every theme): a logo is shown on it, as
  it will print, so one made for white paper is not lost in dark mode
  (`DESIGN.md` and its sidecar updated).
- `NoAccess`: a member who reaches a screen they may not open by its address
  is told so inside the shell, with the way home (`readScreen` → `refused`).
- `optionalGstin` and `clinicDetailsSchema` / `updateClinicSchema`;
  `src/constants/uploads.ts` (`MAX_LOGO_BYTES` = 500 KB, the user).
- Plan D77 – D79; the migration list and R3.1, R3.3, R3.4 renumbered.

### Changed
- The test helpers: the fake Supabase client chains a function call and
  answers Storage; `removeAll` removes a test clinic's logo files.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1258), coverage 100% — the integration test
  against the local Supabase: settings.manage only, by the database itself;
  no direct write to `clinics`; the logo stored, replaced, removed and out of
  another clinic's reach; a view-only clinic changes nothing.
- Build passed; E2E passed (46, phone and desktop), axe clean —
  `tests/e2e/clinic.spec.ts`.

### Blockers
- None. `/privacy` names the logo when it is written (R12.2).

## 2026-10-03 — R3.2, the price list, appointment types and expense categories

### Added
- `0010_catalogue_rules.sql` (D81, D83): a new appointment type or expense
  category is placed last by a trigger (the column default removed); a clinic
  keeps its last active appointment type, its last active expense category
  and its last active Consultation service — nor can that service leave the
  Consultation category. The refusal is the database's, under a lock on the
  clinic row so two archives at once cannot both pass, and reads in words
  (`APPOINTMENT_TYPE_REQUIRED`, `EXPENSE_CATEGORY_REQUIRED`,
  `CONSULTATION_SERVICE_REQUIRED`, 422).
- `src/features/clinic/catalogues.ts` (plan §9): `services`,
  `appointmentTypes`, `expenseCategories`, each `list`, `add` and `change`
  (details, archive, restore) — every change audited with its values
  (`CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE`); a name already in use, whatever
  its case, is `…_ALREADY_EXISTS` (409). `GET, POST /api/services`,
  `/api/appointment-types`, `/api/expense-categories` and `PATCH` on each
  `[id]`: reading for any member, changing for `settings.manage`.
- The price list — `/settings/price-list` (D82): a section per category in
  the plan's order, each service's name and price; a search by name; **Add
  service**; a service opens its sheet (name, category, price) to be changed
  or archived. From 1024 px the categories stand in two columns.
- Appointment types — `/settings/appointment-types` — and expense categories
  — `/settings/expense-categories` — in the clinic's order (D81): each opens
  its sheet (name and usual length; name) to be changed or archived; **Add**
  at the foot says where a new one goes.
- Archived entries (D80): **Show archived (n)** at the foot of each screen,
  each with **Restore** — refused while an active entry has its name. Archive
  asks first and says what archiving means. View-only, each screen shows
  everything and changes nothing, saying why.
- `src/lib/supabase/records.ts` (ported from Brio): `tenantRecords` — a
  clinic table read and written within the caller's clinic, its changes
  audited; `src/lib/audit/changes.ts` (`changedValues`), now also used by the
  clinic details.
- `Row`'s `detail`: a value read at the row's end — a price, a length — part
  of the row's target (`DESIGN.md` updated).
- `wholeNumberText`, `serviceSchema`, `appointmentTypeSchema`,
  `expenseCategorySchema` and their change schemas; `paiseToText`.
- Plan D80 – D83; the migration list and R3.3 onwards renumbered
  (`0011_closures`, `0012_team`, …).

### Changed
- The journeys' accessibility check no longer waits for a notice's
  countdown — whose end starts the notice's fade, which axe then read as
  low contrast — and checks again if a fade begins while it runs.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1378), coverage 100% — the integration
  test against the local Supabase: the seeds in order, other clinics out of
  reach, settings.manage only, new entries last, names unique whatever their
  case, archive and restore audited, a restore refused while the name is in
  use, the last Consultation, type and category kept, and two archives of the
  last two at once leaving one.
- Build passed; E2E passed (52, phone and desktop), axe clean —
  `tests/e2e/catalogues.spec.ts`.

### Blockers
- None.

## 2026-10-03 — R3.3, holidays and leave

### Added
- `0011_closures.sql` (D84 – D86): `clinic_closures` — the whole clinic, or
  one of its doctors (a composite key keeps the doctor in the same clinic),
  from a first to a last day, with a reason. It starts today or later in the
  clinic's timezone (a trigger, `CLOSURE_STARTS_BEFORE_TODAY`), ends on or
  after its start, and lasts at most 366 days (`MAX_CLOSURE_DAYS`, kept equal
  to the `CHECK`); two for the same people never share a day (exclusion
  constraints, `CLOSURE_DAYS_TAKEN`, 409), though a doctor's leave may sit
  inside a clinic holiday. Read by every member, added with
  `settings.manage` while the clinic can write; never edited; removed only
  through `remove_closure`, and only while not yet over (`CLOSURE_OVER`, 422).
- `src/features/clinic/closures.ts` (plan §9): `listClosures`, `addClosure`,
  `removeClosure` — each change audited with its values (`CREATE`,
  `DELETE`); `GET, POST /api/closures` and `DELETE /api/closures/[id]`.
- `src/features/team` begins with `listDoctors` and `GET /api/doctors` (plan
  §30): the clinic's active doctors of active members, by name, for every
  picker.
- Holidays and leave — `/settings/closures` (D84): those not yet over by
  their first day — why, who, when and how many days — each with **Remove**,
  asked first on a danger card; the past ones behind **Show past (n)**, the
  latest first, as a record; an empty state that starts the first. The sheet:
  who's away (the whole clinic or a doctor), the first and last day (no day
  before today; the last follows the first), and the reason. View-only, it
  shows everything and changes nothing, saying why.
- The kit's `Disclosure` (`DESIGN.md`): what a screen keeps out of the way
  until asked — archived entries now use it too.
- `requiredDay`, `closureSchema`; `isDayKey`, `dayCount`, `formatDayRange`
  ("20 – 22 Oct", the year when it is not this one).
- Plan D84 – D87; R5.1 lists the appointments on a closure being added
  (D87).

### Changed
- `CatalogueScreen` takes its subtitle as words, so holidays and leave can
  count what is coming up.
- An exclusion constraint's refusal (23P01) is a conflict; a feature's
  `taken` code names it as it names a duplicate.

### Fixed
- A sheet that resets after a save (my name, my mobile, my password, the
  clinic's details, the price list, appointment types, expense categories)
  kept no hold on its text fields in the built app: the React Compiler
  memoizes each `register()`, and a reset forgot them, so a second save from
  the same sheet found the field empty. Every such form now resets keeping
  its fields (`FORM_RESET_OPTIONS`, 718561d); the closures journey adds twice from one
  sheet to keep it so.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1445), coverage 100% — the integration
  test against the local Supabase: the doctors by name, an inactive one left
  out; settings.manage only; audited with values and who added it; a start
  before today and more than a year refused, today and exactly 366 days
  taken; the same people's days refused, a doctor's leave inside a holiday
  allowed; another clinic's doctor refused; removed while not yet over, a
  past one kept; nothing edited or deleted through the database's API; a
  view-only clinic changes nothing. `clinic_closures` has its
  tenant-isolation row.
- Build passed; E2E passed (56, phone and desktop), axe clean —
  `tests/e2e/closures.spec.ts`.

### Blockers
- None.

## 2026-10-03 — R3.4, inviting the team

### Added
- `0012_team.sql` (D63): an invite keeps only the hash of its own token, while
  it is open, one link to one invite. `invite_member`, `resend_invite`,
  `revoke_invite`, `find_invite` and `accept_invite` (the accept screen,
  R3.5) are the server's alone — no client may call them — and each checks
  again who is acting: the owner, or an active member with `team.manage`, of
  a clinic that can write; no escalation (only what they hold, and
  `team.manage` from the owner alone); one clinic per person (D23); no
  platform account; a former member reactivated, not invited. A link lasts
  `invite_valid_days`, is replaced by Resend, and is accepted once.
- `src/features/team` (plan §8.3, §8.4): `inviteMember` — the account made
  with no password through the admin API, removed again if the invite is
  refused; the invite email (`MAIL_TEXT.invite`) whose link is the only place
  the token goes (D90); a failed email keeps the invite and says so —
  `resendInvite` (a new link, not twice within the cooldown) and
  `revokeInvite` (the account it made goes with it when never used), each
  audited; `listTeam`. `GET /api/team`, `POST /api/team/invites`,
  `POST /api/team/invites/[id]/resend`, `DELETE /api/team/invites/[id]`, for
  `team.manage`.
- The team — `/team` (plan §8.4, §8.6): everyone, the owner first and you
  named; the open invites with how long each link lasts, **Resend** and
  **Revoke** (asked first); those inactive. **Invite** opens one sheet in
  sections (D89): name and email; Doctor or Staff, a job title for staff;
  what they can do — a preset to start from (staff as Receptionist, D88),
  then every permission by part of the clinic, what one needs ticked with
  it, what the inviter may not give shown and unchangeable, saying why; and a
  doctor's details. View-only, it shows the team and changes nothing.
- `PERMISSION_GROUPS`, `INVITE_ROLES`, `optionalPaiseText`, `inviteSchema`.
- Plan D88 – D90 (Q19 answered). `0012_team` holds the invite lifecycle; the
  member functions are `0013_members` (R3.6), and later migrations move up
  one (D77).

### Changed
- The invite sheet submits a copy of its values: react-hook-form changes a
  nested object (the doctor's details) in place.
- The integration helpers give a test invite a token hash, and remove the
  accounts the app made for a test clinic's invites.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1526), coverage 100% — the integration
  test against the local Supabase reads the emails from Mailpit: a doctor
  invited with their details, the link's token kept only as its hash, the
  expiry from the settings; the team listed; a manager inviting within what
  they hold, refused team.manage and what they lack; the account removed when
  the invite is refused; one clinic per person, a former member refused, one
  who left another clinic invited as themselves, the platform's account
  refused; resend's new link replacing the old, not twice in a moment; revoke
  removing the invite and its unused account, and keeping a person's own;
  accept once, an expired link refused; none of it callable by a client; no
  invite into a view-only clinic.
- Build passed; E2E passed (60, phone and desktop), axe clean —
  `tests/e2e/team.spec.ts`.

### Blockers
- None.

## 2026-10-03 — R3.5, accepting an invite

### Added
- Accept an invite — `/accept-invite` (plan §8.5, D91, D92): the emailed
  link carries its token in the address's fragment — never sent to a server,
  never in a log — and the screen takes it and wipes it from the address at
  once. It names the clinic and the role; the person confirms their name,
  adds their mobile and chooses a password (an existing account too, D91),
  and lands on Home signed in as themselves, whoever was signed in on the
  device before (D92). A link spent, revoked or run out says so, with the way
  back to sign in; one that could not be opened offers Try again.
- `src/features/team/accept.ts`: `previewInvite`, and `acceptInvite` — the
  mobile checked against every other account first (Auth's own refusal says
  only that it failed), the password and mobile set and the email confirmed
  through the admin API, `accept_invite`, the audit row (`STATUS_CHANGE`), and
  a fresh session with every other one ended. `POST /api/auth/accept-invite`
  (through `withSessionRoute`: cookies, never a token in the body) and
  `POST /api/auth/accept-invite/preview` (the token in the body), added to
  plan §30.
- `acceptInviteSchema`, `invitePreviewSchema`; `tenantOf` (the tenant a
  session acts as, now also what `withClinicRoute` builds); `freshSession`
  shared from the password module.
- Plan D91, D92.

### Changed
- The invite email's link carries its token in the fragment (`#token=`), not
  the query string.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1551), coverage 100% — the integration
  test against the local Supabase: the link names the clinic, the role and
  the person; accepting sets the password and mobile, joins with the invited
  permissions and job title, audits it, and signs in by email and by mobile —
  once; an existing account's old password stops working and the new one
  works (D91); a link run out, and a mobile another account has, refused in
  words, the invite still open after.
- Build passed; E2E passed (64, phone and desktop), axe clean —
  `tests/e2e/accept-invite.spec.ts`: the invitee joins on a device the owner
  was signed in on, and lands on Home as themselves.

### Blockers
- None.

## 2026-10-03 — R3.6, a member's page

### Added
- `0013_members.sql` (D93 – D95): `update_member` (what they can do, a job
  title for staff, a doctor's details for a doctor — only what is named) and
  `set_member_active` (deactivate; reactivate unless they have joined another
  clinic meanwhile). Both are called by the signed-in member as themselves —
  the actor is `auth.uid()` — and check again: they manage the team of a
  clinic that can write; the member is joined, of their clinic, never the
  owner (whose access is all of it, and who is never deactivated — the last
  owner, §8.2 rule 7), never themselves, and, for anyone but the owner, one
  whose every permission they hold, without `team.manage` (D93); nothing is
  given that they do not hold; the role stays what it was (D95).
- `src/features/team/members.ts`: `getMember`, `updateMember`,
  `setMemberActive`, each change audited with its values (`UPDATE`,
  `STATUS_CHANGE`). `GET, PATCH /api/team/[id]` and
  `POST /api/team/[id]/active`, for `team.manage`.
- A member's page — `/team/[id]` (D94): who they are (email, mobile, role);
  their job title, or a doctor's details, each in its sheet; what they can do,
  with the invite's presets and groups, saved with one **Save changes**;
  **Deactivate** (asked first, on a danger card) or **Reactivate** (asked
  first). Someone beyond a manager's own access is shown, not changed, and the
  page says it is the owner's to change; a view-only clinic changes nothing.
  The team list opens each member's page — the owner's and one's own aside.
- `DoctorDetailsSheet` (the owner's own profile, R3.7, will use it too),
  `JobTitleSheet`; `canManage`; `TEAM_ROUTE`, `memberRoute`;
  `updateMemberSchema`, `memberActiveSchema`, `doctorDetailsSchema`,
  `jobTitleSchema`.
- Plan D93 – D95.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1604), coverage 100% — the integration
  test against the local Supabase: the owner reads a member, changes their
  access and job title (audited with what changed) and a doctor's details,
  each role keeping its own fields; deactivates (who did it kept; the member
  then reaches nothing) and reactivates, audited; no reactivation into a
  second clinic; the owner never deactivated, an invite never changed; a
  manager changes those within their access, giving only what they hold, and
  is refused anyone beyond them, the owner, themselves and another manager;
  no change without team.manage, or in a view-only clinic.
- Build passed; E2E passed (68, phone and desktop), axe clean —
  `tests/e2e/members.spec.ts`.

### Blockers
- None.

## 2026-10-03 — R3.7, the owner's own doctor profile

### Added
- `0014_owner_doctor.sql` (D96, D97): `set_owner_sees_patients` — on makes
  or brings back the owner's doctor profile, off leaves it inactive, never
  deleted — and `update_own_doctor`, their details only while they see
  patients (`OWNER_NOT_DOCTOR`). Both are the owner's alone, as themselves,
  while the clinic can write.
- `updateOwnDoctor` (the switch first, so turning it on and filling it in go
  together; audited as any member's change, `sees_patients` among its
  values) and `PATCH /api/team/me/doctor`, for the owner.
- The owner's own page (D96): their row in Team, "Asha Menon (you)", opens
  it — their contact, that they have every permission, **I also see
  patients** saved as it is ticked — moving at once, and back if refused (the session read again, so the app knows
  at once), and, while it is on, their doctor details in the same sheet as any
  doctor's. A manager opens neither the owner's page nor their own.
- `ownDoctorSchema`; a member's page knows whether their doctor profile is
  active (`seesPatients`).
- Plan D96, D97; `0014_owner_doctor` added, and later migrations move up one
  (D77).

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1624), coverage 100% — the integration
  test against the local Supabase: details changed and audited while the
  owner sees patients; turned off, the profile kept, out of the doctor list
  and the session, details refused; turned on, the same profile back as it
  was; one made for an owner who never saw patients, turned on and filled in
  at once; a manager refused; nothing in a view-only clinic.
- Build passed; E2E passed (70, phone and desktop), axe clean —
  `tests/e2e/members.spec.ts`.

### Blockers
- None.

## 2026-10-03 — R3.8, Phase 3's journey: each sees only what they may

### Added
- `tests/e2e/team-journey.spec.ts` (plan §34, Phase 3's exit): the owner
  invites a receptionist and a doctor (with their own fee) from the team
  screen; each follows their link on a device of their own, joins and lands
  on Home; each finds exactly the places their preset allows — the sidebar's
  on a desktop, More's on a phone — and neither the team nor the clinic's
  setup opens for them by its address; the owner then sees both on the team,
  the doctor's fee on their page.
- The permission matrix (`tests/db/integration/permissions.test.ts`) gains
  its Phase 3 rows: `settings.manage` on holidays and leave (by RLS and
  `remove_closure`) and `team.manage` (by the route guard and the team's
  functions), each allowed and refused.
- `issueInviteToken` (tests): a fresh link for an open invite, as Resend
  would email it, for the journeys, which send no mail.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1626), coverage 100%.
- Build passed; E2E passed (72, phone and desktop), axe clean.

### Blockers
- None. Phase 3 is done.

## 2026-10-03 — R4.1, patients in the database

### Added
- `0015_patients.sql` (plan §10, §27.3, §28.3; D98 – D104):
  - `patients`, numbered per clinic from `FIRST_PATIENT_NUMBER` (1001,
    shown P-1001) by `patient_counters` under a row lock, never by a client.
    The mobile is required and not unique, so a family shares one (Q7). A
    date of birth from today back `MAX_PATIENT_AGE` years, in the clinic's
    timezone. An assigned doctor only from the clinic's active doctors
    (`DOCTOR_INACTIVE`). Archived, never deleted, and read-only until
    restored (`PATIENT_ARCHIVED`, D103); archiving and restoring are
    stamped with when and by whom.
  - The doctor scope: `patient_doctors`, grown by trigger with the assigned
    doctor and the doctor who added the patient (D99), and never shrunk. No
    client reads or writes it. `sees_every_patient()`,
    `doctor_patient_ids()` and `can_see_patient()`; the policies read the
    scope once per statement.
  - `patient_alerts` (allergies, conditions, medications): read with
    `visits.view` and written with `visits.edit`, within the scope. One
    active alert per label and kind; turned off, never deleted.
  - `create_patient` (the number, the patient and the access list, in one
    transaction); `import_patients`, the owner's batch numbered in file
    order, all or none (the plan's R4.8 function, so no later migration
    renumbers); `search_patients`, run as the caller, best match first —
    number, mobile digits, then names that start with the words, hold them,
    or come close by trigram — and newest first with nothing typed (D104).
  - Trigram indexes on the name and the mobile, beside `(clinic_id, phone)`
    and `(clinic_id, archived_at)`.
- Constants: `GENDERS`, `ALERT_KINDS` (statuses), `FIRST_PATIENT_NUMBER`
  (seeds), `MAX_PATIENT_AGE` and the notes and alert text limits (limits),
  with their error wordings.

### Changed
- Adding or editing a patient needs seeing them (D102):
  `PERMISSION_DEPENDENCIES` and `permissions_are_valid` both gain
  `patients.create`/`patients.edit` → `patients.view`. Memberships that held
  either without it are given it. The catalogue's contract test now reads
  the latest definition (`latestFunctionBody`).
- Plan: D98 – D104 recorded.
  - §8.2 rule 2, §10.1 – §10.3, §27.3, §27.4, §28.3, §29 and §30 updated.
    Search and the mobile match travel in the body (D98).
  - The later phases' rows now name their part of the patients list and
    profile (D101), and R5.1 refuses booking an archived patient.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1684), coverage 100%. The integration
  test against the local Supabase covers:
  - numbers in order, once each when added at the same moment, per clinic;
  - families sharing a mobile;
  - the doctor scope: assigned, adder, others; owner and staff; `can_see_patient`;
    only growing;
  - the date of birth and assigned-doctor checks;
  - archive, read-only and restore;
  - search order, fuzzy, digits, number, paging and the doctor's own;
  - alerts by permission and scope, unique while active;
  - import order, all or none, owner only;
  - a view-only clinic writing nothing.
- Tenant isolation covers `patients` and `patient_alerts`, and the counter
  and access list stay unreachable.
- Build passed; E2E passed (team screens, phone and desktop), axe clean.

### Blockers
- None.

## 2026-10-04 — R4.2, adding and changing a patient

### Added
- The patient sheet (`PatientSheet`, D105 – D108):
  - What every patient needs comes first: name, mobile, date of birth or
    age in years (D100), gender, and their doctor. Alternate phone, email,
    address, emergency contact and notes wait under **More details**, which
    opens for an edit that holds any of them and for a refusal inside.
  - Once ten digits are typed, **Already here?** lists the patients on that
    mobile (`PatientMatches`), each with Open and the archived marked. A
    family shares a number, so nothing is refused (D106).
  - The doctor starts as the adding doctor, or the clinic's only doctor
    (D108).
  - An added patient's profile opens, with a card naming their number; the
    add form leaves the history (D107).
  - Editing sends only the fields touched, so an untouched age never moves
    an estimated date of birth.
- The Patients screen (`/patients`) with **Add patient**, opened too by the
  ＋'s Patient (`useAddForm`, D67). Closing a form the screen opened steps
  back, so no dead entry is left. The list is R4.3.
- `createPatient`, `updatePatient`, `getPatient` and `findPatientMatches`.
  - `POST /api/patients` takes an Idempotency-Key and adds one patient per
    key: `0015`'s `create_patient` takes the key, and a repeat finds the
    first patient.
  - `GET` and `PATCH /api/patients/[id]`.
  - `POST /api/patients/matches`: the mobile goes in the body (D98), and a
    view-only clinic may still ask it.
- `useApiLookup`: a read whose question is about a patient, asked in a POST
  body and kept only in memory.
- The audit trail records a patient's own details by field name alone
  (`auditedChanges`, and `tenantRecords`' `named` columns). Only the patient
  number and the assigned doctor are recorded by value (plan §27.6).
- Kit:
  - `ChoiceField` (a short set of chips as a form field).
  - `Disclosure` can be held open by its form.
  - `ChoiceChips` can be named by a visible label and described by its
    field's hint.
  - The date picker's heading jumps to its year's months, then to a page of
    twelve years, keyboard-complete (D109).

### Changed
- `0015_patients` (not yet released) gains `patients.idempotency_key`, and
  `create_patient(p_patient, p_idempotency_key)` returns `(patient_id,
  created)`.
- Plan: D105 – D109 recorded.
- DESIGN.md documents `ChoiceField`, the held `Disclosure` and the
  calendar's jump.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1761), coverage 100%. The integration
  test covers:
  - one patient for a key sent twice at once;
  - the audit row holding field names and no patient value;
  - reading and changing within the doctor scope;
  - the mobile's patients as each member may see them.
- Build passed; E2E passed (76, phone and desktop), axe clean —
  `tests/e2e/patients.spec.ts`: a receptionist adds a brother to a family
  from the ＋; the owner gives a 1985 birth date through the jump.

### Blockers
- None. The profile an added patient opens onto is R4.4. Until then, its
  address shows the not-found screen.

## 2026-10-04 — R4.3, the patients list

### Added
- The patients list (`/patients`, plan §10.2, D104, D110 – D112):
  - Searched by name, mobile or patient number — debounced, and sent in the
    body of `POST /api/patients/search`, never the address (D98). Newest
    first with nothing typed, best match first otherwise; a page at a time
    with **Show more**.
  - Each row opens the profile and carries a round **Call**. On a phone the
    line is age · gender · number and leaves the mobile to the button; from
    a tablet's width the mobile joins the line (D110). Rows on every width
    (D111).
  - **All** and **Archived** tabs for those with `patients.edit`; the
    archived tab is refused to anyone else, by the route as well.
  - A doctor sees only their own patients, under "Your patients", with an
    empty state of their own.
  - A search that finds no one says so and, on the All tab, for those who
    may add, offers **Add patient** with what was typed: a mobile's digits
    as the mobile, words as the name (D112, `PatientSheet`'s `prefill`).
  - The first page arrives with the screen.
- `listPatients` reads a page through `search_patients` as the caller, so
  the doctor scope holds, with `searchTerms` reading the search as words, a
  phone's digits and a record's number (`src/lib/supabase/search.ts`,
  ported from Brio).
- `useApiPages`' `post` option asks each page as a POST, the key's query as
  its body, the key kept in memory only. `usePatients` and `patientsKey`
  use it.
- `useDebouncedValue` (ported from Brio).
- Kit: `IconLink`, a round label-less link (the row's Call). `ListScreen`'s
  no-match state takes words, or words and what to do instead.

### Changed
- `ListScreen` shows its empty state whenever nothing is searched, even when
  the screen passes its search's empty words as the no-match state.
- Adding or changing a patient refreshes the list (`/api/patients/search`)
  and the mobile matches.
- Plan: D110 – D112 recorded; §10.2 says how a row reads and what a search
  that finds no one offers; §30 lists the list as `POST
  /api/patients/search`, with no `GET /api/patients`.
- DESIGN.md documents `IconLink`.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1804), coverage 100%. The integration
  test reads the list through `listPatients`: newest first, a page from a
  cursor, a mobile however typed, a patient number first, the archived on
  their own tab, a doctor's own patients only, and the archived tab refused
  without `patients.edit`.
- Build passed. E2E: 75 of 80 passed on the full run. Four failures were
  `patients.spec.ts` setups:
  - an empty clinic showed **Add patient** twice, so the empty state's copy
    was dropped;
  - an import sets no doctor (§10.5), so the doctor test now adds through
    `createPatient`.
  The fifth was the desktop password change, which timed out on the local
  auth server; it passed on phone in the same run. After the fixes,
  `patients.spec.ts` and `settings.spec.ts` passed again (16, phone and
  desktop), axe clean. `tests/e2e/patients.spec.ts` adds:
  - a receptionist pages to the 21st patient, finds one by name, mobile and
    number, checks Call, adds "Zoya Khan" from a search that found no one,
    and opens the archived;
  - a doctor finds only their own patient.

### Blockers
- None. The profile a row opens is R4.4; until then its address shows the
  not-found screen.

## 2026-10-04 — R4.4, a patient's profile

### Added
- A patient's profile (`/patients/[id]`, plan §10.3, D113 – D116), for
  `patients.view`; a doctor sees only their own patients (D3):
  - The header gives the name; age · gender · number; and their doctor, or
    "No doctor yet". Under them sit **Call** and **WhatsApp**; WhatsApp opens
    a chat with nothing typed (D115).
  - A **Details** card lists only what holds a value: the mobile, the date
    of birth when it was given as a date, alternate phone, email, address,
    emergency contact and notes (D113, D116).
  - **Edit** opens the patient sheet, for those with `patients.edit`. It is
    not offered for an archived patient (D103) or in a view-only clinic,
    which says why.
  - One column on every width until history arrives (D114). A patient who
    can't be loaded, or isn't the caller's to see, is said so, with
    **Try again**.
  - The patient and the doctors arrive with the screen.
- `usePatient`.
- Kit: `DetailList`, a card of a record's facts. `PageHeader` takes a
  `detail` line and `actions` under the title.

### Changed
- `sheet.test.tsx` focuses a `Link`, not an `<a>`. Next's link rule flags an
  `<a>` to `/patients` now that a page sits under it.
- Plan: D113 – D116 recorded.
- DESIGN.md documents `DetailList` and `PageHeader`'s detail line and
  actions.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1819), coverage 100%. Reading a patient
  within the doctor scope is R4.2's integration test; R4.4 adds no server
  function.
- Build passed. E2E: 80 of 84 passed on the full run. The four failures were
  the two new profile tests on both widths, whose locators also matched:
  - the closed edit sheet's "No doctor yet";
  - Next's route announcer, which is also an alert.
  Narrowed, `patients.spec.ts` passed (12, phone and desktop), axe clean.
  It adds:
  - a receptionist opens a patient from the list, reads their details,
    checks Call and WhatsApp, and changes their email;
  - a doctor is told another doctor's patient can't be found.
  The R4.2 tests now also read the added patient's profile.

### Blockers
- None. Alerts on the header are R4.5. Archive, restore and an archived
  patient's notice are R4.6.

## 2026-10-04 — R4.5, a patient's alerts

### Added
- A patient's alerts (plan §10.4, D117 – D120): allergies, conditions and
  current medications.
  - The profile header shows a chip for each active alert, allergies first
    in the danger tone; a screen reader hears its kind ("Allergy:
    Penicillin"). "No alerts" when there are none. **Alerts** follows the
    chips and opens the alerts sheet.
  - The alerts sheet lists each with its kind and note:
    - **Add alert** and **Edit** open the alert sheet over it. A kind is
      chosen once; the name and note can be changed later (D119).
    - **Turn off** asks first (D118).
    - Turned-off alerts are folded at the foot, read only (D120).
  - Read with `visits.view`; changed with `visits.edit` within the doctor
    scope. Never changed while the patient is archived (D103) or the clinic
    is view-only, which says why. Without `visits.view` nothing of them
    shows.
  - The alerts arrive with the profile.
- `listAlerts`, `addAlert` and `updateAlert` (`src/features/patients/alerts.ts`):
  - The patient is found first, so one out of reach is not found.
  - A second active alert of the same name and kind is refused as
    `ALERT_ALREADY_EXISTS`.
  - The audit names the words written, never the words themselves.
- Routes: `GET` and `POST /api/patients/[id]/alerts`; `PATCH
  /api/patients/[id]/alerts/[alertId]`, which takes a name, a note, or
  turning off, never turning on again.
- `alertSchema`, `updateAlertSchema`, `AlertsClient`, `useAlerts`,
  `AlertSheet`, `PatientAlerts`; `ALERT_ALREADY_EXISTS` and
  `ALERTS_LOAD_FAILED`.
- Kit: `AlertChip` takes a `kind` said to a screen reader. `PageHeader`'s
  actions stack a row each.

### Changed
- Plan: D117 – D120 recorded.
- DESIGN.md documents `AlertChip`'s kind and the header's chip row.
- The route-existence test fills each route parameter by its own name, so
  `alert(id, alertId)` resolves to `[id]/alerts/[alertId]`.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (1866), coverage 100%. The integration
  test covers adding within the doctor scope, the audit naming fields only,
  a duplicate refused, listing by permission and scope, changing and
  turning off, adding again after, another patient's alert not found, and
  an archived patient refused.
- Build passed. E2E: 84 of 86 passed on the full run; the new alerts
  journey failed on both widths because its locators also matched the
  closed sheet's "No alerts yet" and a notice's close button. On a phone a
  notice over the sheet's foot also blocked the next tap. The test now
  matches exactly and closes the notice. Then `patients.spec.ts` passed
  (14, phone and desktop), axe clean. The journey: a doctor adds a
  condition and an allergy, notes the allergy, turns the condition off
  after confirming, and finds it folded; the header shows the allergy; a
  receptionist without `visits.view` sees no alerts.
- Your dev server (port 3000) answered the new alert route without running
  its schema: an empty note reached the database and was refused. The same
  route answers correctly through the integration harness and in the
  production build, so its compiled modules look stale. Restarting it
  clears that. Screenshots were taken from the production build.

### Blockers
- None. Alerts at the top of a visit and above the prescription come with
  Phase 6.

## 2026-10-04 — No Call button on the patients list

### Changed
- The patients list no longer carries a Call button on each row (D121,
  replacing D110). The user asked whether it was overkill now that the
  profile has Call, and for what is production grade:
  - The list is for finding a patient. Call and WhatsApp are on the
    profile, a tap away, with the name and alerts in view.
  - A call target on every row sat where a thumb opens the row, inviting a
    dialled mis-tap.
- Each row's line is age · gender · number, and the mobile joins it from
  640 px (tablet, desktop, a phone turned sideways). At 390 px the mobile
  only came out cut short, so a phone leaves it to the profile.
- Kit: `IconLink` removed; it existed only for that button. DESIGN.md
  follows.
- Plan: D121 recorded; D110 marked replaced; §10.2 updated.

### Validation
- Typecheck, lint, format check passed. Unit and integration tests passed
  (1866), coverage 100%.
- Build passed; E2E passed (86, phone and desktop), axe clean. The list
  journey now finds the mobile in the matching row rather than a Call link.
  This change was validated together with R4.5.

### Blockers
- None.

## 2026-10-04 — R4.6 Archive and restore patients

### Added
- Archive and restore a patient (plan §10.1, D103), for `patients.edit`
  within the doctor scope, audited as ARCHIVE and RESTORE:
  - `POST /api/patients/[id]/archive` and `/restore`, with
    `archivePatient` and `restorePatient` in `features/patients/api.ts`.
    The database stamps when and by whom (0015's `check_patient`). A second
    archive is refused as `PATIENT_ARCHIVED`; restoring a patient who is not
    archived leaves them as they are, with nothing audited.
  - A patient now carries `archivedAt` and `archivedBy` (the archiver's name,
    read through the teammates policy) in place of `archived`.
- The design, as the user chose it (D122 – D125):
  - **Archive** sits at the foot of the patient's edit sheet, under a
    hairline, as on a catalogue entry's sheet. It asks first.
  - The profile stays after archiving. Its header shows a notice: "Archived
    on 4 Oct 2026 by Asha Menon", that the profile is read-only until
    restored, and **Restore** for `patients.edit` while the clinic may
    write.
  - Restore asks nothing.
  - The patient leaves the list and search for the Archived tab. Edit and
    changing alerts stay off until they are restored.
- `usePatientArchive` (confirm, mutations, notices) and `PatientArchived`
  (the notice).

### Changed
- Kit: the catalogues' `ArchiveEntryButton` moved to
  `src/components/ui/archive-button.tsx` as `ArchiveButton`, now used by two
  features. "Archive" and "Restore" moved to `UI_TEXT.actions`.
- Plan: D122 – D125 recorded; §10.1 and §10.3 updated. DESIGN.md:
  `ArchiveButton`, the archived notice, and the header's rows.

### Validation
- Typecheck, lint, format check passed. Unit and integration tests passed
  (1892), coverage 100%.
- Integration: archived and restored through the app's functions. Refused
  to staff without `patients.edit`, to another doctor and to another
  clinic. The audit rows, the list and Archived tabs, and the read-only
  refusals are checked.
- Build passed; E2E passed (88, phone and desktop), axe clean. The new
  journey: a receptionist archives a patient from the edit sheet after
  confirming, stays on the profile with the notice, finds them under
  Archived, and restores them.

### Blockers
- None. What happens to an archived patient's future appointments comes
  with Phase 5 (R5.1 already refuses booking for one, D103).

## 2026-10-05 — An icon on the Alerts button when alerts are view-only

### Changed
- The profile header's **Alerts** button always carries an icon now (D126,
  the user): a pencil when the alerts may be changed, an eye when they may
  only be read. That covers an archived patient, a view-only clinic, and
  someone with `visits.view` alone. Before, a view-only button had no icon
  and read like a chip. The user saw it in the archived-profile phone
  screenshots and took it for a phone-width problem; the editable phone
  profile already had the pencil.
- The profile and the alerts treat a patient without `archivedAt` as not
  archived (`!archivedAt` rather than `=== null`). A server answering in
  the older shape no longer hides Edit and the pencil. Your dev server
  (port 3000) still answers with `archived` and no `archivedAt`, so it is
  running stale code; restarting it clears that.
- Plan: D126 recorded; §10.4 updated. DESIGN.md: `AlertChip`'s row.

### Validation
- Typecheck, lint, format check passed. Unit and integration tests passed
  (1892), coverage 100%.
- Build passed; E2E passed for patients and catalogues (22, phone and
  desktop), axe clean. Screenshots checked at phone and desktop, light and
  dark.

### Blockers
- None.

## 2026-10-05 — R4.7 Integration: who reaches a patient

### Added
- `tests/db/integration/patient-access.test.ts`: each member sends their own
  token to the real patients route handlers, so the guard, the feature
  function and RLS answer together:
  - Staff without `patients.view` are refused by all ten patients routes
    (403). At the database itself they read no patients and no alerts, and
    `search_patients` finds none.
  - `patients.view` alone reads the list, a mobile's family and a profile.
    It adds, changes and archives none, and reads no alerts (403).
  - The doctor scope (D3): a doctor lists and matches only their own, and
    adds, reads and changes their own. Every route that names another
    doctor's patient answers not found, and nothing of theirs changes.
  - Another clinic finds none of the clinic's patients, and every route
    that names one answers not found.
- The permission matrix (`permissions.test.ts`) gains rows for
  `patients.view`, `patients.create` and `patients.edit` (guard, RLS,
  `create_patient`), and for `visits.view` and `visits.edit` on alerts.
- Tenant isolation: B's owner finds none of A's patients by search, gets
  `can_see_patient` false, plants no alert on A's patient (RLS, and the
  composite key when B's own clinic is named), and archives none.

### Validation
- Typecheck, lint, format check passed. Unit and integration tests passed
  (1907), coverage 100%.
- No app code changed, so E2E was not run again; it last passed at 88 with
  R4.6 and 22 after the alerts icon change.

### Blockers
- None. The clinic-deletion test gets its patient rows when `delete_clinic`
  arrives; it does not exist yet.

## 2026-10-05 — R4.8 Importing patients from a file

### Added
- `/settings/import` (owner only): import patients from a CSV or Excel
  (.xlsx) file in four steps, one at a time (plan §10.5, D127 – D133).
  - **File:** read in the browser with Papa Parse or read-excel-file (D127).
    The file is never sent or kept. The old .xls is refused with how to save
    it again. A file with more rows than the platform allows is refused (D128).
  - **Columns:** each field is matched to a column guessed from the headers
    ("Mobile No.", "D.O.B", "Patient's mobile number"), with the first row's
    value shown underneath.
  - **Check:** each row is checked by the add sheet's own schema, and dates
    are read day first (D130). Problems are listed in words for fixing a
    file. Possible duplicates are listed with what they matched (a patient
    already here, or an earlier row), and skipped unless ticked (D129).
  - **Import:** sent in batches of 200, with progress shown. Leaving the
    page asks first, and a stop carries on from the same batch. The summary
    has the counts, **Download rows not imported** (a CSV with a Problem
    column), **Open patients** and **Import another file** (D133).
- An owner whose clinic has no patients yet gets **Import from a file** on
  the empty patients list (D132).
- `0016_patient_import`:
  - `platform_settings.max_import_rows` (default 10,000, bounds 100 – 50,000),
    and `update_platform_settings` learns it (D128).
  - `import_patients` is safe to send again: each row carries its own key, a
    known key is found rather than added, and no number is skipped. It
    answers each row's patient and whether it was added.
- Routes: `GET, POST /api/patients/import` (the limits; a batch) and
  `POST /api/patients/import/matches` (the clinic's patients on a batch's
  mobiles, in the body, D98). All are owner only; each batch is audited
  once, by count and patient numbers.
- Kit: `Steps`; `Row`'s `wrap` option. `useRevalidate` was split out of
  `useApiMutation` so the import can refresh the lists. `saveCsv`,
  `formatCount`, `utcDayKey`.

### Changed
- Plan:
  - D127 – D133 recorded.
  - §6 gains `max_import_rows`; §10.5 is rewritten; §30 has the new routes.
  - Later migrations move up one: `0017_appointments` … `0027_clinic_deletion`.
- DESIGN.md: `Steps` and the import screen's patterns; `Row` `wrap`.
- `import_patients` now needs a key on each row; the existing tests and the
  E2E import helper send one.

### Validation
- Typecheck, lint, format check passed. Unit and integration tests passed
  (2009), coverage 100%.
- Integration:
  - A batch sent again, whole or in part, adds no one twice and skips no
    number.
  - A row without its key is refused; a refused row refuses its batch.
  - Owner only, through the function and through every import route.
  - Audited once per batch; the row cap is held within its bounds.
- Build passed; E2E passed (92, phone and desktop), axe clean. Two new
  journeys:
  - A CSV imported from Settings: problems, a patient already here, a row
    twice in the file, one ticked anyway, and the rows not imported
    downloaded and read back.
  - A real .xlsx imported from the empty list, its date cell and a
    day-first date stored as the right days.
- Screenshots at phone, light and dark, and desktop showed the page
  scrolling sideways on a phone. The step indicator was too wide, and the
  flow's grid grew with it. A phone now names only the current step, the
  flow keeps to one column, and long problem reasons wrap. Rechecked with no
  overflow on any step.

### Blockers
- None. Note: `npm audit` reports a critical advisory for `next` 16.2.x and
  high ones in ESLint's tooling. They predate this change; upgrading Next is
  its own change, for the user to decide.

## 2026-10-05 — A speed phase before release; speed in every row

The user asked for the app to be fast before it goes live, because Brio's
live app lagged after it was deployed. This change records the plan only; no
code changes.

### Changed
- Plan:
  - **D134:** a new **Phase 13 — Speed** comes before release. Hardening
    and release move to **Phase 14**, and each old R13.n is now R14.n.
  - **D135:** speed is part of every row from R5.1 on (new §37.1).
  - **D136:** docs travel with their change, in one commit. The tracker now
    reads **DONE (date)**.
- §37 adds two budgets:
  - **Round trips:** a screen or read waits on at most 2 (the session, then
    everything else at once), and a save on at most 4.
  - **Hosting:** the server sits beside the database, with functions kept
    warm.
- **§37.1, the rules every row follows:**
  - index each query it adds, in its own order;
  - keep policies worked out once a statement;
  - make reads that don't depend on each other at once;
  - no query in a loop, and no read-back after a write;
  - select only the columns shown, and add up in SQL;
  - keep the browser light;
  - say in the changelog how many round trips its screens and saves wait
    on.
- **Phase 13's rows:**
  - R13.1: a load seed and the measuring setup.
  - R13.2: `0028_session_profile`, the session in one round trip.
  - R13.3: `0029_faster_reads`, indexes and policies from EXPLAINs on the
    load seed, with Supabase's performance advisor clean.
  - R13.4: round trips cut to the budget.
  - R13.5: page weight and the proxy.
  - R13.6: `bom1` and fluid compute in `vercel.json`.
- **Phase 14:** R14.5 re-runs the speed measurements after the security
  rows, and R14.8 checks the live app answers from `bom1::bom1` within
  budget. §29 lists the two new migrations.
- **AGENTS.md:**
  - §2.3: docs go in the change's own commit.
  - §25: the speed rules.
  - §33: the tracker row's format.
  - §36: the definition of done includes indexes and the budget.

### Notes
- These rules come from what made Brio slow and what fixed it (its
  changelog for releases 1.0.1 – 1.0.2):
  - its server ran in Washington, far from the database in Mumbai;
  - idle functions took 1 – 8.5 s to answer;
  - each screen waited on 3 – 4 database round trips, one after another;
  - lists had no index in their own order;
  - policies re-ran their helper on every row.
- ClinicDesk's session check today waits on 3 round trips before a screen
  reads anything: Supabase Auth, the profile, then the plan and settings.
  R13.2 brings it to one. The rows built so far (Phases 0 – 4) are measured
  and fixed in Phase 13; rows from R5.1 on follow §37.1 as they are built.

### Validation
- Docs only. No code, test or migration changed.

### Blockers
- None.

## 2026-10-11 — Appointments in the database (R5.1)

Phase 5 starts with appointments in the database. `0017_appointments` adds the
table, the double-booking guard, the status moves, tokens and the functions the
booking sheet, the calendar and the queue will call (R5.2 – R5.5). The
holiday-or-leave sheet now lists the appointments already on the days being
picked (D87). Asked of the user first: D137 – D143.

### Added
- `supabase/migrations/0017_appointments.sql`:
  - `appointments`: patient, doctor, one of the clinic's appointment types, a
    start and a length (5 – 480 minutes). A booking starts on the clinic's
    5-minute steps; a walk-in at now. `local_date` is set by trigger in the
    clinic's timezone. It is never deleted, only cancelled, with a reason,
    stamped with when and by whom.
  - **No double-booking (D7):** an exclusion constraint on the doctor and
    `appointment_slot(start, minutes)` (start included, end not, so
    back-to-back never clash) over live bookings. A walk-in holds no slot. A
    clash answers `APPOINTMENT_SLOT_TAKEN` naming the time it clashed with,
    never whose it is.
  - **Statuses:** `appointment_status_next()`, kept equal to
    `APPOINTMENT_STATUS_TRANSITIONS` by tests/db, with Arrived → No-show
    added (D138). In progress and done are left for the queue (0018).
  - **Tokens:** `daily_tokens`, one counter per doctor per day under a row
    lock. A patient keeps their token for the day (D141); moving the
    appointment to another day or doctor gives it back.
  - **Functions:** `create_appointment` and `add_walk_in` (once per
    idempotency key), `update_appointment`, `change_appointment_status`,
    `mark_arrived`.
    - Each checks its permission (cancel needs `appointments.cancel`), the
      doctor scope and that the clinic can write.
    - Nothing is booked, moved or arrived for an archived patient (D103), on a
      closed day (a walk-in neither, D139), in the past, or with a doctor or
      type no longer active.
    - A confirmed appointment moved to another time or doctor is scheduled
      again (D142).
    - A patient is marked Arrived only on the appointment's own day (D143).
  - **The doctor scope grows:** an appointment's doctor sees its patient
    (`patient_doctors`, by trigger).
  - **`check_patient`:** a patient with an appointment still to come is not
    archived (`PATIENT_HAS_APPOINTMENTS`, naming when, D140).
  - **`closure_appointments`:** the appointments on a closure's days, the
    first 20 and how many in all. A patient is named only to someone who may
    see them.
- **The holiday-or-leave sheet (D137):**
  - What it shows: once the days are picked, how many appointments fall on
    them and the first 20 — patient, day and time, doctor — and that they
    stay booked. If the check fails, it says so and offers Try again rather
    than passing for none.
  - Code: `ClosureAppointments` and `useClosureAppointments` (clinic
    feature); `GET /api/closures/appointments` (`settings.manage`, the days
    parsed by the new `closureDaysSchema`); `listClosureAppointments`.
- **Constants:**
  - `APPOINTMENT_SOURCES`, `APPOINTMENT_STATUSES` with labels and tones, and
    `APPOINTMENT_STATUS_TRANSITIONS`;
  - `APPOINTMENT_STEP_MINUTES` and `CLOSURE_APPOINTMENTS_SHOWN`;
  - the appointment error codes, mapped as business rules in
    `fromSupabaseError`.

### Changed
- **Archiving a patient** refused for an appointment to come titles its card
  with the day: "Rohan Mehta has an appointment on 12 Oct" (D140).
- **Plan:**
  - D137 – D143 in the decision log;
  - §9 (the closure list), §10.1 (archive), §11.1 (the booking rules and
    moving), §11.2 (Arrived → No-show) and §11.3 (tokens, own day);
  - §28.4 (columns, constraint, indexes), §29, §30 (the new route);
  - the tracker: R5.1 DONE.
- **DESIGN.md:** coral's list of uses gains the warning mark over the
  appointments on days about to be closed.

### Speed (§37.1)
- **Round trips:**
  - The closure sheet's check waits on the session, then one call
    (`closure_appointments` gives the rows and their total in one query).
  - Each function is one call. Its screens and their read-backs come with
    R5.2 – R5.5.
  - The archive check runs inside the archive's own update, so it adds no
    round trip.
- **Indexes,** each leading with `clinic_id` in the read's own order:
  - `(clinic_id, local_date, scheduled_at)`: the day, the queue and a
    closure's days;
  - `(clinic_id, doctor_id, local_date, scheduled_at)`: a doctor's days and
    week;
  - `(clinic_id, patient_id, scheduled_at desc)`: a patient's history and
    what is to come.
  - Every foreign key is indexed too: the type, who created, who updated and
    who cancelled.
  - The exclusion constraint's gist index answers clashes, and the token
    counter is a primary-key upsert.
- **Policies:** `appointments_select` follows the `0015` pattern, so
  `can_see_patient()` is never asked per row.

### Validation
- Typecheck, lint and format check passed.
- Unit and integration tests passed: 2091 tests, coverage 100%. The new
  integration tests cover booking, clashes, closed days, the past, archived
  patients and inactive doctors, statuses and permissions, tokens (per doctor,
  kept for the day, given back on a move), walk-ins, moves, the doctor scope,
  the archive refusal, the closure list and a view-only clinic. Rows were
  added to the tenant-isolation test (`appointments`, `daily_tokens`) and the
  permission matrix (`appointments.*`).
- E2E: the closures journey gains days that already have appointments,
  listed to the owner by name and to a settings-only member as "A patient",
  and still booked after saving.

### Blockers
- None.

## 2026-10-11 — The booking sheet (R5.2)

Appointments can now be booked. The sheet opens from **Book appointment** on
the new Appointments screen and from the ＋'s Appointment. The calendar joins
the screen in R5.3. Asked of the user first: D144 – D151.

### Added
- **The booking sheet** (`BookingSheet`, D144 – D151):
  - **Patient:** a search in the sheet (name, mobile or number), the best
    six matches to choose, then the chosen patient with **Change**.
  - **New patient** (with `patients.create`): name, mobile, date of birth or
    age and gender, filled from what was searched. "Already here?" on the
    mobile chooses one already there.
  - **The rest:** the doctor; the date; the time as its hour, then its
    minutes; the doctor's booked times that day, under the time (times
    only); the type, which sets the length (chips, or Other starting from the
    length it leaves); notes.
  - **Defaults:** today, the doctor booking (or the clinic's only doctor),
    and the clinic's first type with its length.
  - **Refusals:** a taken time or a closed day is named on the card and at
    its field, and the sheet keeps everything. Booking again sends the same
    key.
  - **Booked:** the sheet closes with "Booked Rohan Mehta · 13 Oct, 10:30 AM
    with Maya Rao".
- **The Appointments screen** (`/appointments`): **Book appointment** for
  `appointments.create`, and the view-only note. It arrives with the doctors
  and the appointment types already read.
- **`POST /api/appointments`** (`bookAppointment`): the booking as
  `bookingSchema` parses it, once per Idempotency-Key.
  - A new patient is added first under their own key (`patientKey`,
    `addPatient`) and stays added if the booking is refused. The refusal then
    names them, so the sheet goes on with them found and nothing is added
    twice.
  - The booking is audited with its values, its notes by name only.
  - Its answer is worded from what was chosen, so a booker who may not read
    appointments back still gets it.
- **`GET /api/appointments/booked`** (`listBookedTimes`): a doctor's taken
  times on a day. `doctor_booked_times` was added to the unreleased `0017`
  (for `appointments.create` or `.edit`; never whose they are) and applied
  to the local database by hand.
- **Kit:**
  - `ClockField`: a time in two pickers.
  - `SelectMenu` takes `opensAt`; the booking hours open on the hour it is
    now for today, on 9 AM for another day (`FIRST_HOUR_SHOWN`).
- **Patients:**
  - `usePatientSearch`: a picker's search, in the body (D98).
  - `prefillFrom` moved to `features/patients/prefill.ts`, shared by
    Patients and the booking sheet.
  - `PatientMatches` takes `onChoose`.
- **`allInOrder`** (`src/lib/parallel.ts`, ported from Brio): reads that
  don't depend on each other go at once, failing for the first one listed.
- **Constants and words:**
  - `PICKER_RESULTS` and `FIRST_HOUR_SHOWN`;
  - `HOURS`, `MINUTES`, `LENGTH_CHOICES`, `OTHER_LENGTH` and `PATIENT_MODES`
    with `bookingSchema`, `bookedTimesSchema` and `newPatientSchema`;
  - `dayTime` and `formatHour`;
  - `UI_TEXT.appointments`.

### Changed
- **`useAddForm`:** the ＋'s forms open and close through the browser's own
  history, which the router follows, instead of `router.push` /
  `router.replace`. Closing a form after a save no longer re-renders the
  screen on the server. Before, the sheet lingered while that happened, long
  enough for a success card (3 s) to time out. The patients and shell
  journeys pass unchanged.
- **Plan:**
  - D144 – D151 in the decision log;
  - §11.1 (the booking sheet), §29 (`doctor_booked_times`) and §30 (the new
    route);
  - the tracker: R5.2 DONE.
- **DESIGN.md:** `ClockField`, a record found in a sheet, a line of times.

### Speed (§37.1)
- **Round trips:**
  - The screen waits on the session, then the doctors and the types at once.
  - A search of patients is the session plus one call. The doctor's day is
    the session plus one call.
  - A booking of a patient found waits on the session, the booking, then the
    audit row.
  - A booking with a new patient waits on four, the budget's limit: the
    session; the patient; the booking beside the patient's read-back
    (`allInOrder`); the audit rows.
- **Indexes:** `doctor_booked_times` reads `(clinic_id, doctor_id, local_date,
  scheduled_at)`, added in R5.1. The patient search uses 0015's.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed, coverage 100%. `booking.test.ts`
  covers:
  - booking once per key, and the audit row with no notes in it;
  - a new patient added once however often sent, kept and named when the
    time is taken, and not added twice on the next try;
  - `patients.create` and the patient's key required;
  - a doctor's taken times, live bookings only, for whoever books.
- E2E (phone and desktop, axe): `tests/e2e/appointments.spec.ts`.
  - The front desk books from the ＋: they find the patient, see the
    doctor's day, are told the taken time and book the next free one. The
    sheet is checked not to run off a phone's side.
  - A patient new to the clinic is booked with their booking.

### Blockers
- None.

## 2026-10-11 — The calendar (R5.3)

The Appointments screen is now the calendar. Asked of the user first: D152 –
D159.

### Added
- **The calendar (`Appointments`, plan §11.5):**
  - **Opens on:** today. Every doctor's for the front desk; a doctor's own
    for a member with the Doctor role (D155).
  - **Phone:** the day as a list by time — patient, time, type (or Walk-in
    and its token, D154), the doctor while every doctor's are shown, and the
    status — under a date strip that reaches a week back and four weeks
    ahead, with a calendar for any other day (D157).
  - **Tablet and desktop:** a day with a column per doctor, or one doctor's
    week, Monday to Sunday (D158). The grid runs 8 AM – 8 PM, stretching to
    fit (D152), in quarter hours. A tap on an empty quarter opens the booking
    sheet with that doctor, day and time (D156) — never on a closed column,
    nor before now. Today, Previous and Next sit beside the day or week.
  - **Closures:** the day's holiday and leave are said above it, and shaded
    on the grid.
  - **Cancelled and no-shows** are folded away, counted, at the foot (D153).
  - Appointments don't open yet; their detail is R5.4 (D159).
- **`CalendarGrid`** (kit, D66): columns of steps; overlapping items share
  their column in lanes (`lanesOf`); closed columns are shaded; empty steps
  are tapped to start something there; columns can be set narrower for a
  week.
- **Calendar screen pieces:** `CalendarToolbar`, `CalendarBoard`, `DayList`,
  `AppointmentBlock`, `ClosureNotices`, `CancelledList`.
- **Helpers:**
  - `calendar.ts`: `firstDoctorFilter`, `weekOf`, `isLive`, `gridHours`,
    `closuresOn`;
  - `describe.ts`: an appointment said whole;
  - `calendarKey`, `useAppointments`, `minutesOfDay`.
- **`GET /api/appointments`** (`listAppointments`): the days asked (at most
  a week, `calendarQuerySchema`), one doctor's or every doctor's, by time,
  each with its patient, doctor and type in one query. It is read as the
  member, so a doctor finds only their own patients' — all of each one's.
- **Constants:** `CALENDAR_HOURS`, `CALENDAR_STEP_MINUTES`, `DATE_STRIP_DAYS`,
  `MAX_CALENDAR_DAYS`, and `UI_TEXT.calendar`.

### Changed
- **A screen's first reads can be worked out from who is signed in**
  (`AppScreen` / `readScreen` take a function of the member): the calendar's
  first read is keyed to a doctor's own column.
- **The booking sheet** takes a `prefill` from a tapped quarter, and
  refreshes the calendar once it books.
- **Plan:**
  - D152 – D159 in the decision log;
  - §11.5 and §30;
  - the tracker: R5.3 DONE.
- **DESIGN.md:** `CalendarGrid`, an appointment on the grid, a day's closures.

### Speed (§37.1)
- **Round trips:**
  - The calendar opens on the session, then everything at once: the
    doctors, the types, the closures and today's appointments, all read on
    the server.
  - Changing the day, the week or the doctor is the session plus one query.
- **Indexes:** a day or week is served by `(clinic_id, local_date,
  scheduled_at)`, and one doctor's by `(clinic_id, doctor_id, local_date,
  scheduled_at)`, both from R5.1. A week is at most seven days.

### Validation
- Typecheck, lint and format check passed.
- Unit and integration tests passed, coverage 100%. `calendar.test.ts`
  (integration) covers the days by time, one doctor's, and the doctor scope.
- E2E (phone and desktop, axe), `tests/e2e/calendar.spec.ts`:
  - **Phone:** today's walk-in; another day from the strip; the cancelled
    folded away; nothing wider than the screen.
  - **Desktop:** a column per doctor; a tapped quarter booked there with its
    doctor, day and time, then shown on the grid; one doctor's week.
- The full E2E suite passed: 100 tests.

### Blockers
- None.

## 2026-10-11 — The appointment's detail (R5.4)

An appointment now opens, and a patient's profile shows their appointments.
Asked of the user first: D160 – D167.

### Added
- **The appointment's detail (`AppointmentSheet`, plan §11.2, D160):** a
  sheet over the calendar or the profile, opened from the grid, the day's
  list, the cancelled list, and the profile's next appointment and history.
  - **It says:** who, when, with whom, what kind and where it stands; its
    notes; who booked it and when; who cancelled it, when and why; **Open
    profile** (not on the profile itself). It opens on what the calendar
    holds and fills in.
  - **Its actions, as the status allows** (`actionsFor`):
    - **Confirm** a booking still scheduled;
    - **Reschedule** a booking not yet arrived, or **Edit notes** once it
      cannot move (D161);
    - **No-show** once its time has passed, asking first (D163);
    - **Cancel appointment** (`appointments.cancel`).
  - An archived patient's appointment offers nothing, saying why (D103). A
    view-only clinic hides the actions and says why. **Arrived** comes with
    the queue in R5.5 (D164).
  - Done, it closes with a card: "Confirmed Rohan Mehta · 13 Oct, 10:30 AM"
    (D165).
- **Cancelling (`CancelSheet`, D162):** a quick reason — Patient asked,
  Doctor unavailable, Clinic closed, Booked by mistake — or **Other**, typed.
  The coral card then asks first, naming when, with whom and why.
- **Edit notes (`NotesSheet`, D161).**
- **`AppointmentPanel`:** each action's sheet opens in the detail's place;
  closing it goes back to the detail; done, everything closes.
- **The profile (D166, D167), for `appointments.view`:**
  - **Next appointment:** the soonest still to come, opening its detail; or
    "No appointment to come" with **Book**, which opens the booking sheet on
    the profile for them.
  - **History:** every appointment, newest first, 20 at a time, cancelled
    ones and no-shows quiet with their reason. It stays one column (D114).
- **Routes:**
  - `GET /api/appointments/[id]` (`getAppointment`);
  - `PATCH /api/appointments/[id]` (`changeAppointment`): its notes alone,
    or moved, through `update_appointment` — a confirmed one moved is
    scheduled again (D142);
  - `POST /api/appointments/[id]/status` (`changeAppointmentStatus`):
    confirmed, scheduled or a no-show with `appointments.edit`, cancelled
    with `appointments.cancel` — the status asks for its own permission;
  - `GET /api/patients/[id]/summary` (`getPatientSummary`: the next
    appointment) and `GET /api/patients/[id]/timeline`
    (`listPatientTimeline`: the appointments, a page at a time). Each part
    is given only with its permission.
- **Schemas:** `rescheduleSchema`, `appointmentNotesSchema`,
  `appointmentChangeSchema`, `statusChangeSchema`, `cancelSchema`,
  `pageQuerySchema`.
- **Constants:** `APPOINTMENT_STATUS_CHANGES` (kept equal to
  `change_appointment_status` by the 0017 contract test), `UI_TEXT.appointment`,
  the profile's words, `APPOINTMENT_LOAD_FAILED`.

### Changed
- **The booking sheet:**
  - opens to move an appointment, the patient staying (`moving`). A time
    kept where it is is not refused as passed. The doctor's taken times leave
    its own out;
  - opens for a patient from their profile (`patient`), starting on the
    doctor;
  - refreshes the patient's next appointment and history once it books.
- **The calendar's grid** items are buttons that open the appointment; the
  day's list and the cancelled list rows open it too.
- **`AppointmentBlock`** is spans, as it sits inside that button, and has
  small corners so a quarter-hour block keeps its edge straight.
- **`FormSheet`** takes `initialFocus`.
- **A card's announcement follows the card:** said inside a sheet that then
  closes, it is said again where the card goes. A sheet closed through the
  browser's history (the ＋'s forms) goes a moment after its card appears,
  which left the announcement in a region no one could hear. The E2E suite
  caught it as a flaky booking test (`isOpenStatus`, `response-card.tsx`).
- **The profile page** reads the summary, the first page of the history and
  the appointment types with its first data.
- **Plan:**
  - D160 – D167 in the decision log;
  - §11.2, §10.3 and §30;
  - the tracker: R5.4 DONE.
- **DESIGN.md:** a record's detail sheet, a reason sheet, the profile's next
  appointment and history, the grid's items as buttons.

### Speed (§37.1)
- **Round trips:**
  - Opening an appointment is the session plus one query. It shows what the
    calendar already holds while that query runs.
  - The profile opens on the session, then everything at once: the patient,
    the alerts, the summary, the history's first page, the doctors and the
    types.
  - A status change, a move or a notes change waits on 4: the session, the
    appointment as it stands (for the audit's "from"), the change, the
    audit row.
- **Indexes:** the next appointment and the history are served by
  `(clinic_id, patient_id, scheduled_at desc)` from R5.1; one appointment by
  its primary key.

### Validation
- Typecheck, lint and format check passed.
- Unit and integration tests passed, coverage 100%.
  `appointment-detail.test.ts` (integration) covers the detail and the doctor
  scope; confirm, cancel and no-show, each audited, and their permissions;
  notes and a move (D142), a clash and a move refused; and the next
  appointment, the paged history and the summary without permission.
- E2E (phone and desktop, axe), `tests/e2e/appointment-detail.spec.ts`:
  - **Phone:** opened from the day's list, confirmed, then cancelled with a
    reason, asked first, and found folded away.
  - **Desktop:** rescheduled from the grid an hour later; the profile's next
    appointment and history, a detail opened there; **Book** for a patient
    with nothing to come.
- The full E2E suite passed: 102 tests.

### Blockers
- None.

## 2026-10-12 — Walk-ins and today's queue (R5.5)

The Queue screen is built: walk-ins, arrivals with their tokens, and today's
queue. Asked of the user first: D168 – D175.

### Added
- **Today's queue (`Queue`, `/queue`, plan §11.4):**
  - **Opens on:** every doctor's for the desk; a doctor's own for a member
    with the Doctor role. Anyone may switch, by the capsules on the land
    (D170).
  - **Phone (D168):** stacked, as the shaped screen (§32.1), not §11.4's
    tabs. The patients with a doctor sit in the lake ("The room is free"
    when no one is in), then Waiting by token, Still to come, and Done
    folded with its count.
  - **Tablet and desktop (D169):** the sections side by side — Waiting, With
    doctor, Still to come, Done. A tapped patient opens in the side sheet.
  - **Rows:** Waiting gives the token, name, Walk-in or booked time, and the
    minutes waited. Still to come gives the booked time — "Late 25 min" in
    coral words once it has passed (D174) — and **Arrived** on the row
    (D172). Everything else is in the appointment's detail.
  - It is read again every 15 s and on focus (`QUEUE_REFRESH_MS`, D34),
    never while the tab is hidden, and the minutes waited count on in
    between (`useNow`).
- **Add walk-in (`WalkInSheet`, D171, D175):** the patient — found, or added
  there with "Already here?" — the doctor and the type. It starts on the
  queue's doctor, else the member's own, else the only doctor. It opens from
  its button or the ＋'s Walk-in (D67). Refused on a closed day, it names the
  closure; a new patient added before the refusal stays added.
- **Arrived (D164, D173):** on a Still to come row and in the appointment's
  detail, on its own day only. A walk-in or an arrival closes with the token
  first: "Rohan Mehta is #7 with Maya Rao".
- **Routes:**
  - `GET /api/queue` (`listQueue`): today's still to come, arrived, with a
    doctor and done — and anyone still with a doctor from a day before —
    one doctor's or all;
  - `POST /api/appointments/[id]/arrived` (`markArrived`);
  - `POST /api/appointments/walk-in` (`addWalkIn`), once per key.
- **Schemas, constants, helpers:**
  - `walkInSchema`, `queueQuerySchema`;
  - `QUEUE_REFRESH_MS`, `UI_TEXT.queue`, `QUEUE_LOAD_FAILED`;
  - `queue.ts` (`queueSections`, `minutesSince`, `lateBy`, `walkInDoctor`),
    `queueKey`, `useQueue`, `useArrival`, `useNow`.

### Changed
- **`0017` (unreleased, applied again locally):**
  - `add_walk_in` hands back the token with the appointment — the one it
    took, or the one it already had for the key;
  - a partial index on those in progress, for the queue's carry-over.
- **The booking sheet's patient part** is its own component and hook
  (`PatientField`, `NewPatientFields`, `usePatientChoice`, `form.ts`), shared
  with the walk-in sheet. Booking and walk-ins share how the patient is found
  or added, and how a refusal names them (`patientFor`, `refusedWith`).
- **A booking and every change to an appointment** refresh today's queue.
- **Plan:**
  - D168 – D175 in the decision log;
  - §11.4 (the phone stacked, the desktop side by side, what R5.5 builds);
  - §30;
  - the tracker: R5.5 DONE.
- **DESIGN.md:** today's queue, a queue row, the walk-in sheet, the lake on
  the queue.

### Speed (§37.1)
- **Round trips:**
  - The queue opens on the session, then everything at once: the doctors,
    the types and today's queue, all read on the server.
  - Each 15-second refresh, and each change of doctor, is the session plus
    one query.
  - A walk-in waits on the round trips a booking does: two after the
    session, three with a new patient.
  - Arrived waits on 4: the session, the appointment as it stands (for the
    audit's "from"), the arrival, the audit row.
- **Indexes:**
  - today's queue is served by `(clinic_id, local_date, scheduled_at)`, and
    one doctor's by `(clinic_id, doctor_id, local_date, scheduled_at)`;
  - those still in from a day before by the new partial
    `appointments_in_progress_idx`.

### Validation
- Typecheck, lint and format check passed.
- Unit and integration tests passed, coverage 100%. `queue.test.ts`
  (integration) covers:
  - a walk-in once per key with the next token, audited;
  - a new patient kept and named on a closed day;
  - `patients.create` and the patient's key;
  - arrival with its token, on its own day only, with its permission;
  - the queue's day, its carry-over, one doctor's, and the doctor scope.
- E2E (phone and desktop, axe), `tests/e2e/queue.spec.ts`:
  - **Phone:** a walk-in from the ＋ given #1; a booked patient arrived from
    their row given #2; both waiting by token; the room free.
  - **Desktop:** the four columns; a late patient marked (the browser's
    clock set on); one doctor's queue; a patient arrived, then marked a
    no-show from their detail.
- The full E2E suite passed: 104 tests.

### Blockers
- None.

## 2026-10-12 — Races and Phase 5's journey (R5.6)

What happens when requests arrive at the same moment, proved against the
real database, and the front desk's journey end to end. Asked of the user
first: D176 – D178. The race tests found two faults, now fixed.

### Added
- **The race tests (`appointment-races.test.ts`, D176)**, each request its
  own transaction through PostgREST:
  - ten desks booking one doctor's time at once: one booked, nine told the
    time is taken, each naming it;
  - ten overlapping times, not all alike, booked at once: none left
    overlapping, each refusal naming one that stands;
  - two bookings moved into one time at once: one moves, the other is told;
  - ten arrivals and walk-ins for one doctor at once: tokens 1 to 10, none
    twice, none skipped — another doctor's counted apart;
  - the same booking, walk-in or arrival sent twice at once: one made, one
    token, one audit row.
- **Phase 5's journey (`front-desk-journey.spec.ts`, D177, D178)**, at a
  phone's width and a desktop's, each screen checked by axe:
  1. The owner invites a receptionist and a doctor; each joins by their link.
  2. The receptionist adds a patient, told who else is on the mobile.
  3. She books them with the doctor for later today; a second booking into
     that time is refused, naming it.
  4. She adds a walk-in — #1 — and the doctor's queue, open on their own
     device, shows him within its refresh.
  5. She marks the booked patient Arrived — #2.
  6. The doctor cannot find or open a patient booked only with another
     doctor.
  7. A second clinic reaches none of it.
- **Shared journey helpers:** `inviteMember` and `joinByInvite` in
  `tests/support/e2e.ts`, now used by Phase 3's journey too.

### Fixed
- **Two bookings into each other's time at once could deadlock** at the
  exclusion constraint. The database stopped one with a bare conflict, not
  "Maya Rao is booked 10:00 – 10:30". Writes into one doctor's time — a
  booking, a move, an arrival back from a no-show — now take a lock on the
  doctor first (`hold_doctor`, in the unreleased `0017`). Two at once wait
  their turn, and the second is told the first's time. The constraint still
  decides. No deadlocks in eight repeated runs.
- **A patient marked arrived twice** — a double tap, two desks at once — was
  refused the second time ("can't go to that status"). `mark_arrived` now
  changes nothing more and hands back the token already given, as a repeated
  status change does.

### Changed
- **`0017` (unreleased, applied again locally):** `hold_doctor`, and
  `create_appointment`, `update_appointment` and `mark_arrived` taking it;
  `mark_arrived` returns an appointment already arrived as it is.
- **Plan:**
  - D176 – D178 in the decision log;
  - §11.1 (the lock on the doctor) and §11.3 (arrived twice);
  - the tracker: R5.6 DONE.

### Speed (§37.1)
- No screen or save waits on more round trips.
- Bookings for one doctor at the same moment now queue on the doctor's lock
  for the few milliseconds each takes; other doctors' never wait.

### Validation
- Typecheck, lint and format check passed.
- Unit and integration tests passed, coverage 100%. The race tests passed
  eight runs in a row.
- E2E (phone and desktop, axe): Phase 5's journey and Phase 3's journey.
- The full E2E suite passed: 106 tests.

### Blockers
- None.
