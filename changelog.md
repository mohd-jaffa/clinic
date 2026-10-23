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

## 2026-10-12 — Reminders on WhatsApp (R5.7)

The front desk reminds a patient of their appointment on WhatsApp, with no
WhatsApp API: the chat opens with the message written, and a person presses
send. Asked of the user first: D179 – D184.

### Added
- **Remind on WhatsApp (`RemindButton`, plan §22.1):**
  - **Where (D179):** in an appointment's detail, after Confirm; as a round
    WhatsApp icon on the queue's Still to come rows, beside Arrived; and on
    the calendar's day list for today and the days to come.
  - **The message (`WHATSAPP_TEXT`, `reminderText`):** "Reminder: your
    appointment with Dr. Maya Rao at Smile Care on Tue 14 Oct, 10:30 AM." —
    "Dr." once, and no doctor once they are gone from the team.
  - **Noted when tapped (D180):** "Reminded" on the row, and when in the
    detail, at once, while it stays open. Again each time it is tapped.
  - **View-only (D181):** it still opens WhatsApp, and nothing is noted; the
    detail offers the reminder alone.
  - **Who and which (D182, D184):** `appointments.edit`; a booking scheduled
    or confirmed, today or later.
- **`POST /api/appointments/[id]/reminded`** (`markReminded`): through
  `mark_reminded` in the unreleased `0017`, audited from when it was last
  sent; anything but a booking still to come is refused
  (`APPOINTMENT_NOT_REMINDABLE`).
- **`IconLink`** (kit): a round icon link out of the app, opened in a new tab.
- **`formatShortDay`** ("Tue 14 Oct"), `isRemindable`.

### Changed
- **The calendar's reads carry each patient's mobile and when they were
  last reminded.** That covers the calendar, the queue, the detail, the next
  appointment and the history.
- **The share helper** (a PDF to WhatsApp through the share sheet, or
  downloaded on a desktop) moves to R6.8, with the first PDF sent (D183).
- **Plan:**
  - D179 – D184 in the decision log;
  - §22.1 and §30;
  - the tracker: R5.7 DONE, and R6.8 now carries the share helper.
- **DESIGN.md:** `IconLink`, Remind on WhatsApp.

### Speed (§37.1)
- **Round trips:**
  - Remind opens WhatsApp at once.
  - Noting it waits on two round trips after the session: the stamp, the
    audit row.
- **No new query:** the mobile and the reminder come with each read
  already made.

### Validation
- Typecheck, lint and format check passed.
- Unit and integration tests passed, coverage 100%. `reminders.test.ts`
  (integration) covers:
  - noted again each time, audited from the last;
  - a confirmed booking and one later today;
  - walk-ins, cancelled and past ones refused;
  - `appointments.edit`, and a view-only clinic.
- E2E (phone and desktop, axe): `appointment-detail.spec.ts` opens the
  reminder — the chat's link checked — and finds it noted.
- The full E2E suite passed: 106 tests.

### Blockers
- None.

## 2026-10-12 — Speed, security and smoke tests before any release

The user asked for performance, security and production smoke tests. They
are set up in Phase 13 and pass on this machine before anything is pushed
or deployed. This change records the plan only; no code changes. Asked of
the user first: D185 – D189.

### Changed
- **Plan:**
  - **D185:** Phase 13 sets up the speed, security and smoke tests. It is
    DONE only when all three pass, and Phase 14 and any deployment wait on
    that. Phase 13 is renamed "Speed and the release checks".
  - **D186:** the smoke test runs before users see a release. The new
    version is deployed without the domain, smoke-tested at its own address,
    and promoted only when that passes.
  - **D187:** the smoke test signs in to nothing, so no password is kept in
    GitHub.
  - **D188:** the dependency audit fails on high and critical advisories in
    shipped code, on every push and weekly.
  - **D189:** every test passes locally first. `npm run verify` runs
    everything CI runs, a pre-push hook runs it, and a release also needs
    `npm run test:speed` passed locally.
- **New rows:**
  - **R13.7, speed tests:** queries use their indexes, round trips are
    counted, and first-load JS is checked, on every push. The load-seed
    timings run before each release.
  - **R13.8, security tests:** the dependency audit, Supabase's database
    lints, and every API route behind its guard.
  - **R13.9, the smoke test:** read-only, run against the built app and
    then each new version.
  - **R13.10, locally first:** `npm run verify` and the pre-push hook.
- **Rows changed:**
  - R14.5 re-runs the speed tests.
  - R14.7's release runs every test, then deploys, smoke-tests and promotes.
  - R14.8's live check is the smoke test.
- **Sections:**
  - §34.1 lists the three new layers.
  - §34.3 adds "locally first".
  - §35 covers CI, the release steps and the local gate. A migration must
    keep the version before it working, since it is applied before the new
    version takes the domain.
  - §38: Phase 13 and 14's goals and done-when.
  - §40: the definition of shippable.
- **AGENTS.md §32:** the new checks and the local gate.

### Notes
- Today's shipped-code audit finds three advisories: `next` 16.2.x
  (critical), `sharp` and `source-map-js` (high). R13.8 fixes them before
  its gate is turned on.
- Load-seed timings are not run on every push, because shared CI runners
  time too unevenly. They run locally and in the release, before it deploys.

### Validation
- Docs only. No code, test or migration changed.

### Blockers
- None.

## 2026-10-13 — A screen opened again is not read twice

Asked by the user ("go ahead and fix it"; D190). A screen opened for the
second time showed the copy the browser kept from the last visit, then asked
the API for it again, although the server had just read it to draw the page.
Opened again within two seconds of the browser's last read of it, it was not
even asked again (SWR's deduping): the screen stayed on the old copy until the
next refresh.

### Fixed
- **`src/lib/query/ServerData.tsx`:** the data a page arrives with now goes
  into the SWR cache before the screen draws, replacing what the browser
  kept. A list starts again from its first page.
  - Each visit is told apart by Next's `useRouter().bfcacheId`: a new visit
    has a new id, and Back and Forward bring a page back under its first id.
  - A page brought back that way was read when it was first shown, so it
    changes nothing: the screen shows what the browser has and asks again.
  - A visit counts as shown once it is drawn (an effect), so a draw React
    sets aside does not count.
- **`src/lib/query/useSeeded.ts`:** the page's data counts as fresh while the
  cache holds that same data, not only while the cache is empty.

### Speed
- A screen opened again waits on the page's own read only: 2 round trips (the
  session, then its reads at once). It used to add one API call for each of
  its reads after drawing, each another 2 round trips. Back and Forward ask
  again, as before.

### Tests
- **Unit:**
  - `ServerData` shows the page's data over an older cached copy, from the
    list's first page, and asks nothing.
  - A visit brought back by history leaves the cache as it is and asks
    again.
  - A new visit on the same screen takes its data without asking; data
    handed again within the same visit puts nothing in the cache.
  - `useSeeded` counts the page's data as fresh once it is in the cache.
  - The first and last of these failed on the old code.
- **E2E** (`tests/e2e/screen-data.spec.ts`, phone and desktop):
  - Back to the patients screen shows a patient added since it was first
    read, asked for again.
  - Read again in the browser on return to the app, then left and opened
    again, the screen shows a patient added meanwhile with no API call.
  - On the old build, the opened-again check failed: the list stayed on
    the browser's copy, without the patient added meanwhile.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed, coverage 100%.
- E2E passed (phone, desktop).

### Blockers
- None.

## 2026-10-13 — A list's tab shows its own rows

Asked by the user, of Brio's notifications and orders: switching a filter
showed the last filter's rows for a moment, then the right ones. ClinicDesk's
list hook, ported from Brio, did the same on the Patients tabs (D191). The
user chose to fix it here only.

