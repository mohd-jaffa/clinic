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