### Fixed
- **`src/lib/query/useApiPages.ts`:** the last rows were kept on screen for
  every new key (SWR's `keepPreviousData`), meant for typing a search. Under
  a new tab they were the wrong list, shown under its name until its answer
  came. Rows are now kept only within one `list`, which a hook names:
  - the same tab or filter, searched for something else, keeps the last
    rows until the new ones arrive;
  - another tab or filter shows its own rows if they have been read, and
    loading rows while they come;
  - a hook that names no list keeps nothing (a patient's timeline no longer
    shows the last patient's while another's comes).
- **`src/features/patients/hooks/usePatients.ts`:** each tab is its own list.

### Speed
- Unchanged: a list asks for what it asked before, and a tab read before is
  shown from the cache at once.

### Tests
- **Unit:** a search within one list keeps the last rows; another list is
  loading, never the last list's rows, and shows its own at once once read; a
  hook that names no list keeps nothing. The last two failed on the old hook.
- **E2E** (`tests/e2e/patients.spec.ts`, phone and desktop): with the
  archived held back, the Archived tab shows none of the list's patients and
  passes axe while loading, then shows the archived.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed, coverage 100%.
- E2E passed (phone, desktop).

### Blockers
- None.

## 2026-10-13 — R6.1 Visits and the queue's moves

The queue now moves patients through the doctor's room, and each visit
opens and closes with it (plan §11.4, §12.1). Asked of the user first:
D192 – D198.

### Added
- **`0018_visits`:**
  - `visits`: one consultation each, opened by Send in and closed as **To
    bill** by Done or Next patient, whatever was recorded (D43, D46). Its
    day in the clinic's timezone; its billing state, with No charge's reason
    ready for R8.
  - `vitals`: one set per visit, each reading within `VITAL_LIMITS`
    (`src/constants/clinical.ts`), recorded from R6.2.
  - `appointments.stepped_out_at` (D198).
  - The moves, each one function under the doctor's queue lock, taken
    before the appointment's row so two desks never cross:
    - `send_in`: asks what becomes of anyone already in — marked done, or
      kept in for a second chair — and refuses without a choice
      (`DOCTOR_ROOM_TAKEN`) (D192).
    - `mark_done`.
    - `next_patient`: finishes only the patient it is for, then sends in the
      doctor's lowest waiting token, skipping anyone stepped out; with the
      room free it sends in one, once (D196, D198).
    - `back_to_waiting`: removes an empty visit, keeps one with anything
      recorded (D197).
    - `mark_stepped_out` (D198).
  - `change_appointment_status` refuses to cancel or no-show an appointment
    whose visit was kept (`APPOINTMENT_HAS_VISIT`), and clears stepped out.
  - A visit's doctor joins the doctor scope.
- **Routes** (`appointments.edit`): `POST /api/queue/send-in`, `/done`,
  `/next`, `/waiting`, `/stepped-out`. `GET /api/visits/[id]`
  (`visits.view`).
- **The queue:**
  - Waiting rows carry **Send in**, with the busy-room card when the doctor
    has someone in.
  - The lake and the With doctor column carry **Done** and **Next patient**
    for anyone with `appointments.edit` (D193). A free room on one doctor's
    queue offers Next patient.
  - A patient stepped out is shown so.
  - A patient in links to their visit for whoever reads visits. On a phone,
    the lake's name opens the appointment's detail.
- **The appointment's detail:** Send in, Done, Back to waiting, Stepped out
  / Back, Open visit.
- **The visit screen** `/visits/[id]` (D195): the patient, doctor, status
  and alerts; while they are in, the lake with Done and Next patient. Next
  patient there opens the next patient's visit, or the queue when no one is
  waiting (D194). It refreshes as the queue does.

### Changed
- **The confirm card** may carry a second way to go ahead ("Keep both in").
- **`logActionsSafe`:** writes a change's several audit rows in one insert.
- **`AlertChips`:** shared by the profile and the visit.
- **`Lake`:** takes `onOpen`.
- **`Row`:** the title keeps at least 8rem. In a narrow column — the
  queue's four on a desktop — the actions go onto their own line under it,
  instead of squeezing the name away (found by the desktop E2E).
- **Plan:** D192 – D198; §11.4, §12.1, §28.4, §28.7 and §30.

### Speed
- **A queue move:** waits on 3 round trips — the session, the move, the
  audit rows — within the save budget of 4. No read before the write: the
  function hands back what it moved.
- **The visit screen:** waits on 2 — the session, then its one read (the
  visit with its patient, alerts, doctor and token).
- **The queue:** still one read; each appointment's visit is embedded,
  served by the visit's unique appointment index.
- **Indexes:**
  - `visits (clinic_id, patient_id, visit_date desc)` and
    `(clinic_id, doctor_id, visit_date desc)`;
  - `vitals (clinic_id, patient_id)`;
  - every foreign key.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed: 2561 tests in 405 files, coverage 100%.
  - The moves are run against the real database.
  - Two desks at once send in one patient, and press Next patient for one.
  - The permission matrix, tenant isolation and read-only cover the moves.
- E2E passed: 114 at phone and desktop, with axe. The 8 skipped are each
  for one width only. `queue-moves.spec.ts` is new.
- Screenshots of the queue, the busy-room card, the detail and the visit
  screen were checked at phone and desktop width, light and dark.

### Blockers
- None.

## 2026-10-13 — A card's three actions stay inside it

Found by the user in the R6.1 screenshots: on a desktop the busy-room card
(D192) was cut off at its right edge, its message and its main button with
it.

### Fixed
- **`src/components/ui/dialog.tsx`:** from 768 px a card's actions stood in
  one row that never wrapped, inside a card at most 28rem wide. Three
  actions — Cancel, **Keep both in**, **Mark done and send in** — are wider
  than that, so the card's content ran past its edge and was clipped. Now:
  - a card with three actions stacks them full-width at every width, the
    main one on top, as on a phone (`stackActions`, set by the confirm card
    when it carries a second action);
  - any row of actions wraps rather than spilling past the card.
- **`DESIGN.md`:** the card's rule says so.

### Tests
- **Unit:** the dialog's row wraps, and stacks when told; the confirm card
  with a second action stacks its three.
- **E2E** (`queue-moves.spec.ts`, desktop): each of the busy-room card's
  actions stands within the card, and nothing in it scrolls sideways. On the
  old build it failed: the main button ended 84 px past the card's edge.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed: 2562, coverage 100%.
- E2E passed: 114 at phone and desktop, with axe; 8 skipped, each for one
  width only.
- The busy-room card was re-checked at desktop width, light and dark.

### Blockers
- None.

## 2026-10-13 — The repository on GitHub

The user asked to push the code to github.com/mohd-jaffa/clinic and work
straight on `main` until the first release (D199). This change records the
workflow only; no code changes.

### Changed
- **`main`** now starts from the phase branches. Each phase branch was
  already part of the next, so all 100 commits are one line.
- **The repository is public** by the user's choice.
  - No secret is in its history.
  - `.env.example` holds the Supabase CLI's public demo keys, which only
    work against a local Supabase, and a local-only placeholder.
- **AGENTS.md §2.3 and plan §35:** until the first release, each commit is
  pushed straight to `main` once the whole suite has passed locally. CI runs
  on every push. Branches and PRs start with the first release.

### Validation
- Docs only. The whole suite passed locally on the commit before this one
  (a62eb2c).

### Blockers
- None.

## 2026-10-13 — The sign-up and reset link tests read the app's address

The first CI run on GitHub failed at coverage: two integration tests in
`tests/db/integration/auth.test.ts` expected the emailed links to land on
`http://localhost:3000`. On a laptop the app's address is port 3000. CI sets
it to 3100, the port its journeys run on.

### Fixed
- **`auth.test.ts`:** the confirm-email and reset-password links are
  checked against `NEXT_PUBLIC_APP_URL` and `AUTH_ROUTES`, which is what the
  app builds them from, so the test holds on any address.

### Validation
- `auth.test.ts` passed with the laptop's address and with CI's
  (`NEXT_PUBLIC_APP_URL=http://localhost:3100`).
- Typecheck, lint, format check passed. Unit and integration tests passed,
  coverage 100%.

### Blockers
- None.

## 2026-10-13 — The user pushes

The user asked that changes be committed on `main` and not pushed: they push
when they choose (D200). This change records the workflow only; no code
changes.

### Changed
- **AGENTS.md §2.3 and plan §35:** until the first release, each finished
  change is committed on `main` once the whole suite has passed locally. The
  agent does not push; the user does, and CI runs then. D200 narrows D199.

### Validation
- Docs only. The whole suite passed locally on the commit before this one
  (6e3dbd7).

### Blockers
- None.

## 2026-10-13 — R6.9: Urgent, a tag on a waiting patient

The user asked that anyone with `appointments.edit` can mark a waiting
patient Urgent, as a tag only: Next patient does not take them first (D201).
The user also chose: marked only while waiting; kept through the visit so the
doctor sees it; set from the appointment's detail.

### Added
- **`0019_urgent`:**
  - `appointments.urgent_at`. Its `CHECK` allows it only while the patient is
    arrived, in progress or completed.
  - The `clear_urgent` trigger drops it when an appointment leaves the queue
    another way (back to booked, no-show, cancelled), whichever function
    moved it.
  - `mark_urgent(p_appointment_id, p_urgent)`:
    - needs `appointments.edit` while the clinic can write, and takes the
      doctor's queue lock, as Stepped out does;
    - marks only while waiting, and takes it off while waiting or in;
    - hands back when it was marked, and when before, for the audit row.
  - Later migrations move up one: prescriptions is now `0020`, and so on to
    `0030_faster_reads` (plan §29 and the tracker).
- **`POST /api/queue/urgent`** (`urgentSchema`), `markUrgent` in
  `appointments/moves.ts`. Audited as an `UPDATE` of `urgent_at`, from when
  to when, only when it changed.
- **Screens:**
  - The appointment's detail offers **Urgent** to a waiting patient and
    **Not urgent** while they wait or are in.
  - The **Urgent** tag (`UrgentTag`: the coral `StatusPill` with a siren)
    shows:
    - beside the status in the detail;
    - leading the line of a Waiting or With doctor row;
    - under the line in the phone's lake;
    - at the top of the visit, beside its status.
  - A row keeps its place in the list.
- **Kit:** `StatusPill` takes an `icon` in place of its dot; `Lake` takes a
  `tag` under its detail line.

### Speed (plan §37)
- No new read and no index: the queue, the detail and the visit read
  `urgent_at` with the row they already read. Each still waits on one query
  after the session.
- Marking or unmarking waits on two round trips after the session, the move
  and the audit row, as every queue move does.

### Tests
- **Contract:** `tests/db/urgent-migration.test.ts`.
- **Integration** (`visits.test.ts`):
  - the tag is kept through Next patient and Done, and Next patient still
    takes the lower token first;
  - it is audited once per change;
  - it is refused once the patient is in or done, taken off while in, and
    dropped by a no-show;
  - it needs `appointments.edit` and stays within the doctor scope.
- **Permission, isolation and read-only rows** for `mark_urgent`.
- **Unit:** the route, schema, move, reads, actions, hook, detail, rows,
  lake, pill and visit header.
- **E2E** (`queue-moves.spec.ts`, phone and desktop):
  - the desk marks Kiran urgent;
  - the doctor sees the tag, and Next patient still sends Rohan, the lower
    token, in first;
  - the tag shows in With doctor and on Kiran's visit;
  - the desk takes it off.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed: 2586, coverage 100%.
- E2E passed: 116 at phone and desktop, with axe; 8 skipped, each for one
  width only.
- The tag was checked on screenshots at phone and desktop, light and dark:
  - the waiting row and the card;
  - the detail, with Urgent and Not urgent;
  - the lake and the With doctor row;
  - the visit header.

### Blockers
- None.

## 2026-10-13 — R6.2: the visit workspace

The visit screen now records the visit: vitals, complaint, diagnosis and
notes, and follow-up. Each section saves alone. The user's choices are
recorded as D202 – D209:
- fields on the screen, with a Save per section;
- vitals may be taken while the patient waits;
- New visit from a profile;
- follow-up chips for 3 days, 1 week, 2 weeks and 1 month;
- a save made from an older copy is refused;
- Alerts can be changed from the visit;
- after Done, any change needs `visits.edit`;
- two columns on a wider screen.

### Added
- **`0020_visit_records`:**
  - **Vitals before Send in (D203):** `visits.started_at` may be empty, for a
    visit opened by vitals taken while the patient waits. `check_visit`
    dates such a visit by the day it opened. `start_appointment` continues it
    and starts it then.
  - **What counts as recorded:** `visit_is_empty` counts a reading taken, not
    a vitals row whose readings were all cleared. `back_to_waiting` removes
    that emptied row with its empty visit.
  - **`save_vitals(p_visit_id, p_appointment_id, p_vitals, p_seen)`:**
    - saves the readings whole, for a visit, or for a patient waiting or in,
      whose visit opens with the first reading;
    - is refused with `VISIT_CHANGED` when `p_seen` is not what is there
      (D206);
    - needs `visits.create` while the visit is open, and `visits.edit` once
      it is done (D208).
  - **`update_visit(p_visit_id, p_changes, p_seen)`:** saves complaint,
    diagnosis and notes, or the follow-up date, the same way. The follow-up
    must fall after the visit's day. Needs `visits.edit`.
  - **`start_visit(p_patient_id, p_doctor_id)`** (D204): needs
    `visits.create`, the clinic's own patient and an active doctor. It
    reopens the visit already open with that doctor rather than starting a
    second, under the doctor's queue lock.
  - **`finish_visit(p_visit_id)`:** closes a visit with no appointment as To
    bill. A visit from the queue is done there.
  - Each function checks the clinic can write, the doctor scope and an
    archived patient.
  - Later migrations move up one: prescriptions is now `0021`.
- **Routes:**
  - `POST /api/visits` (New visit);
  - `PATCH /api/visits/[id]` (a section, with its copy read);
  - `PUT /api/visits/[id]/vitals`, gated by `visits.view`; the database
    decides create or edit;
  - `POST /api/visits/[id]/done`;
  - `PUT /api/appointments/[id]/vitals` (a waiting patient's vitals).
- **`features/visits`:**
  - `records.ts`: `saveVitals`, `updateVisit`, `startVisit`, `finishVisit`.
    Vitals and clinical text are audited by field name alone, the follow-up
    by its value.
  - `vitals.ts`: column names, conversions, BMI, labels.
  - `api.client.ts`.
  - Hooks: `useVisitSection` (D206: an untouched section follows newer saves;
    while typed into, another's save is held beside it) and `useVisitMoves`.
  - The visit screen's sections: `VitalsSection`, `NotesSection`,
    `FollowUpSection`, `ChangedMeanwhile`, `VitalsFields`, `VitalsReadout`.
  - `NewVisit` on the profile, and `WaitingVitalsSheet` from a waiting
    patient's detail.
- **The visit screen:**
  - **Header:** Alerts in the header (D207).
  - **Lake:** a lake with Done for a visit started from the profile.
  - **Sections:** each with fields for whoever may write it, read-outs for
    whoever may only read (vitals in big numerals).
  - **Layout:** two columns from 768 px (D209); details at the foot.
- **Kit:** `Panel`, a titled section on a surface card.
  - `AlertSheet` and the alerts sheet take `also`, so a change makes the
    visit's read stale too.
- **Words:** `ERROR_MESSAGES.VISIT_CHANGED`, `UI_TEXT.visit` sections,
  `UI_TEXT.vitals`, and `VALIDATION_MESSAGES.number`, `decimals`,
  `bloodPressure` and `afterVisit`.
- **Constants:** `VITAL_SIGNS`, `VITAL_DECIMALS`, `FOLLOW_UP_CHOICES`.

### Found while building
- **Saving snapped back:** after a save, a section briefly showed the copy
  from before the save until the visit was read again. If that read failed,
  the next save was refused as "changed meanwhile". `useVisitSection` now
  also remembers which copy was read when it saved, and ignores it.
- **Use theirs left the old text:** in the built app, a second reset of the
  same form updated the form's state but not the text boxes. React Hook
  Form forgets which fields are on the screen after a reset, and with the
  React Compiler they never register again. The hook now sets each field
  after a reset. The journey caught it; unit tests run without the
  compiler.

### Speed (plan §37)
- **The visit screen** still waits on one query after the session; the
  vitals and the follow-up come in it.
- **Reads that wait for a sheet:** the vitals sheet reads the visit, and the
  visit's Alerts sheet reads the alerts, only once first opened.
- **Saves** (vitals, notes, follow-up, New visit, Done) each wait on two
  round trips after the session: the function, then the audit rows.
- **Indexes:** no new index. New visit's search for an open visit is on the
  patient's visits index, and a waiting patient's visit on the unique
  appointment.

### Tests
- **Contract:** `tests/db/visit-records-migration.test.ts`.
- **Integration** (`visit-records.test.ts`, 13 cases):
  - vitals taken and then changed from the copy read, audited by which
    reading changed, and refused when the copy is older;
  - limits held, blood pressure both or neither;
  - `visits.create` while open, `visits.edit` after Done, an archived
    patient refused, the doctor scope held;
  - an emptied visit removed by Back to waiting;
  - a waiting patient's vitals opening a visit that is not yet started,
    which blocks a no-show and which Send in continues;
  - notes and follow-up saved from the copy read;
  - New visit reopening the open one, its Done, and its refusals.
- **Permission, isolation and read-only rows** for the four functions.
- **Unit:** schemas, server functions, routes, client, hooks, every
  component, and the profile, alerts and appointment changes.
- **E2E** (`visit-records.spec.ts`, phone and desktop, axe):
  - the assistant takes Rohan's vitals while he waits;
  - the doctor sends him in and finds them, with BMI;
  - the doctor writes and saves the complaint and diagnosis, and sets a
    review in a week;
  - the assistant saves the notes meanwhile: the doctor's save is refused,
    theirs is shown, and the doctor takes it;
  - the assistant starts a visit for Sunil from his profile, for Maya, and
    marks it done.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed, coverage 100%.
- E2E passed (phone, desktop), with axe.

### Blockers
- None.

## 2026-10-14 — R6.3: prescriptions

A visit now has its prescription: written by the visit's doctor, or typed
for them by a member with `prescriptions.write`, always in the doctor's
name. The user's choices are recorded as D210 – D217:
- each medicine's fields on the visit screen, one Save for the whole;
- a suggested medicine fills its whole line, as last written;
- an allergy is warned on its line, and Save asks about it;
- nothing is written until the doctor has a registration number;
- frequency and timing are chips, with Other to type a frequency;
- after Done, the same people may change it as before;
- Print the diagnosis is off until ticked;
- the duration is typed in days.

### Added
- **`0021_prescriptions`:**
  - **`prescriptions`:** one per visit, in the visit doctor's name, with
    the advice, `print_diagnosis` (false until ticked, D216) and
    `entered_by`, who typed it as it stands (D45).
  - **`prescription_items`:** the medicines in order — name, strength,
    dose, frequency, timing (`PRESCRIPTION_TIMINGS`), days (1 to 365) and
    instructions — at most 30, each bounded as the screen bounds it.
  - **`save_prescription(p_visit_id, p_prescription, p_seen)`:** the
    whole prescription at once (D210), by the visit's doctor or
    `prescriptions.write`, open or done (D215), within the doctor scope,
    while the clinic can write and the patient is not archived. Refused
    with `PRESCRIPTION_NEEDS_REGISTRATION` while the doctor has no
    registration number (D213), and with `VISIT_CHANGED` when saved from
    an older copy (D206). The medicines are written again only when they
    changed, so each keeps when it was written.
  - **`medicine_suggestions(p_search, p_doctor_id)`:** this clinic's
    medicines beginning with what is typed (taken literally), one for each
    medicine and strength, with the line as this doctor last wrote it, or
    anyone in the clinic (D211). For a doctor, or `prescriptions.write`.
    Only the medicine's line comes back, nothing of whose it was.
  - **What counts as recorded (D197):** a prescription with a medicine or
    advice keeps its visit from Back to waiting; an emptied one goes with
    its empty visit.
  - Read with `visits.view` within the doctor scope; written only through
    `save_prescription`.
- **Routes:** `PUT /api/visits/[id]/prescription` (gated by `visits.view`;
  the database decides who may write) and
  `GET /api/prescriptions/medicines?q=&doctorId=`. The visit's own read
  carries the prescription, the doctor's registration number and who typed
  it, so there is no separate read.
- **`features/prescriptions`:**
  - `records.ts` (`savePrescription`): audited as a create or an update,
    the medicines and advice by name alone, the diagnosis tick by its
    value.
  - `api.ts` (`medicineSuggestions`), `content.ts` (screen and database
    shapes, the line's title and how it is taken), `allergies.ts` (D212),
    `api.client.ts`, and the `useMedicineSuggestions` hook.
  - Components: `PrescriptionSection` (the card), `MedicineLine` (one
    medicine), `PrescriptionReadout`.
- **The visit screen:** the Prescription card under the notes, in the right
  column from 768 px (D209). For whoever writes it: the patient's
  allergies at its top, each medicine a block with Move up, Move down and
  Remove, Add medicine, the advice and Print the diagnosis, and **Save
  prescription** once something is typed. "Typed by …" when an assistant
  typed it. Until the doctor has a registration number, the card says so,
  with **Open Team** for whoever manages the team.
- **Kit:** `SuggestField`, a text field with suggestions under it (an
  editable combobox).
- **Words:** `ERROR_MESSAGES.PRESCRIPTION_NEEDS_REGISTRATION`,
  `UI_TEXT.prescription`, `VALIDATION_MESSAGES.atMostMedicines`.
- **Constants:** `PRESCRIPTION_TIMINGS` and their labels,
  `PRESCRIPTION_FREQUENCIES`, `PRESCRIPTION_DAYS`,
  `PRESCRIPTION_MAX_ITEMS`, and `TEXT_LIMITS` for the medicine, strength,
  dose, frequency, instructions and advice.
- **Validation:** `prescriptionSchema`, `savePrescriptionSchema`,
  `medicineSearchSchema`, and the `optionalWholeNumberText` primitive.

### Changed
- **Prescription templates move to their own migration** with R6.7
  (`0022_prescription_templates`). The tracker's R6.3 row names no
  templates, so `0021` holds only what R6.3 builds. Later migrations move
  up one: treatments is now `0023`, and so on to `0032_faster_reads`.
- **Plan:** §8.2 rule 4 and §13 say when and by whom a prescription is
  written (D213, D215) and how the card works (D210 – D212, D214, D216,
  D217); §12.2, §28.5, §28.7, §29 and §30 follow.

### Speed (plan §37)
- **The visit screen** still waits on one query after the session; the
  prescription and its medicines come in it.
- **Suggestions** are asked for only while a medicine's name is being
  typed, once the typing settles: one round trip after the session, on
  `prescription_items (clinic_id, lower(medicine) text_pattern_ops)`. A
  visit opened with five medicines on it asks nothing.
- **Saving the prescription** waits on two round trips after the session:
  the function, then the audit row.
- **Indexes:** a patient's prescriptions and a doctor's lead with the
  clinic; each person column has its own; the medicines are on their
  prescription's unique (prescription, position) index.

### Found while building
- **Suggestions in a fixed order:** lines saved together share one moment,
  so two suggestions could come in either order. They now come by name
  after the doctor's own and the newest.
- **The highlighted suggestion past a shorter list:** when the list shrank
  under the keys, the field named an option no longer there. The keys now
  rest on the last one.
- **"Typed by" for readers:** the screenshots showed only the doctor saw
  who typed it; the read-out says it too.

### Tests
- **Contract:** `tests/db/prescriptions-migration.test.ts` (17): the
  columns and their bounds against the app's constants, the timing CHECK
  against `PRESCRIPTION_TIMINGS`, the indexes, what counts as recorded,
  who may save and when, the suggestions' order, the policies and grants.
- **Integration** (`prescriptions.test.ts`, 9 cases):
  - written by the doctor, typed over by an assistant from the copy read,
    refused from an older copy, audited by name and the tick by value;
  - the medicines written again only when they changed;
  - the doctor's or a typist's alone, open or done, within the doctor
    scope;
  - refused until the doctor has a registration number, and for an
    archived patient;
  - each line held to its column, and at most 30;
  - a prescription keeps its visit from Back to waiting; an emptied one
    goes with it;
  - suggestions by their beginning, one per strength, the doctor's own
    first, typed text taken literally, and only for a doctor or a typist.
- **Permission, isolation and read-only rows** for both tables, both
  routes and both functions.
- **Unit:** `SuggestField`, the schemas and primitive, the server
  functions, routes, client and hook, `content` and `allergies`, the three
  components, and the visit read and screen.
- **E2E** (`prescriptions.spec.ts`, phone and desktop, axe):
  - the assistant takes Paracetamol from the suggestions and it fills its
    line;
  - Penicillin V is warned against Rohan's allergy; Save asks, Cancel
    saves nothing, Save anyway saves both, moved;
  - the doctor finds it typed for her, in that order;
  - a visit with a doctor who has no registration number says so instead.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (2853), coverage 100%.
- E2E passed (phone, desktop), with axe: 120 passed, 8 run at one width
  only.

### Blockers
- None.

## 2026-10-14 — R6.4: the prescription's PDF

A saved prescription can be printed and downloaded, as a PDF on the
clinic's own letterhead, in A4 or A5 by its paper size. The user's choices
are recorded as D218 – D224:
- the clinic across the top, the doctor under it with the date;
- the medicines as a numbered list;
- black and grey only;
- Print opens the PDF itself in the viewer; Download saves it;
- both once saved, Save in their place while typing;
- the file is "{patient} - {date} - Prescription.pdf";
- English letters now, Indian scripts later.

Sharing it to WhatsApp comes with the share helper in R6.8 (D183).

### Added
- **`src/lib/pdf`** (ported from Brio's bill PDF):
  - `fonts.ts`: Figtree Regular, SemiBold and Bold, read once a process
    from `public/fonts/pdf` (fetched and cut to Latin and ₹ by
    `scripts/pdf-fonts.mjs`, with their licence).
  - `layout.ts`: a composer that lays a document out from the top —
    wrapped text, a lead and its rest on one line, a row with text set
    right, rules, the logo — and marks where a page may end. A line may
    break only between parts (the vitals: "BMI 24.4" stays whole).
  - `letterhead.ts`: the clinic's logo, name, address and phone.
  - `render.ts`: laid out on A5's width, scaled to A4; paged at the marks;
    a running line atop each later page; the signature at the foot of the
    last page (on a page of its own when there is no room); "Generated with
    ClinicDesk" and the page number on every page. Black and grey only.
  - `response.ts`: the PDF answer — inline to open, or attachment to save,
    named, `no-store`.
- **`src/features/documents`:** `prescription.ts` (the prescription in its
  printed words, and its layout), `names.ts` (the file's name), `api.ts`
  (`getPrescriptionPdf`: the visit and the clinic read at once, then the
  logo — a WebP logo turned into PNG by sharp, one that cannot be read
  left out and logged without patient data), the `usePrescriptionDownload`
  hook and `PrescriptionPdf` (Print and Download).
- **Route:** `GET /api/visits/[id]/prescription.pdf` (`visits.view`, the
  doctor scope, a view-only clinic too); `?download=1` to save it. Refused
  with `PRESCRIPTION_EMPTY` while it has no medicine, and
  `PRESCRIPTION_NEEDS_REGISTRATION` should the doctor's number be gone.
- **The Prescription card:** Print and Download at its foot once saved
  with a medicine on it, for whoever reads the visit; while typing, Save
  in their place.
- **Clinic:** `getClinicForDocuments` (the profile and where the logo is,
  in one query) and `downloadLogo`, which `readLogo` now uses too.
- **Kit:** `LinkButton` takes `file`: a plain anchor the router never
  fetches ahead. `lib/download.ts` gains `saveFile`; `saveCsv` uses it.
- **Words:** `UI_TEXT.documents`, the print and download words in
  `UI_TEXT.prescription`, `ERROR_MESSAGES.PRESCRIPTION_EMPTY` and
  `PRESCRIPTION_PDF_FAILED`.
- **Dependencies:** `pdfkit` 0.17.2 (as Brio) with its types, and `sharp`
  0.35.5 for the WebP logo — pinned above 0.35.4, which Next brings and
  `npm audit` flags (a librsvg advisory).
- **Config:** `next.config.ts` traces `public/fonts/pdf` into every
  `/api/**/*.pdf` route.

### Changed
- **Plan:** §13 and §33 say how the PDF looks and opens (D218 – D224):
  there is no preview sheet, the viewer is the preview (D221). §30 names
  `?download=1`; §42 keeps Indian scripts in the PDFs for later (D224).

### Speed (plan §37)
- **The PDF** waits on two round trips after the session: the visit (with
  its patient, doctor, vitals and prescription in one query) and the
  clinic at once, then the logo when there is one.
- **The visit screen** waits on nothing more: Print is a link, and
  Download asks only when pressed.
- **Indexes:** no new query shape: the visit by its id, the clinic by its
  id.

### Found while building
- **The vitals' line broke inside a reading** ("BMI" at a line's end,
  "24.4" on the next). It now breaks only between readings.
- **A loose second page said nothing of whose it was.** Each later page
  now starts with the patient, their details and the date.
- **The PDF's new tab is opened by a plain link:** the router would
  otherwise fetch the PDF ahead, as it does an app screen.

### Tests
- **Integration** (`prescription-pdf.test.ts`, 7 cases): the PDF itself,
  inline or as an attachment under its name, `no-store`, in the app's
  fonts; A5 and A4 by the clinic's paper size; for a reader; refused
  outside the doctor scope and for another clinic; `PRESCRIPTION_EMPTY`
  with no prescription or no medicine; `PRESCRIPTION_NEEDS_REGISTRATION`;
  a WebP logo drawn, and a missing one left out; a view-only clinic's
  reader still gets it. **Permission** and **isolation** rows for the
  route.
- **Unit:** the fonts, the composer and its wrapping, the letterhead, the
  renderer (real PDFs: paper, scale, pages, the running line, the
  signature's page, the logo), the response, the prescription's words and
  layout, the read and its refusals, the logo's paths, the download hook,
  the buttons, the route, and the card's foot.
- **E2E** (`prescription-pdf.spec.ts`, phone and desktop, axe): a reader
  opens Rohan's prescription with Print — a new tab asking for the inline
  A5 PDF — and downloads it under its name; the doctor typing a change
  sees Save until it is saved.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (2934), coverage 100%.
- E2E passed (phone, desktop), with axe: 121 passed, 9 skipped — 8 run at
  one width only, and the front-desk journey skipped itself once as the
  clinic's day closed at midnight; run again after, it passed at both
  widths.

### Blockers
- None.

## 2026-10-15 — R6.5: a patient's history with visits, and their last visit

### Added
- **The history is one list** (`features/patients/timeline.ts`, D225): a
  patient's visits and the appointments that have none — still to come,
  cancelled, missed — newest first, 20 at a time. An appointment that became
  a visit shows once, as the visit. Visits need `visits.view`, appointments
  `appointments.view`; someone who sees no visits sees every appointment,
  as before. A page reads a page of each at once (`listPatientVisits`,
  `listPatientAppointments`) and merges them, each part's own order kept;
  its cursor counts how many of each are shown ("12.8",
  `timelineQuerySchema`).
- **A visit's row** (`PatientHistory`, D226, D227): "14 Oct 2026 · Visit",
  the doctor and the diagnosis — or the complaint — then "Rx Paracetamol,
  Amoxicillin +1" on a line under it, and Open or Done; "Nothing recorded"
  for a visit holding nothing at all. It opens the visit's screen.
- **The visit's back arrow leads back to the profile** it was opened from —
  its history or New visit — through `?from=patient` (`VISIT_FROM`, D230);
  from the queue it still goes to the queue.
- **The patients list's last visit** (D228, D229): "Last visit: 28 Sep" —
  "today", or with the year when not this one (`formatNearDate`,
  `lastVisitLine`) — on a line of its own under each row, for everyone who
  sees the patient; nothing for one never seen.
- **Migration `0022_patient_timeline`:** the visits' index in the history's
  order; `visit_recorded(visit)`, a computed field read as the member,
  which `visit_is_empty` (Back to waiting) now denies, so the two never
  disagree; `last_visit_on(patient)`, a computed field read with the list,
  past the visits' policy but only for a patient the caller may see.
- **Kit:** `Row` takes a `note`, one more line under the first, cut short
  alike.
- **Words:** the history's visit words and the list's last visit in
  `UI_TEXT.patients`; `ERROR_MESSAGES.HISTORY_LOAD_FAILED`;
  `HISTORY_MEDICINES_NAMED` (2) in `limits.ts`.

### Changed
- **The profile is two columns on a desktop** (D231, D114): the next
  appointment and the details on the left, the history on the right (from
  1024 px); a phone stacks them.
- **Plan:** D225 – D231; §10.2, §10.3, §12.2, §28.7, §29 and §30. The
  later migrations move up one: `0023_prescription_templates` (R6.7)
  through `0033_faster_reads` (R13.3), with their tracker rows.
  `patient_stats` (R8.4) no longer carries the last visit.
- **The last visit is worked out with the list, not stored on the
  patient** (D228). Asked, the option said the day would be kept on the
  patient's record. Stored there, every visit would have changed the
  patient's "updated" stamp and who updated them, and the archived
  patient's read-only rule would have refused the change. A computed field
  gives the same: everyone who sees the patient sees the day, and the list
  waits on no more round trips.

### Speed (plan §37)
- **The profile** waits on two round trips, as before: the session, then
  its first reads at once — the history's visits and appointments among
  them.
- **The patients list** waits on two, as before: `last_visit_on` is one
  index lookup a row inside the list's own query.
- **Indexes:** the history's visits on (clinic_id, patient_id, created_at
  desc, id desc), new; its appointments on (clinic_id, patient_id,
  scheduled_at desc), with their visit found by the visit's unique
  appointment; the last visit on (clinic_id, patient_id, visit_date desc).

### Tests
- **DB contract** (`patient-timeline-migration.test.ts`): the index, the
  two computed fields — who runs them and what they read — and
  `visit_is_empty` denying `visit_recorded`.
- **Integration** (`patient-timeline.test.ts`, 9 cases): Rohan's history
  in order, the walk-in standing as its visit; what each visit found, its
  medicines in order, and "nothing recorded"; visits alone for a nurse,
  every appointment for the desk, nothing for a reader or another doctor
  (D3); 25 entries paged across both parts without a gap or a repeat; the
  last visit for a reader with no `visits.view`, none for one never seen,
  and never told for a patient the caller may not see, whatever row is
  sent.
- **Unit:** the merge and its cursor, the visits' and appointments' reads,
  the cursor schema, the route, the history's rows, the profile's columns,
  the list's last visit, the row's note, the visit's back arrow, New
  visit's address, and the date helper.
- **E2E** (`patient-history.spec.ts`, phone and desktop, axe): the list
  says "Last visit: today"; the profile's history lists the booked
  appointment, the visit with its diagnosis and medicines, and the
  cancelled one; the history sits beside the details on a desktop and under
  them on a phone; the visit opens from it and its back arrow returns.
- **E2E** also: `visit-records.spec.ts` now expects New visit to open the
  visit at `?from=patient`, its back arrow to the profile.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (2976), coverage 100%.
- E2E passed (phone, desktop), with axe: 124 passed, 8 skipped (run at one
  width only). New visit's old address check failed at both widths on the
  first run; updated, it passed at both.

### Blockers
- None.

## 2026-10-15 — R6.6: the visit under races, and the journey to the prescription

### Added
- **Races** (`tests/db/integration/visit-races.test.ts`, 10 cases, D232),
  each request its own transaction through PostgREST, sent at once:
  - the desk and the doctor press Next patient together — with the room
    free, and after the patient in: one patient goes in, the lowest token,
    both told who; the one after still waits; the patient in closed once;
  - Send in, Done and New visit pressed twice at once: one visit, closed
    once as To bill, one move audited;
  - the doctor and the assistant save from the same copy at once — the
    vitals, a waiting patient's vitals (one visit opened), the notes, the
    prescription: one kept whole, the other `VISIT_CHANGED`;
  - the prescription saved as the desk marks the patient done: both stand.
- **The journey continues** (`front-desk-journey.spec.ts`, D233 – D235):
  the owner sets A5 and invites an assistant too, and the doctor with a
  registration number; the desk sends the walk-in in and marks him done
  with nothing recorded (To bill); the doctor's Next patient sends the
  booked patient in; the assistant, on her own device, takes vitals and adds
  a penicillin allergy, and both show on the doctor's open visit within its
  refresh; the doctor writes the diagnosis; the assistant types the
  prescription, warned at the "Penicillin V" line and again at Save, takes
  it off and saves; the doctor prints it — A5, "Anita Rao - {day} -
  Prescription.pdf", its title naming her, a tab of its own, and a
  download — sets a review in a week, and Next patient, with no one
  waiting, closes the visit and opens the queue. The second clinic is
  refused her visit and its PDF.
- **`inviteMember`** (`tests/support/e2e.ts`) takes a preset to start from
  and a doctor's registration number.

### Changed
- **Plan:** D232 – D235; R6.6 done.

### Found while building
- Nothing in the app. Two of the race test's own mistakes were fixed: the
  doctor pressing New visit for a patient who was not theirs (refused, as
  D3 says), and a prescription read as one row where PostgREST gives a list.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (2986), coverage 100%. The race test
  passed four runs in a row.
- E2E passed (phone, desktop), with axe: 124 passed, 8 skipped (run at one
  width only). A first full run went four times slower than usual, the
  machine under load: the journey missed the doctor's refresh, and three
  older specs timed out. The journey now waits two refreshes for what
  another device saved (`QUEUE_REFRESH_MS` × 2); the four reran green at
  both widths, and a second full run passed in 7 minutes.

### Blockers
- None.

## 2026-10-15 — R6.7: Repeat last prescription, and prescription templates

### Added
- **Migration `0023_prescription_templates.sql`** (plan §13; D54, D236 –
  D243):
  - `prescription_templates` (a doctor's own: name, advice, active, who made
    and changed it) and `prescription_template_items` (the same columns as a
    prescription's medicines, in order), each hanging from the clinic, with
    RLS: read by the doctor and by `prescriptions.write`; archived and
    restored by the doctor alone (`active` only), while the clinic can
    write. One active name for each doctor (a partial unique index).
  - `save_prescription_template(id, template, replace)`: the caller's own,
    as a doctor, new or changed, whole; it holds a medicine or advice; a new
    one under a name in use replaces that one only when `replace` says it
    was asked; a rename into a name in use is refused
    (`TEMPLATE_NAME_TAKEN`), and so is the same name made twice at once.
  - `previous_prescription(visit)`: a computed field, run as the member —
    the patient's latest prescription with a medicine, from the visits
    before this one, by any doctor, with its day and doctor's name — on
    0022's index of a patient's visits, in its order.
- **Repeat** (D236 – D239): the visit's read carries the prescription
  before; the Prescription card's **Repeat 12 Oct · Dr. Maya Rao** adds its
  medicines after those typed and its advice on a new line (or fills an
  empty box), and says so; not past 30 medicines. Hidden when there is none.
- **Templates** on the visit (D240, D241): **Templates** opens a sheet of
  the visit doctor's templates in use, each with its medicines, one tap
  adding it the same way; whoever types for the doctor sees "Maya Rao’s
  templates". **Save as template** beside Add medicine, for the visit's
  doctor once there is a medicine, checks the lines, then names what is on
  the screen; a name in use asks "Replace your template …?" (D243).
- **My account → Prescription templates** (D242), for a doctor:
  `/settings/account/templates` lists them, **New template**, archived ones
  with **Restore**; each opens `/settings/account/templates/[id]` (or
  `/new`) to change its name, medicines (the prescription's own lines, with
  the doctor's suggestions) and advice, and **Archive**, asked first.
- **API:** `GET /api/prescription-templates?doctorId=`, `POST
  /api/prescription-templates`, `PATCH /api/prescription-templates/[id]`
  (`features/prescriptions/templates.ts`, audited: the name by value, the
  medicines and advice by name).
- **Words:** `TEMPLATE_NAME_TAKEN`, `TEMPLATES_LOAD_FAILED`, the template
  validation messages, `UI_TEXT.prescription`'s Repeat and template words,
  and `UI_TEXT.templates`.

### Changed
- `MedicineLine` serves any form of medicines — a prescription's or a
  template's.
- `CatalogueScreen` takes where its back arrow leads (Settings unless said).
- **Plan:** D236 – D243; §5.4, §13, §28.5, §28.7, §29, §30, §31.2 (the screens, and
  a template as a screen); `GET /api/patients/[id]/last-prescription` is no
  longer planned, the visit's read carrying it; "prescription templates"
  taken off §42's Later list, now built; R6.7 done.
- `DESIGN.md`: Repeat and templates on the prescription, the Save as
  template sheet, My account's Prescriptions row, the templates list and a
  template's screen.

### Speed (plan §37)
- The visit screen still waits on one query after the session: Repeat's
  prescription is a computed field of it.
- The Templates sheet waits on one read, made once it is opened; the
  templates list and a template's screen on the session and one read.
- Saving a template: the function and the audit row (a name in use, asked
  and replaced: the refusal, then those two). Archiving or restoring: the
  template, the change, the audit row.
- Every new read is on an index led by the clinic: a doctor's templates
  `(clinic_id, doctor_id)`; the name `(clinic_id, doctor_id, lower(name))
  where active`; the template lines' clinic `(clinic_id, template_id)`;
  Repeat on `visits (clinic_id, patient_id, created_at desc, id desc)`
  (checked with EXPLAIN).

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3083), coverage 100%. One run failed
  `appointment-detail.test.ts`'s check that the booked time is not after the
  test's own clock: the database's clock, in Docker, ran 46 ms ahead. It
  passed three runs alone and the next full run; not this change's.
- E2E passed (phone, desktop), with axe: 126 passed, 8 skipped (run at one
  width only). The journey now saves the prescription as a template and, at
  the follow-up, Repeats it; `prescription-templates.spec.ts` is new.

### Found while building
- The template screen's medicine blocks, on the page's own ground, showed
  no edges; they now sit in a Prescription card, as on a visit.

### Blockers
- None.

## 2026-10-15 — R6.8: send the prescription on WhatsApp

### Added
- **The share helper** (`src/lib/share.ts`, plan §22.1, D183): whether this
  device hands a file over through its share sheet (touch-first, sharing
  files), the share sheet with a file and a message, whether a refusal only
  wants a fresh tap, and the patient's chat opened on WhatsApp Web with the
  message. The prescription is the first sent; a bill follows in Phase 8.
- **WhatsApp** on the Prescription card's foot, beside Print and Download
  (D244): for whoever reads the visit, a view-only clinic too, and not while
  there are unsaved changes. "Your prescription from Dr. Maya Rao, Smile
  Care, 15 Oct." (`WHATSAPP_TEXT.prescription`), with the PDF:
  - on a phone, the share sheet takes both and the person picks WhatsApp and
    the chat; "Prescription shared" follows. Should the phone want a fresh
    tap once the PDF is fetched, a card offers **Send** (D245);
  - on a desktop, the patient's chat opens in a new tab with the message
    typed, as the tap lands (so no browser takes it for a pop-up), and the
    PDF downloads; a card names the file to attach (D246).
  - Nothing is recorded (D247).
- `SHARE_FAILED`, for a share sheet that refuses the file.

### Changed
- The visit's read carries the patient's mobile, where the prescription is
  sent.
- **Plan:** D244 – D247; §13 and §22.1 say how it is sent; R6.8 done.
- `DESIGN.md`: WhatsApp on the Prescription card and its cards.

### Speed (plan §37)
- The visit screen still waits on one query after the session (the mobile is
  a column of the patient it already reads). Sending waits on the PDF alone,
  as Download does; nothing is written.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3096), coverage 100%.
- E2E passed (phone, desktop), with axe: 128 passed, 8 skipped (run at one
  width only). `prescription-pdf.spec.ts` sends it both ways: a touch-first
  phone (the share sheet recorded on the page, as a test cannot pick
  WhatsApp) is handed the PDF under its name and the message; a desktop
  opens the patient's chat with the message and downloads the A5 PDF.

### Blockers
- None.

## 2026-10-15 — R7.1: treatments in the database

Phase 7 starts with treatments in the database. `0024_treatments` adds the
treatment, its sessions, the status moves and the functions the visit screen
and the profile will call (R7.2). Asked of the user first: D248 – D255.

### Added
- `supabase/migrations/0024_treatments.sql`:
  - `treatments`: a course of care across visits — the patient, the doctor,
    a name, a description, an estimated cost (information only, D253), the
    days it started, was completed and is next due, and, when cancelled, when,
    by whom and why (D250). Never deleted: completed or cancelled.
    - It starts planned, or in progress at once. Started in a visit, it is
      that visit's doctor's and names the visit; begun at once, that visit is
      its first session. From the profile, a doctor is picked (D252).
    - `check_treatment`: whose it is and where it began never change; it is
      started on the day it goes in progress; completing and cancelling are
      stamped; a next due day is today or later; its doctor is active.
      Closed, it has no next due day and keeps its doctor (D252).
  - **Statuses:** `treatment_status_next()`, kept equal to
    `TREATMENT_STATUS_TRANSITIONS` by tests/db.
  - `treatment_sessions`: one per treatment and visit, with a note.
  - **Functions,** each checking `visits.edit`, the doctor scope, an archived
    patient and that the clinic can write, and handing back what it changed
    for the audit row:
    - `create_treatment`;
    - `update_treatment`: name, description, cost, next due day and doctor,
      from the copy read (`TREATMENT_CHANGED`, D251);
    - `change_treatment_status`: as the table allows, from the status read;
      a reason only with a cancellation (D250); a double tap changes nothing
      more;
    - `record_treatment_session`: from any of the patient's visits (D249);
      the first on a planned or on-hold treatment puts it in progress on the
      visit's day (D248); none on a closed one (`TREATMENT_CLOSED`); its note
      changed from the copy read (`VISIT_CHANGED`);
    - `remove_treatment_session`: only while its visit is open
      (`TREATMENT_SESSION_KEPT`, D254).
  - **The doctor scope grows** (plan §27.3): a treatment's doctor sees its
    patient, and handing it to another adds them.
  - **Read** with `visits.view` within the doctor scope, the cost included
    (D253); sessions where their treatment is read. Neither table is written
    but through the functions.
  - **What a visit holds** (`visit_recorded`): a treatment started in it, or
    a session, counts; Back to waiting keeps such a visit (D197), and its row
    in the history no longer says "Nothing recorded" (D226).
  - **Archiving:** a patient with an open treatment is refused
    (`PATIENT_HAS_TREATMENTS`, D255).
- **Constants:** `TREATMENT_STATUSES` with labels and tones,
  `OPEN_TREATMENT_STATUSES`, `TREATMENT_START_STATUSES`,
  `TREATMENT_STATUS_TRANSITIONS`; `TEXT_LIMITS` for a treatment's name and
  description and a session's note; the treatment error codes, mapped as
  business rules (`TREATMENT_CHANGED` as a conflict).

### Changed
- **Archiving a patient** refused for an open treatment titles its card with
  it: "Rohan Mehta has an open treatment: Root canal" — for whoever reads
  treatments; anyone else reads "Rohan Mehta has an open treatment" (D255,
  `usePatientArchive`).
- **Plan:**
  - D248 – D255 in the decision log;
  - §10.1 (archive), §14.1 (starting, sessions, changing, who);
  - §28.5 (the cancellation's columns, a session's `updated_by`), §28.7 (the
    functions), §29 (0024);
  - the tracker: R7.1 DONE.

### Speed (§37.1)
- **Round trips:** each function is one call; the screens and their
  read-backs come with R7.2. The archive check runs inside the archive's own
  update, so it adds no round trip.
- **Indexes,** each leading with `clinic_id` in the read's own order, checked
  with EXPLAIN:
  - a patient's treatments, newest first, and the archive check
    `(clinic_id, patient_id, created_at desc)`; a doctor's
    `(clinic_id, doctor_id)`;
  - the visit one was started in `(clinic_id, started_visit_id)` (partial),
    and a visit's sessions `(clinic_id, visit_id)`, which `visit_recorded`
    asks;
  - a treatment's sessions in order `(clinic_id, treatment_id, created_at)`;
  - `created_by`, `updated_by` and `cancelled_by`.

### Validation
- Typecheck, lint, format check passed.
- `tests/db/treatments-migration.test.ts` keeps the statuses, bounds,
  transitions, open statuses, indexes, functions and policies equal to the
  app's. `tests/db/integration/treatments.test.ts` (13) proves each rule
  against the local database; tenant isolation, the permission matrix and
  read-only have their treatment rows.
- Unit and integration tests passed (3145), coverage 100%.
- E2E passed (phone, desktop), with axe: 128 passed, 8 skipped (run at one
  width only). `patients.spec.ts`'s archive now meets an open treatment
  first: the receptionist is told there is one, unnamed, and archives once
  it is cancelled.

### Blockers
- None.

## 2026-10-15 — R7.2: treatments on the visit and the profile

Treatments reach the screens. A visit has a Treatments card between the
notes and the prescription; the patient's profile lists their treatments;
each opens one sheet that tells its whole story; a visit's row in the
history names its treatments. Asked of the user first: D256 – D263.

### Added
- `supabase/migrations/0025_treatment_screens.sql`:
  - `record_treatment_session` takes `p_complete` (D257): the last sitting's
    note and **This completes it** are one save — the session and the
    completion together, or neither. It hands back the treatment's status
    before and after.
  - `remove_treatment_session` names the session by its treatment and visit,
    as the screen does (D254).
  - `visit_treatments(visit)`: the patient's open treatments and any started
    or worked on in the visit — a computed relationship read with the visit
    in its one query, as the member (D256).
- **The visit's Treatments card** (`TreatmentsSection`, D256, D263): rows
  for those treatments — name, doctor, when next due, estimate, status, and
  what this visit did ("This visit: Canal cleaned", "Started this visit").
  **Add treatment** for `visits.edit`.
- **A treatment's sheet** (`TreatmentSheet`, `TreatmentPanel`, D250, D257,
  D259, D261): its details; on a visit, **This visit** — the note, **This
  completes it** while open, **Save session**, and **Remove from this
  visit** while the visit is open; **Next sitting** with chips from today;
  its sessions visit by visit, each opening its visit; **Start**,
  **Resume**, **Complete** (asks first), **Put on hold**, **Edit** and
  **Cancel treatment** (an optional reason, then a danger card). It opens
  at its top, so a phone's keyboard stays down.
- **New and edited treatments** (`NewTreatmentSheet`, `EditTreatmentSheet`,
  `CancelTreatmentSheet`, D252, D258): the name suggests the price list's
  active procedures and fills the estimate from one; **Start today** on a
  visit (with what was done), **Plan it** on the profile, for the caller if
  a doctor, else the patient's own; the next sitting's chips. Edit hands an
  open treatment to another doctor.
- **The profile's Treatments** (`PatientTreatments`, D260): the open ones,
  then **Show closed (n)**, the latest closed first; **Add treatment**.
- **The history** names a visit's treatments under the Rx line: "Tx Root
  canal, Crown +1" (D262).
- **Routes** (`visits.edit`): `POST /api/treatments`, `PATCH
  /api/treatments/[id]` (details or next sitting, from the copy read),
  `POST /api/treatments/[id]/status`, `PUT, DELETE
  /api/treatments/[id]/sessions/[visitId]`. The reads come with the visit
  and the patient's summary, so there is no `GET`.
- **Code:** `features/treatments` — `api.ts` (`TREATMENT_COLUMNS`,
  `toTreatment`, `listPatientTreatments`), `records.ts` (each write and its
  audit rows: statuses, estimate, days and doctor by value; name,
  description, notes and reason by name alone), `describe.ts` (due labels,
  order, moves), `keys.ts`, `api.client.ts`, five hooks and seven
  components; schemas in `schemas/treatments.ts`; the treatment words,
  `TREATMENTS_LOAD_FAILED` and `HISTORY_TREATMENTS_NAMED`.

### Changed
- `Row` takes several notes, a line each — a visit's medicines, then its
  treatments.
- The visit's read carries its treatments; the patient's summary carries
  theirs with `visits.view`, read beside the next appointment; the
  history's visits name theirs.
- **Plan:**
  - D256 – D263;
  - §10.3 (the profile's treatments), §12.2 (R7.2 on the visit), §14.1;
  - §28.7 (the functions), §29 (0025 added; the later migrations move up
    by one, 0026_follow_ups to 0034_faster_reads, in the tracker too), §30
    (the routes, the summary);
  - the tracker: R7.2 DONE.
- `DESIGN.md`: the Treatments card and profile section, a treatment's
  sheet, its new, edit and cancel sheets, the history's Tx line, the
  profile's columns.

### Speed (plan §37)
- **The visit screen** still waits on one query after the session:
  `visit_treatments` is embedded in it, each treatment with its doctor and
  its sessions.
- **The profile's treatments** come with its summary, read at once beside
  the next appointment: still one round after the session.
- **The history** reads a visit's treatments in its own query, through the
  sessions' and the started visit's foreign keys.
- **Each save** waits on two round trips after the session: the function,
  the audit rows. A session that completes its treatment is still one call.
- **Indexes:** 0024's serve every new read — a patient's treatments
  `(clinic_id, patient_id, created_at desc)`, a visit's sessions `(clinic_id,
  visit_id)`, the visit one was started in `(clinic_id, started_visit_id)`,
  a treatment's sessions `(clinic_id, treatment_id, created_at)`.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3264), coverage 100%:
  `tests/db/treatment-screens-migration.test.ts`;
  `tests/db/integration/treatment-records.test.ts` (5) through the feature
  functions — the visit's card, the summary in the doctor scope, the last
  session completing in one save or neither, changes from the copy read,
  audit rows by name for clinical text; R7.1's tests moved to 0025's
  function signatures; route rows in the permission matrix.
- E2E: `treatments.spec.ts` at phone and desktop width, with axe — a
  doctor begins a root canal from the price list, sets the next sitting,
  completes it at the next visit in one save, and finds it under Show
  closed with both sessions and in the history; a nurse plans a crown from
  the profile, hands it to another doctor, holds it and cancels it with a
  reason; a reader sees it and can change nothing. The whole suite: 132
  passed, 8 skipped (run at one width only).

### Found while building
- A suggestion list (or a select's, a date picker's) opened while its sheet
  was still rising was placed where its field was mid-rise — once, on a
  phone, below the screen, where it could not be tapped. The kit's
  `useAnchoredPopover` now sets it against its field again when an
  animation or transition around it ends.
- `patient-history.spec.ts` measured the history against the details; with
  the treatments above the details it now measures against the top of
  their column, the next appointment, as D231 means.

### Blockers
- None.

## 2026-10-15 — Next.js 16.3.8

### Changed
- `next` and `eslint-config-next` from 16.3.5 to 16.3.8 (D264), which fixes
  the four critical advisories against 16.3.5: remote code execution in
  `next/og`'s ImageResponse (the app does not use it), cache poisoning of
  self-hosted pages (the app is on Vercel), a draft-mode leak, and the dev
  server's MCP endpoint. Same minor line; no code changed.
- `source-map-js` (high; used at build time only) to 1.2.2, by
  `npm audit fix`.
- **Plan:** D264.

### Validation
- Typecheck, lint, format check passed; the build passed on 16.3.8.
- Unit and integration tests passed (3264), coverage 100%.
- E2E passed (phone, desktop), with axe: 132 passed, 8 skipped (run at one
  width only).

### Blockers
- None. `npm audit` still reports one chain of five "high" findings inside
  the lint tooling (`eslint-config-next` → `@next/eslint-plugin-next` →
  `fast-glob` → `micromatch` → `braces`: deeply nested patterns can exhaust
  the stack). It runs only on the developer's machine and in CI, never in
  the app, and npm's only fix is downgrading `eslint-config-next` to 14.
  R13.8's audit (`npm audit --omit=dev`) leaves development tools out; it is
  updated once `eslint-config-next` ships a fix.

## 2026-10-15 — A database time checked with room for clock drift

### Changed
- `tests/db/integration/appointment-detail.test.ts`: the booked time is
  checked against the test's clock with 2 seconds' room (D265). The database
  runs in Docker, whose clock once ran 46 ms ahead of the Mac's and failed
  the check; it still proves the booking was made just now.
- **Plan:** D265.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3264), coverage 100%.

### Blockers
- None.

## 2026-10-15 — The vital-sign limits kept

### Changed
- **Plan:** D266 — the vital-sign limits set in R6.1 stay as they are: a
  newborn's readings to an adult's, catching a slip without refusing a real
  reading. They remain constants, as limits that protect their columns do.
  No code changed.

### Blockers
- None.

## 2026-10-15 — R7.3: follow-ups in the database

Follow-ups reach the database: which are due, in which tab, what closes
them, and the calls made about them. The screen comes with R7.4. Asked of
the user first: D267 – D271.

### Added
- `supabase/migrations/0026_follow_ups.sql`:
  - **What a follow-up is** (§14.2): an open treatment's next due day — on
    hold too, when it has one (D269) — or a visit's follow-up day, for a
    patient not archived.
  - **What closes it** (D268): an appointment for a later day than the one
    it was set on, with any doctor, still to come or kept (not cancelled,
    missed, or left unmarked on a past day — a cancelling reopens it); a
    visit opened after it was set; or, for a treatment, its closing or
    losing its day. `treatments.next_due_set_at`, stamped whenever the day
    is given or changed, says when a treatment's was set.
  - `follow_up_contacts`: a call or message about one follow-up — its
    outcome, a note, and a "remind me on" day — never changed; the latest is
    the row's last contact.
  - `follow_up_items(tab)` and `follow_up_counts()`: Today, Overdue (up to
    `follow_up_lapsed_days`), Upcoming (the next 30 days), Lapsed, and
    Completed (treatments completed in the last 30), in the clinic's
    timezone; one snoozed till a later day is left out of both (D271). Each
    row: the patient, what is due (a treatment's name, or a visit's
    follow-up), its doctor and day, and the last contact — nothing more of
    the record.
  - `record_follow_up_contact`: by `appointments.edit` or `visits.edit`,
    while the clinic can write, for a patient seen and not archived; a
    reminder day after today.
  - **Who** (D267): anyone who sees appointments or visits lists them — the
    front desk makes the calls — a doctor only their own patients'.
- **Constants:** `FOLLOW_UP_TABS` and `FOLLOW_UP_OUTCOMES` with their words,
  `FOLLOW_UP_KINDS`, `FOLLOW_UP_WINDOW_DAYS` (30, D270),
  `TEXT_LIMITS.contactNote`.

### Changed
- The permission editor's words: seeing appointments includes the
  follow-ups to call, and changing appointments or writing clinical notes
  includes noting a call (D267).
- **Plan:**
  - D267 – D271;
  - §8.1 (the permissions' words), §14.2 (what closes one), §14.3 (who,
    the window, the snooze), §17 (Home's follow-ups, for the same people);
  - §28.5 (`next_due_set_at`, the contacts), §28.7 (the functions), §29
    (0026), §31.2 (`/follow-ups` for appointments or visits seen);
  - the tracker: R7.3 DONE.
- The Follow-ups link in the menu still asks for `visits.view`; it follows
  the plan with the screen, in R7.4.

### Speed (plan §37)
- **Round trips:** each function is one call; the screen's reads come with
  R7.4.
- **Indexes,** each led by the clinic: a treatment's next due day
  `(clinic_id, next_due_on)` and a visit's follow-up `(clinic_id,
  follow_up_on)`, each only where there is one; completed treatments
  `(clinic_id, completed_on desc)`; a follow-up's last contact `(clinic_id,
  treatment_id | visit_id, contacted_at desc)`; a patient's contacts.
  What closes one is asked of `appointments (clinic_id, patient_id,
  scheduled_at desc)` and `visits (clinic_id, patient_id, created_at desc)`.
  On the local tables the planner sometimes takes another clinic-led index;
  R13.3's load seed checks them at volume.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3286), coverage 100%; E2E passed
  (phone, desktop), with axe: 132 passed, 8 skipped (run at one width only).
- `tests/db/follow-ups-migration.test.ts` keeps the tabs, outcomes, open
  statuses, window, note length and indexes equal to the app's.
  `tests/db/integration/follow-ups.test.ts` (8): each tab by the clinic's
  today and the lapsed days; on hold with a date; an archived patient's
  gone; closed by a later appointment with any doctor and reopened by its
  cancelling, not by one left unmarked; closed by a later visit but not the
  one that set it; a contact noted, and a snoozed one out of the lists and
  counts until its day; who lists them and who notes a call. Tenant
  isolation, read-only and the permission matrix have their rows.

### Blockers
- None.

## 2026-10-16 — R7.4 and R7.6: the follow-ups screen, with reminders on WhatsApp

### Added
- **`/follow-ups`** (plan §14.3; D267 – D278), for whoever sees appointments
  or visits, a doctor their own patients only: Today, Overdue, Upcoming,
  Lapsed and Completed, each with how many it holds, a page at a time
  (`src/features/treatments`: `FollowUps`, `FollowUpSheet`, `FollowUpPanel`
  and their hooks).
  - **A row** (D272): the patient, "Root canal · Maya Rao" (or "Follow-up"
    for a visit's), when it is due, the last contact, and a round **Call**
    at its end. The row opens its sheet.
  - **The sheet** (D272, D275): what it is for, its doctor and day, and the
    last contact — how it went, when, by whom, its note. **Call**, **Remind
    on WhatsApp**, **Book**, **Open profile**, and **Mark contacted**.
  - **Remind on WhatsApp** (D273, R7.6): the message written — "Dr. Maya Rao
    at Smile Care asked to see you again around 14 Oct. Reply or call 0484
    234 5678 to book." — and noted as *Reminder sent* as it opens, by whoever
    notes contacts; in a view-only clinic, or for one who only reads, it
    opens unnoted.
  - **Mark contacted** (D271, D274): how it went (required), a note, and a
    day to be reminded on — chips for tomorrow, 3 days, 1 week, 2 weeks, or
    any later day — that takes it off the lists and counts until then. For
    `appointments.edit` or `visits.edit`, while the clinic can write.
  - **Book** (D276): the booking sheet in the sheet's place, filled with the
    patient, the follow-up's doctor and its day (today for one overdue);
    booked, everything closes and the follow-up leaves its list.
  - **Completed** (D277): Call and the profile only.
  - One list on a phone and a desktop alike, no doctor filter (D278).
- **API:** `GET /api/follow-ups?tab=`, `GET /api/follow-ups/counts` (for
  `appointments.view` or `visits.view`), `POST /api/follow-ups/contacts`
  (for `appointments.edit` or `visits.edit`, audited: the outcome and day by
  value, the note by name alone).
- **`0027_follow_up_callers`** (D275): `follow_up_rows` and
  `follow_up_items` hand back who made the last contact
  (`last_contacted_by`); nothing else changes.
- `FOLLOW_UP_ACCESS` and an any-of form of `RouteAccess`, so a route, a
  screen and a menu place can serve "appointments or visits" (D267).
- `REMIND_ME_CHOICES`, the screen's words, `WHATSAPP_TEXT.followUpReminder`,
  `FOLLOW_UPS_LOAD_FAILED`, `VALIDATION_MESSAGES.afterToday`; the
  `followUps` schemas; `optionalDay`, shared with the treatment schemas.

### Changed
- The **Follow-ups** menu place opens for appointments or visits seen, not
  `visits.view` alone (D267) — the front desk now sees it.
- `IconLink` takes `newTab`, off for a call the phone takes in place.
- The booking sheet takes `onBooked`, and a booking refreshes the
  follow-ups (a later appointment closes one, D268).
- **Plan:** D272 – D278; §14.3 (the row, the sheet, Remind, the chips, Book,
  Completed, the round trips), §22.1 (the follow-up reminder's words),
  §28.7 and §29 (0027; the migrations planned after it renumbered 0028 –
  0035, in §29 and the tracker); the tracker: R7.4 and R7.6 DONE.
- DESIGN.md: the follow-ups screen and its sheet; `IconLink`.

### Speed (plan §37)
- **The screen waits on 2 round trips:** the session, then at once the
  first tab's page, the counts, the clinic (for the reminder's phone), the
  doctors and the appointment types (for Book). Another tab is one read.
- **Noting a contact, or a reminder, waits on 3:** the session, the
  function, the audit row.
- No new query: the lists and counts are 0026's, on its indexes; 0027 adds
  one join to the last contact's profile, by its primary key.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3352), coverage 100%.
- E2E passed (phone, desktop), with axe: 136 passed, 8 skipped (run at one
  width only). The front-desk journey skips itself near midnight; the full
  run crossed it, so it was run again after midnight and passed at both
  widths.
- `tests/e2e/follow-ups.spec.ts`: the desk reminds Anita (the message, noted
  as Reminder sent by them), marks her No answer back in 3 days (off Today
  and its count), books Kiran's crown from his sheet (his row gone), and
  finds Divya's completed scaling with Call and the profile only; Dr. Ravi
  Iyer sees only his patient's; one who only reads reminds unnoted, and
  neither books nor notes.
- `tests/db/follow-up-callers-migration.test.ts` keeps 0027 equal to 0026
  but for the caller; `tests/db/integration/follow-up-screen.test.ts` (4):
  a tab and its count through the feature's functions, a contact read back
  with who made it and audited with the note by name alone, a reminder
  sent, a snoozed one out of its tab and count, and what is refused.
- Screenshots at a phone's and a desktop's width, light and dark, taken for
  the user and kept out of the repository.

### Blockers
- None.

## 2026-10-16 — R7.5: each follow-up on the right day

### Added
- `tests/db/integration/follow-up-days.test.ts` (plan §14.3, §34; D279 –
  D281), through the feature's functions, as a nurse:
  - **Every edge, from the clinic's today** (D279): due today in Today,
    yesterday in Overdue, tomorrow in Upcoming; the last day of Overdue
    against the first of Lapsed; the 30th day ahead in Upcoming, the 31st
    in no tab; a treatment completed 30 days ago in Completed, 31 not; a
    snooze back on its own day and not before.
  - **The clinic's midnight** (D268, D279): a visit opened, and a
    treatment's next sitting set, at 1:30 AM in India — 8 PM the day before
    in UTC — are set on India's day: an appointment kept that same India day
    does not close them, one the next day does. Checked against a copy of
    `follow_up_rows` counting the set day in UTC, which the test fails.
  - **Lapsed follows the DEV's setting** (D280): set to 7 days, a follow-up
    10 days overdue lapses and one 7 days overdue stays; set to 60, one 40
    days overdue is back in Overdue; each tab's count equals its list at
    each setting; the old value is put back.

### Changed
- **Plan:** D279 – D281; the tracker: R7.5 DONE.

### Speed (plan §37)
- No code changed: tests only.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3359), coverage 100%; the new file's 7
  tests among them, and `follow_up_lapsed_days` back at its value after.
- E2E not run again: no code changed since R7.4's run (136 passed, 8
  skipped, at phone and desktop width).

### Blockers
- None.

## 2026-10-16 — R8.1: bills in the database

### Added
- **`0028_bills`** (plan §15.2, §15.6, §11.3, §28.6; D27, D29, D282 –
  D289), the first billing row: no screen yet — the new bill comes with
  R8.3, checkout with R8.6.
  - **`bills`**, issued final: for a patient, and one of their visits, or the
    appointment whose fee is taken at arrival (D283), or neither; the
    visit's or appointment's doctor, or one picked; its day in the clinic's
    timezone (`issued_on`) and its financial year. Never edited: only voided,
    once, with a reason, stamped with who and when (`check_bill`).
  - **`bill_items`**: up to `BILL_MAX_ITEMS` (50) lines, each a price-list
    entry with its name copied — naming the patient's treatment it is for
    when it is (D285) — or a line typed with its price (D284); each its
    quantity times its price, within `MAX_AMOUNT_PAISE`.
  - **`bill_counters`**: each clinic's last number of a financial year,
    taken under the counter's row lock (`next_bill_number`) — `2026-27/0001`,
    every digit kept past 9999, never `max() + 1`, and a bill that fails
    takes its number back. The year is 0005's `financial_year()`.
  - **`create_bill`** (`payments.create`), once per idempotency key: the
    subtotal and total the screen worked out are worked out again and must
    agree; without `payments.discount`, every price is the price list's — a
    Consultation line's may be the bill's doctor's fee instead (D289) — with
    no typed line and no discount (`BILL_PRICE_NOT_ALLOWED`); an archived
    entry is refused (`SERVICE_INACTIVE`). The visit it bills is Billed,
    from To bill or No charge (D287); a Billed visit may take another bill
    (D286). The fee at arrival is a bill for the appointment while the
    patient is arrived or in: Arrived gives the token first, and a bill that
    fails never takes it back (D283).
  - **`void_bill`** (`payments.edit`, a reason): the bill stays, Void; its
    visit goes back to To bill once nothing billed remains for it.
  - **`mark_no_charge`** (`payments.create`): a visit waiting in To bill,
    with its reason — and a note for Other; twice changes nothing; one open
    or Billed is refused (`VISIT_NOT_TO_BILL`).
  - **A visit closes Billed** (`visit_billed`, §15.6) when a bill of its own
    was issued while it was open (Bill now), or its fee was billed at
    arrival and no treatment was worked on in it; otherwise To bill. Done,
    Next patient and a profile visit's Done hand the billing state to the
    audit row. Back to waiting keeps a visit a bill names (D197).
  - **A patient with a visit in To bill is not archived** (D288,
    `PATIENT_HAS_VISITS_TO_BILL`); the card names its day: "Meena Iyer has
    a visit to bill from 16 Oct".
  - Bills are read with `payments.view`, within the doctor scope; written
    only through the functions. Payments join `create_bill` with 0029
    (R8.4, D282).
- `BILL_STATUSES` and labels, `BILL_MAX_ITEMS`; the four refusals' words;
  `UI_TEXT.patients.hasVisitToBill`.

### Changed
- `finish_appointment` and `finish_visit` close a visit Billed when its
  bills settle it; `finish_visit` now hands back the billing state too
  (dropped and made again, its grant restored). `movesAudited` records a
  closed visit's billing state as the database gives it, on a visit created
  closed as well.
- `check_patient` refuses the archive after 0017's and 0024's refusals;
  `usePatientArchive` names the visit's day (D288).
- Four integration tests that archived a patient with a visit in To bill
  now settle it first (`settleVisits`), as checkout would; the
  migrations' index check accepts a primary key led by `clinic_id`.
- **Plan:** D282 – D289; §10.1 (the archive), §11.3 (the fee at arrival in
  two steps), §15.2 (typed lines, treatment lines, a Consultation's price,
  a second bill), §15.6 (when a visit closes Billed; a void), §28.6, §28.7,
  §29 (0028, and the payment with a bill in 0029); the tracker: R8.1 DONE,
  R8.4 names the payment with a bill.

### Speed (plan §37)
- **Round trips:** each function is one call; the screens come with R8.3
  and R8.6. Issuing a bill locks only what it bills (the visit, or the
  arrival's appointment) and the year's counter row.
- **Indexes,** each led by the clinic: the bills newest first `(clinic_id,
  issued_at desc)`; a patient's `(clinic_id, patient_id, issued_at)`; a
  visit's and an arrival's, only where there is one; a doctor's
  `(clinic_id, doctor_id, issued_at)`; who issued and voided; a line's
  entry and treatment, only where there is one; a bill's lines by its own
  `(bill_id, position)`; the counter by its key `(clinic_id,
  financial_year)`.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3409), coverage 100%.
- E2E passed (phone, desktop), with axe: 136 passed, 8 skipped (run at one
  width only).
- `tests/db/bills-migration.test.ts` keeps the statuses, bounds, lengths,
  checks, indexes, policies and grants equal to the app's.
  `tests/db/integration/bills.test.ts` (13): numbered per financial year,
  once per key, past 9999, five at once each their own and one key twice at
  once one bill; names copied, amounts in order; the price-list hold, the
  doctor's fee and the owner's discounts; a treatment's line; every refusal;
  a visit Billed, Billed again, back to To bill; the fee at arrival with
  and without a treatment worked on, and its void; Bill now from the queue —
  kept through Back to waiting — and from a profile; No charge, billed
  after all; the archive refused and then allowed; an issued bill never
  edited, voided once. The permission matrix, read-only and tenant
  isolation have their rows; `patients.spec.ts` sees the archive card.
- 0028 applied to the local database twice from 0027, each time cleanly.

### Blockers
- None.

## 2026-10-16 — R8.2: what a bill comes to

### Added
- **`src/features/billing/totals.ts`** (plan §15.1; D290 – D293), the one
  formula the new bill's preview and the server will use (R8.3), and that
  0028's `create_bill` works out again: `lineAmount`, `discountPaise` and
  `billTotals`, in whole paise, never a float.
  - A discount is an amount, as typed, or a whole percentage of the
    subtotal (`DISCOUNT_PERCENT`, 1 – 100, D291), rounded to the nearest
    rupee, half up — 15% off ₹333 is ₹50 off — in integers, and never past
    the subtotal, so 100% is the whole of it even when that ends in paise
    (D290).
  - An amount past the subtotal is left as typed, its total below nothing,
    for the form to refuse at the field (D293); the database refuses it too.
  - Stored as paise only; the bill will show the amount (D292).
- `DISCOUNT_KINDS` (amount or percentage) and `DISCOUNT_PERCENT`.

### Changed
- **Plan:** D290 – D293; §15.1 (the formula and its rounding), §15.2 (whole
  percentages, the amount on the bill); the tracker: R8.2 DONE.

### Speed (plan §37)
- No query or round trip: a pure function, worked out where it is called.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3426), coverage 100%. A first run broke
  while the computer slept (the database clock paused, workers timed out);
  run again, all passed.
- E2E not run: no screen or route changed (R8.1's run: 136 passed).
- `tests/unit/features/billing/totals.test.ts`: line amounts; amounts off,
  past the subtotal too; percentages to the rupee, half up and down; 100%
  of a subtotal in paise; the largest bill without drift; no lines.
  `tests/db/integration/bill-totals.test.ts` (8): seven bills issued at
  exactly the totals the formula works out — the rounding cases among them
  — and a total a paisa off, a subtotal a paisa off and a discount past the
  subtotal refused.

### Blockers
- None.

## 2026-10-16 — R8.4: payments and balances in the database

### Added
- **`0029_payments`** (plan §15.3, §15.4; D282, D294 – D301), built before
  R8.3 so the new bill screen comes whole (D294). No screen yet.
  - **`payments`**: money taken from a patient, or handed back — against the
    patient, never a bill (D4); kind, amount (₹0.01 – `MAX_AMOUNT_PAISE`),
    method, reference, a note, when it was paid — any time up to now, never
    later — and that day in the clinic's timezone (`paid_on`, D299), who
    received it. Never edited: voided once, with a reason (`check_payment`).
  - **`patient_balances`** (D295): a row per patient — billed, paid,
    refunded and the balance (generated: billed − paid + refunded) — kept by
    the money functions in each one's transaction (`add_to_balance`, which
    makes the row at nothing first, as a CHECK reads the row an insert
    proposes); never more refunded than paid. Filled from the bills 0028
    issued.
  - **`bill_settlement`**, a view read as the caller: each issued bill's
    paid, due and state — Paid, Part paid, Unpaid — the patient's net
    payments settling their bills oldest first (D298); worked out a patient
    at a time.
  - **`record_payment`**: a payment (`payments.create`) or a refund
    (`payments.edit`) of no more than the advance held, with the balance held
    (`PAYMENT_REFUND_TOO_LARGE`, D297); once per key; for a patient seen and
    not archived; hands back the balance after.
  - **`void_payment`** (`payments.edit`, a reason): once; a payment with a
    refund standing on it only after the refund (`PAYMENT_HAS_REFUNDS`, D301).
  - **`create_bill`** takes what is collected with the bill — Collect now,
    Issue and collect — in its transaction, paid now under the bill's key
    (D282); it and **`void_bill`** keep the balance, and hand it back.
- `PAYMENT_KINDS`, `PAYMENT_STATUSES`, `BILL_PAYMENT_STATES` and their labels;
  `TEXT_LIMITS.paymentNote`; the two refusals' words.

### Changed
- No `patient_stats` (D296): the profile's summary already serves the next
  appointment and open treatments, and the list will read the balances.
- A patient who owes, or holds an advance, may be archived; the balance stays
  and counts (D300).
- R8.1's void test expects the balance back too.
- **Plan:** D294 – D301; §15.3 (when paid, refunds, voids), §15.4 (the
  balances kept, archiving), §28.6 (payments, patient_balances), §28.7, §29;
  the tracker: R8.4 DONE.

### Speed (plan §37)
- **Round trips:** each function is one call; the screens come with R8.3 and
  R8.6. A money write holds the patient's balance row, so two at once for
  one patient wait in turn, and never anyone else's.
- **Indexes,** each led by the clinic: the payments newest first
  `(clinic_id, paid_at desc)`; a patient's `(clinic_id, patient_id, paid_at
  desc)`; who received and voided; those who owe, most first `(clinic_id,
  balance_paise desc) where balance_paise > 0`, for the Owing tab and
  Outstanding; a balance by its patient (the key).

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3464), coverage 100%.
- E2E not run: no screen or route changed (R8.1's run: 136 passed).
- `tests/db/payments-migration.test.ts` keeps the kinds, methods, statuses,
  states, bounds, lengths, checks, indexes, policies and grants equal to the
  app's, and 0029's `create_bill` to 0028's rules.
  `tests/db/integration/payments.test.ts` (11): a payment once per key,
  received by whoever took it; an advance used by a later bill; paid earlier
  on the clinic's day (1:30 AM in India), never later; bad amounts and
  methods; a refund only from the advance, with payments.edit; the D301
  order of voids; a void once, never an edit; collecting with a bill once
  per key, an advance from it, a refused payment issuing no bill; bills
  settled oldest first through a void and a refund; every balance equal to
  its bills and payments; a patient who owes archived, the balance kept and
  nothing more taken. The permission matrix, read-only and tenant isolation
  have their rows.

### Blockers
- None.

## 2026-10-18 — R8.3: the new bill screen and the fee at arrival

### Added
- **New bill — `/billing/new`** (`payments.create`; plan §15.2; D302 –
  D313), in `src/features/billing`:
  - Where it starts: **Bill now** at the foot of a visit (D307), **New bill**
    in a profile's header beside New visit (D311), an arrival's Collect fee,
    or no one yet — a patient search first, and a patient with a visit to
    bill offered **Bill that visit** (D313). A visit's bill starts with the
    consultation at the doctor's own fee (D26) unless it is billed already,
    and each treatment worked on in it not yet on an issued bill, as the
    price-list entry of its name (D285, D286).
  - Lines from a sheet: a search over the price list, grouped by category;
    **Add typed line** for `payments.discount` (D303). A treatment with no
    entry of its name is a reminder line, "Crown: pick its price-list
    entry", with **Pick entry** — nothing is issued until it has one or goes
    (D308). A line's price is a field for `payments.discount`, its read-out
    otherwise (D309).
  - Totals by the one formula (`billing/totals.ts`): subtotal, the discount
    (None, Amount, Percent, for `payments.discount`; one beyond the bill
    refused at its field, D293), total, balance now and after. **Collect
    now** starts on with the total in Cash and follows the total until an
    amount is typed; off on a bill of nothing (D304).
  - Lines on the left and the totals on the right from 1024 px, kept in
    view; stacked on a phone and a tablet, **Issue bill** on a bar fixed
    above the bottom bar (D310). Issue does not ask first (D312); once
    issued, back where it came from with "Bill 2026-27/0042 issued · ₹500
    collected" (D302).
- **Collect fee at arrival** (plan §11.3; D283, D305, D306): in a clinic that
  takes the fee at arrival, **Arrived** and **Add walk-in** open a small
  Collect fee sheet after the token — the doctor's fee, the method, a
  reference, **Issue and collect** or **Skip** — held above every screen
  (`FeeCollectionProvider`) so it outlives the queue's sheets. The queue's
  rows and the appointment's detail say **Fee paid** (an issued bill for the
  arrival); the detail offers **Collect fee** while the patient is arrived
  or in, until it is paid.
- **`0030_bill_start`**: `bill_start(visit, appointment, patient)`, one
  security-definer read for `payments.create` — reception included, whose
  preset opens no visit — of where a bill starts: the patient (archived or
  not), the visit or the arrival and its token, the doctor and their fee,
  whether its consultation is billed, its treatments not yet on an issued
  bill, the balance, and a patient's oldest visit to bill; within the doctor
  scope and the clinic.
- `POST /api/bills` (`payments.create`, an idempotency key; `create_bill`
  with the totals by `billing/totals.ts`, audited: the bill, its payment, the
  visit turned Billed — values only, nothing clinical) and
  `GET /api/bills/start`.
- `billSchema`, `billStartQuerySchema`, `collectFeeSchema`; the screen's words
  in `UI_TEXT.billing`; `BILLING_ROUTE`, `newBillRoute`, `BILL_FROM`.

### Changed
- `PatientPicker`'s **Change** is optional: a new bill leaves for the
  patient's own address once one is chosen.
- The queue, appointments and profile screens read the clinic's profile with
  their first reads, for when it takes the fee.
- **Migrations renumbered in the plan:** 0030 is `bill_start`, so expenses
  are `0031_expenses`, then `0032_dashboard_and_reports` and on (R9.1 –
  R13.3).
- **Plan:** D302 – D313; §15.2, §11.3, §12.2, §10.3, §28.7, §29 (0030);
  the tracker: R8.3 DONE.

### Speed (plan §37)
- **Round trips:** the new bill screen waits on 2 — the session, then where
  it starts (`bill_start`, one call) and the price list at once. Issue bill
  waits on 2: `create_bill`, then the audit rows. Collect fee reads the same
  two at once, and issues as Issue bill does. Fee paid comes inside the
  queue's and the detail's own query (an embed of the arrival's bills), so
  neither adds a call.
- **Indexes:** every read in `bill_start` leads with the clinic — a bill by
  its visit or its arrival (0028's partial indexes), a visit's sessions
  `(clinic_id, visit_id)`, a bill's items by treatment, the balance by its
  patient, and a patient's visits `(clinic_id, patient_id, …)`. No new
  index was needed.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3569), coverage 100%.
- E2E passed (142, phone and desktop): `new-bill.spec.ts` — the owner bills a visit
  from Bill now, its unpriced crown picked, collected by UPI, back on the
  visit; reception bills a visit from the profile and is led back to the
  profile, and a patient searched for from the price list; with the fee at
  arrival, Arrived asks for it after the token, the queue says Fee paid, and
  a fee skipped is collected from the detail. Axe on every screen.
- `tests/db/bill-start-migration.test.ts` keeps 0030's definer, search path,
  checks and grants; `tests/db/integration/bill-start.test.ts` (5): a visit
  read by reception, who may not open it, billed and not suggested again,
  audited; an arrival's token and Fee paid, gone with a void; a doctor with
  no fee; payments.create alone, the doctor scope and the clinic; an
  archived patient. The permission matrix and tenant isolation have their
  rows.

### Blockers
- None.

## 2026-10-18 — R8.5: a bill's page and its PDF

### Added
- **A bill's page — `/bills/[id]`** (`payments.view`; plan §15.2; D314):
  the number, the patient, the day and doctor, and its state — Paid, Part
  paid, Unpaid or Void; **Print** and **Download**; **Void bill** for
  `payments.edit` — a reason in a sheet, then the coral card asks first;
  **Re-issue** on a void bill, opening a new bill for its visit, arrival or
  patient filled with its lines, discount and notes; **Open profile**. Its
  lines, notes and figures, with paid and due on it and the patient's
  balance; once void, when, by whom and why. Back to Billing, or to the
  profile it was opened from (`?from=patient`, for D325).
- **The bill PDF** (plan §15.5; D315, D316), `src/features/documents/bill.ts`:
  the letterhead with the GSTIN; "Bill", its day and number; the patient, age
  on the bill's day, mobile and doctor; the lines as a table; the subtotal,
  discount, total, paid and due; the balance; the notes; signed at the foot
  by the clinic as its **Authorised signatory**. A void bill has a faint,
  slanted VOID across every page and its reason under the number
  (`PdfLayout.stamp`). Saved as "{patient} - Bill 2026-27-0042.pdf".
- `GET /api/bills/{id}` (`payments.view`), `POST /api/bills/{id}/void`
  (`payments.edit`, a reason; audited: the status and reason, and the visit
  back in To bill), `GET /api/bills/{id}/bill.pdf` (`payments.view`,
  `?download=1`; view-only clinics print too).
- `getBill`, `voidBill`, `getBillPdf`; `voidBillSchema`, `billIdSchema`;
  `BILL_PAYMENT_STATE_TONES`; `UI_TEXT.bill` and the PDF's words.

### Changed
- **The issued card stays up with Print and View bill** (D317) for whoever
  reads bills — the new bill's and Collect fee's alike. A response card's
  action may now open a file beside the app (`file`).
- The letterhead gives a clinic's GSTIN when it has one (the prescription
  passes none).
- `Figure` is shared by the new bill and the bill's page.
- **Plan:** §15.2 (the bill's page), §15.5 (as built); the tracker: R8.5
  DONE. Share on WhatsApp stays with R8.8 (D327).

### Speed (plan §37)
- **Round trips:** the bill's page waits on 2 — the session, then the bill
  (with its patient, balance, doctor, lines and people, one query) and its
  settlement at once. The PDF waits on 3: the session, the bill, its
  settlement and the clinic at once, then the logo. Void waits on 2:
  `void_bill`, then the audit rows. A re-issued bill's screen reads the void
  bill beside where it starts and the price list — still 2.
- **Indexes:** a bill by its id (the key) within the clinic; its items by
  bill (`unique (bill_id, position)`); the settlement's window over the
  patient's bills `(clinic_id, patient_id, issued_at)`; the balance by its
  patient (the key). No new index.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3634), coverage 100%.
- E2E passed (144, phone and desktop): `bill-page.spec.ts` — issued part paid, the
  card's Print and View bill; the page's lines and figures; Print's PDF and
  Download's file name; reception reads it and may not void it; voided with
  a reason, asked first, its visit back in To bill; re-issued as the next
  number. `new-bill.spec.ts` follows the card that now stays up. Axe on
  every screen.
- `tests/db/integration/bill-page.test.ts` (6): the bill read whole, part
  paid; payments.view, the doctor scope and the clinic; the PDF on A5 and
  A4, named, inline or attached; void for payments.edit only, once, audited,
  the visit back in To bill, the payment left as an advance, and its PDF
  still printed.

### Blockers
- None.

## 2026-10-19 — R8.6 (1 of 3): Billing's tabs, payments, Outstanding and the Owing tab

### Added
- **`0031_checkout`** (plan §29; the later migrations move up one —
  expenses are now `0032`): `to_bill_visits` and `to_bill_count`, the visits
  waiting in To bill for whoever reads bills — reception, who may not open a
  visit, included — with their doctor, token, the treatments worked on and a
  fee paid at arrival (D318, D337), on a new partial index of the visits in
  To bill; `list_bills`, Billing's bills of some days with each one's state
  as `bill_settlement` works it out, read for the patients billed in the
  range only (D320); `search_patients` takes the Owing tab (D101); and
  `billing_status(appointment)`, a finished arrival's billing state for the
  queue's Done (the next part).
- **Billing — `/billing`** (`features/billing/components/Billing.tsx`):
  tabs **To bill** (with its count), **Bills**, **Payments** and
  **Outstanding** (plan §15.4). To bill's rows open a sheet with **Bill** —
  the new bill, back to Billing — and **No charge** (Review, Courtesy, Other
  with a note; D319). Bills and Payments open on Today and pick 7 days, This
  month or From – To (D320, D335); Bills also by state. Outstanding offers
  Call, the dues reminder on WhatsApp (D321, `WHATSAPP_TEXT.duesReminder`)
  and Record payment.
- **Record payment** (`RecordPaymentSheet`, D322 – D324, D334): from
  Billing, the ＋ and Outstanding — a patient search first, the amount filled
  with what they owe, **Paid on** a day (today, or an earlier day stamped at
  its noon, counted on that day), the method, a reference and a note; as
  **Refund**, the advance held. `GET, POST /api/payments` (once per
  Idempotency-Key; a refund needs `payments.edit`).
- **A payment's sheet** (`PaymentPanel`, D336) with **Void payment** for
  `payments.edit`: a reason, then the coral card;
  `POST /api/payments/[id]/void`.
- `GET /api/to-bill`, `GET /api/to-bill/count`, `GET /api/bills` (a page of
  some days), `GET /api/outstanding`, `POST /api/visits/[id]/no-charge`.
- The patients list's **Owing** tab (`payments.view`), most first, and a
  coral "₹1,200 due" chip on each row that owes (`OwingPill`, D101).
- The kit's `DateRangeFilter` (`date-range.tsx`), `src/lib/dates/range.ts`,
  `useOpened`, and `oneOf` moved to `src/lib/supabase/embedded.ts`.

### Changed
- Issuing or voiding a bill also reads To bill, Billing's lists and the
  patients' chips again. The picker hands back the patient as the search
  found them, their balance with them.
- **Plan:** D334 – D336 recorded; §15.3, §15.4 and §15.6 say what was built;
  §29 and the tracker renumber the migrations after `0031_checkout`.

### Speed (plan §37)
- **Round trips:** Billing waits on 2 — the session, then To bill's first
  page, its count and the clinic at once; each other tab one read. Record
  payment, Void payment and No charge each wait on 2: the function, then the
  audit row. The patients list still waits on 1 — the balance is embedded.
- **Indexes:** `visits_clinic_id_to_bill_idx` (new, partial, oldest first);
  the bills of some days on `(clinic_id, issued_at desc)`, their settlement
  on `(clinic_id, patient_id, issued_at)`; the payments of some days on
  `(clinic_id, paid_at desc)`; who owes on 0029's partial index of balances
  above nothing.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3,779), coverage 100%.
- E2E passed (phone, desktop; 156 tests in 35 files): `billing.spec.ts`
  new. `front-desk-journey.spec.ts`'s desktop booking failed once in the
  full run (the slot left in the day) and passed on its own.
- `tests/db/integration/checkout.test.ts`: To bill for reception, the doctor
  scope and the clinic; No charge once, audited, refused once billed; bills
  by their days and state, equal to `bill_settlement`; payments on their own
  day, once per key, audited; refunds within the advance, voids after the
  refund; a view-only clinic refused; who owes, most first, and the Owing
  tab.

### Blockers
- None.

## 2026-10-24 — R8.6 (2 of 3): the queue's To bill, the Queue item's count, No charge on the visit

### Added
- **The queue's To bill** (`features/appointments/components/QueueToBill.tsx`,
  plan §11.4, §15.6; D318, D338 – D340): for whoever reads bills, after With
  doctor — Waiting, With doctor, To bill, Still to come, Done; on a phone
  below Waiting, on a desktop four columns with Done under Still to come.
  The shown doctor's visits waiting to be billed, or every doctor's, from
  any day, oldest first, a page at a time, read again with the queue every
  15 s; each row's **Bill** opens the To-bill sheet, whose new bill leads
  back to the queue (`BILL_FROM.queue`). The land pins a coral "3 to bill"
  on its coastline that jumps to it (D340) — the `Pin`'s first use.
- **The Queue item's count** (`AppShell`, plan §31.1; D337): for
  `payments.view`, a small coral count of the visits waiting in To bill on
  the Queue item — on its icon in the bar and the rail, at the end of its
  capsule in the sidebar, "99+" past ninety-nine — named with it ("Queue,
  3 to bill"), read beside the screen and again every 15 s.
- **No charge on the visit** (`NoChargeButton`, D319): a done visit waiting
  in To bill has **No charge** beside **Bill now**, opening the same reason
  sheet; once marked the visit says No charge.

### Changed
- **The queue's Done keeps to the settled** (D339): beside To bill, a
  patient done reaches Done once billed or marked No charge, so no one is
  listed twice — from `billing_status`, 0031's computed column, now read
  with each queue row (`QueueAppointment.billingStatus`). Whoever does not
  read bills sees no To bill, and Done lists everyone finished, as before.
- `useApiPages` takes a `refreshInterval`, for a list kept fresh beside a
  screen; `useToBill` uses it on the queue, and asks nothing of whoever does
  not read bills.
- A queue move (Send in, Done, Next patient, Back to waiting) reads To bill
  and its count again.
- `QueueSection` takes an `id` (what a pin jumps to), a `state` (loading or
  failed, in place of its rows) and a `footer` (Show more).
- Plan: D337 – D340 recorded; §11.4, §15.6 and §31.1 as built. `DESIGN.md`:
  the queue's To bill and pin, the place count, the visit's No charge.

### Speed (plan §37)
- **Round trips:** the queue still waits on 2 — the session, then the
  queue, the doctors, the types, the clinic and, for whoever reads bills,
  To bill's first page and its count, at once. The Queue item's count is
  read beside the screen (1, waited on by nothing; on the queue of every
  doctor it is the screen's own read). No charge from the visit waits on
  2: the function, then the audit row.
- **Indexes:** none new. To bill and its count are 0031's partial index;
  each queue row's `billing_status` is one look-up on the visits' unique
  appointment.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3,802), coverage 100%.
- E2E passed (phone, desktop; 150 passed, 8 skipped by design):
  `billing.spec.ts`'s new journey — the count
  and the pin, To bill on the queue, a bill back to the queue, Done once
  billed, No charge on the visit; `front-desk-journey.spec.ts` finds Kiran
  in the queue's To bill.
- `tests/db/integration/checkout.test.ts`: the queue's done patients and
  where they stand with billing — for reception, a nurse who reads visits
  and no bill, and as nothing for whoever reads neither.

### Blockers
- None.

## 2026-10-24 — R8.6 (3 of 3): the profile's balance, money in the history, Record payment on a bill

### Added
- **The profile's Balance** (`features/billing/components/PatientBalance.tsx`,
  plan §10.3 item 4; D295, D311, D322, D324): for `payments.view`, after the
  treatments — "₹1,200 due" in coral, "₹300 advance", or "Nothing due" —
  with **Record payment** (`payments.create`), filled with what is owed, and
  **Refund** (`payments.edit`) while an advance is held, filled with it.
  Neither for an archived patient (D300), nor in a view-only clinic, which
  says why. The balance comes with the profile's summary
  (`getPatientBalance`, `PatientSummary.balancePaise`).
- **Bills and payments in the history** (`PatientHistory`, D325, D336): for
  `payments.view`, among the visits and appointments by when each happened —
  a bill "Bill 2026-27/0042", its day, total and where it stands (Paid,
  Part paid, Unpaid, Void), opening its page, which leads back to the
  profile; a payment "Paid ₹500 · UPI" or "Refunded ₹700 · Cash", its day
  and who took it, opening its sheet with **Void payment**. A member who
  reads bills alone now sees the history too.
- **Record payment on a bill's page** (`BillScreen`, D314): for
  `payments.create` while the bill is Unpaid or Part paid, the sheet for its
  patient filled with what is still due on it; the bill is read again once
  recorded.
- `listPatientBills` (a page of a patient's bills, beside their
  settlement) and `listPatientPayments` (a page of their payments and
  refunds), for the history.

### Changed
- **The history's cursor counts four parts** — visits, appointments, bills,
  payments ("12.8.3.5") — and `mergeTimeline` merges them by when each
  happened, the larger id first at the same moment; a two-part cursor is
  refused. `TimelineEntry` takes `{ bill }` and `{ payment }`.
- The history's empty hint names bills and payments.
- Plan: tracker **R8.6 DONE (2026-10-24)**; §10.3, §15.2 and §15.3 as built.
  `DESIGN.md`: the profile's balance, the history's bill and payment rows,
  the bill page's Record payment.

### Speed (plan §37)
- **Round trips:** the profile still waits on 2 — the session, then the
  patient, the alerts, the summary (now with the balance, read beside the
  next appointment and the treatments) and the history's first page (now
  with the bills, their settlement and the payments, read beside the visits
  and appointments), all at once. Record payment and Refund from the
  profile or a bill wait on 2: the function, then the audit row.
- **Indexes:** none new. A patient's bills on `(clinic_id, patient_id,
  issued_at)`, their settlement through the same; their payments on
  `(clinic_id, patient_id, paid_at desc)`; their balance on its primary key.
  The settlement is read for the patient's issued bills — a patient's own,
  so a short list — beside the page, rather than after it.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3,823), coverage 100%.
- E2E passed (phone, desktop; 152 passed, 8 skipped by design):
  `billing.spec.ts`'s new journey — the bill
  in the history, paid in part from its page; ₹1,000 paid from the balance,
  the ₹700 advance refunded; the refund, both payments and the bill, Paid,
  in the history, a payment opening its sheet.
- `tests/db/integration/checkout.test.ts`: a patient's bills and payments
  in their history, newest first, each where it stands, and their balance —
  for reception, a doctor's own patient, and none for another doctor or
  whoever reads no bill; `patient-timeline.test.ts` pages across four parts.

### Blockers
- None.

## 2026-10-24 — R8.7: money that must be right, tested end to end

### Added
- **`tests/db/integration/money.test.ts`** (plan §15.2 – §15.4, §7.2,
  §34): through the routes the browser calls (`POST /api/bills`,
  `/api/payments`, the voids, No charge), with a member's own token, against
  the local database —
  - **a double tap:** Issue bill sent twice at once under one key makes one
    bill, one number, one audit row, the patient billed once (another key
    is another bill); Issue and collect twice makes one bill and one
    payment; Record payment twice, and a refund twice, one each, the
    balance moved once; a payment or a bill voided twice at once is voided
    and audited once; a bill or a payment sent with no key is refused
    (`IDEMPOTENCY_KEY_REQUIRED`) rather than risk two.
  - **a balance to the paisa:** one patient through ₹333.33 × 3 at 7% off,
    ₹1,250.50 less ₹50.25, ₹500.75 and ₹1,000.10 paid, a bill voided into
    an advance, ₹123.45 refunded, a payment voided and a later bill — after
    every step the balance equals the issued bills less what was paid plus
    what was refunded, and so do the profile's summary, the patients list,
    Outstanding and every bill's page; the bills' settlement holds what was
    paid net, never more than was billed, each bill's paid and due adding
    up to its total.
  - **a view-only clinic:** every money route — issue, record, refund, void
    a payment, void a bill, No charge — refuses with `CLINIC_PLAN_EXPIRED`
    and changes nothing; the money tables written straight through the
    database's API are refused too; its bills, payments, Outstanding, To
    bill and a bill's page still read, and its bill still prints.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3,832), coverage 100%.
- E2E passed (phone, desktop; 152 passed, 8 skipped by design).

### Blockers
- None.

## 2026-10-24 — R8.8: a bill's doctor, and Send bill on WhatsApp

### Added
- **`0032_bill_doctor`** (plan §29; the later migrations move up one —
  expenses are now `0033`): `bill_start` as 0030's, and for a bill from a
  patient their assigned doctor while that doctor practises, and the
  clinic's active doctors with their own fees (D326, D342); the patient's
  mobile for every start, for WhatsApp (D341). `create_bill` (0029) already
  took a doctor picked, checked active.
- **The doctor of a bill from a patient** (`NewBill`, D342): "Doctor" chips
  — No doctor and each active doctor — starting on the patient's assigned
  doctor; a doctor picked prices a Consultation line at their own fee (D289),
  and a line still at the last doctor's price moves with the pick
  (`repriced`); a price typed by hand stays. A visit's or an arrival's bill
  keeps the visit's doctor. `billSchema` takes `doctorId`; `issueBill`
  sends it; the bill's page reads it back, so **Re-issue** names the void
  bill's doctor again (`BillDetail.doctorId`).
- **Send bill on WhatsApp** (D327, D341): on a live bill's page and on the
  issued card — "Your bill 2026-27/0042 from Smile Care, 15 Oct: ₹1,500."
  and "₹1,000 is due." while something is, with the PDF: the share sheet on
  a phone, WhatsApp Web and a download on a desktop (`useBillSend`). A void
  bill offers none. The issued card's due is the newest bill's — the
  balance, no more than its total (`dueOnNewest`, D298).
- `WHATSAPP_TEXT.bill`; the bill's send words in `UI_TEXT.bill`.

### Changed
- The prescription's WhatsApp and the bill's share one hook,
  `usePdfSend` (documents); `usePrescriptionSend` is its prescription words.
- The response card takes a third action, `tertiary` — quiet, first, the
  three stacked: the issued card is **Print**, **WhatsApp**, **View bill**.
- Plan: D341, D342 recorded; tracker R8.8 DONE (2026-10-24); §15.2 and
  §22.1 as built; the migration list renumbered from 0032. `DESIGN.md`: the
  doctor chips, the issued card, the bill page's WhatsApp, the card's third
  action.

### Speed (plan §37)
- **Round trips:** New bill still waits on 2 — the session, then
  `bill_start` (now with the doctors) beside the price list. Issuing still
  waits on 2. Sending a bill waits on 1: its PDF.
- **Indexes:** none new; the doctors on `doctors_clinic_id_idx`.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3,860), coverage 100%.
- E2E passed (phone, desktop; 154 passed, 8 skipped by design): `new-bill.spec.ts` — a patient's bill starts
  on No doctor, Dr. Maya Rao picked prices the Consultation at her ₹800,
  the bill saved with her; `bill-page.spec.ts` — WhatsApp from the issued
  card and the bill's page, the share sheet on a phone, the chat with the
  message and the PDF on a desktop.
- `tests/db/integration/bill-start.test.ts`: a patient's bill starts on
  their assigned doctor with the doctors and fees to pick, none when that
  doctor no longer practises, and is issued with the doctor picked — at
  their fee, the price list's with none.

### Blockers
- None.

## 2026-10-24 — R9.1: expenses — added, corrected, archived, the month's totals by category

### Added
- **`0033_expenses`** (plan §16, §28.6): `expenses` — the clinic's own
  category, an amount within the app's bound, the day, how it was paid, an
  optional description; archived, never deleted; once per idempotency key;
  `created_by`, `updated_by`, `archived_by` kept. Read by its policy for
  `expenses.view`; written only through `create_expense`
  (`expenses.create`, a category in use, today or earlier in the clinic's
  timezone — D328), `change_expense` (`expenses.edit`, not once archived,
  its own category kept though archived since — D333) and `archive_expense`
  (`expenses.edit`, archive or restore — D331), each checking the clinic can
  write. `expense_totals`: the month's category totals and the whole in one
  grouping-sets query, archived ones left out. Indexed by day, by category
  and the archived, each leading with the clinic. `expense_categories` gets
  `unique (id, clinic_id)` for the expense's composite key.
- **Expenses — `/expenses`** (`features/expenses`, D330 – D332, D343,
  D344): a month at a time with ‹ › (`MonthSwitcher`, in the kit) — this
  month to start, none after it; "Spent in October 2026" and each
  category's total, tapped to keep the list to it; the expenses by day,
  newest first — "Today", "14 Oct"; on a desktop the totals left, the list
  right. **Add expense** (or the ＋'s Expense) opens `ExpenseSheet` —
  category chips, none chosen to start; amount; day, today unless changed;
  Paid by; a description, optional — sent twice, added once. For
  `expenses.edit` a row opens it filled, with **Archive** asked first;
  **Show archived** lists the month's archived with **Restore**.
- Routes `GET, POST /api/expenses`, `PATCH /api/expenses/[id]`,
  `POST /api/expenses/[id]/archive`, `GET /api/expenses/summary` (plan
  §30); `ExpensesClient`; `expenseSchema` and the queries; every change
  audited with its values — nothing in an expense is clinical.
- Error codes `EXPENSE_CATEGORY_ARCHIVED`, `EXPENSE_ARCHIVED`,
  `EXPENSES_LOAD_FAILED`, `EXPENSE_TOTALS_LOAD_FAILED`.

### Changed
- Plan: D343, D344 recorded; tracker R9.1 DONE (2026-10-24); §16 as
  built. `DESIGN.md`: Expenses, the expense sheet, `MonthSwitcher`.

### Speed (plan §37)
- **Round trips:** Expenses waits on 2 — the session, then the month's
  totals, its first page and the categories, at once; another month, a
  category or the archived, one read each. Adding, correcting, archiving
  and restoring wait on 2: the function, then the audit row.
- **Indexes:** `expenses_clinic_id_expense_date_idx` (partial, in use, by
  day), `expenses_clinic_id_category_id_idx`, `expenses_clinic_id_archived_idx`
  (partial), and one on each person who added, changed or archived.

### Validation
- Typecheck, lint, format check passed.
- Unit and integration tests passed (3,929), coverage 100%.
- E2E passed (phone, desktop; 154 passed, 8 skipped by design).
- `tests/db/expenses-migration.test.ts`: the table's bounds, key, indexes,
  policy and grant; each function's permission, plan check, category and
  day; the totals as the caller. Integration and E2E come with R9.2.

### Blockers
- None.
