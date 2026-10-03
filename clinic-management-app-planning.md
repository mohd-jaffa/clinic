# ClinicDesk — Product, Architecture & Delivery Plan

**Status:** planning complete for V1, under review (2026-10-02). Implementation
starts at Phase 0 once the open questions in §41 are answered or their defaults
accepted.

**This plan is the source of truth.** `AGENTS.md` says *how* to work in this
repository; this file says *what* to build and *in what order*. Nothing is built
that this plan does not name; a change of scope is recorded here first (§2,
AGENTS.md §33).

**Reference implementation.** ClinicDesk follows the conventions, folder
structure, constant centralisation, error and API contracts, test layout and
release process of Brio (`/Users/jaffa/projects/ovenly`). Port, don't
reinvent: when a Brio module fits, copy it, rename `bakery` → `clinic`, and
bring its tests with it. Brio's history is not copied: its plan grew by
appending; this one is kept whole and edited in place, with the decision log
(§2) recording what changed and when.

The initial draft this plan replaces is kept at
`docs/planning/2026-10-02-initial-draft.md`; §43 lists every change made to it.

---

## Contents

**Part I — Product**
1. Overview · 2. Decision log · 3. Users and roles · 4. Scope

**Part II — Specifications**
5. Sign-up, sign-in and accounts · 6. Platform settings · 7. Subscription and
trial · 8. Team, roles and permissions · 9. Clinic settings · 10. Patients ·
11. Appointments, calendar and the queue · 12. Visits and clinical records ·
13. Prescriptions · 14. Treatments and follow-ups · 15. Billing and payments ·
16. Expenses · 17. Home (dashboard) · 18. Reports · 19. Activity log ·
20. Developer console · 21. Landing, legal and the installable app · 22. Emails and WhatsApp

**Part III — Architecture and engineering**
23. System architecture · 24. Technology stack · 25. Folder structure ·
26. Central constants · 27. Security model · 28. Data model · 29. Migrations ·
30. API · 31. Screens and navigation · 32. Design system and UI rules ·
33. Documents (PDF) · 34. Testing and coverage · 35. CI/CD, environments and
release · 36. Observability · 37. Performance and accessibility budgets

**Part IV — Delivery**
38. Phases · 39. Tracker · 40. Definition of shippable · 41. Open questions ·
42. Later (unscheduled) · 43. Changes from the initial draft

---

# Part I — Product

## 1. Overview

ClinicDesk is a mobile-first, fully responsive web app that runs the front desk
and the consulting room of a small or medium clinic: patients, appointments and
the walk-in queue, visits with vitals and prescriptions, treatments and
follow-ups, bills and payments, expenses, and the numbers at the end of the day.

- **Who it is for:** dental clinics, general clinics and other small/medium
  clinics in India (physiotherapy, dermatology, …). The core is not tied to
  any specialty; specialty modules (dental first) come later (§42).
- **Who uses it:** the clinic's owner, its doctors and its staff — each with
  their own account. **Patients never use the app**; they receive a
  prescription or a bill the clinic shares.
- **Where:** the browser on a phone at the front desk or in the consulting
  room, and a desktop or laptop for the day's work and the month's review.
  Every screen ships phone, tablet and desktop together. The app is
  installable (PWA). There is no app-store app.
- **Business model:** self-serve sign-up with a free trial; after it, the
  clinic pays the platform admin offline and the admin extends the clinic's
  validity from the developer console (§7). Default prices: ₹300 a month or
  ₹3,000 a year, one price per clinic, unlimited team.
- **Production:** Next.js on Vercel (Mumbai, `bom1`), Supabase Cloud
  (Mumbai, `ap-south-1`) for PostgreSQL, Auth and Storage. Locally, the same
  app against the local Supabase in Docker.

**Success** is a clinic where reception never double-books a doctor, the doctor
sees the patient's allergies before writing a prescription, no treatment is
forgotten half-done, every rupee billed is either collected or visibly owed,
and the owner knows at the end of each day what came in and what went out.

## 2. Decision log

Every decision the user made, with its date. A later change appends a new line;
earlier lines are never rewritten.

| ID | Decision | Date |
|---|---|---|
| D1 | **Self-serve sign-up.** An owner registers and creates their clinic in one flow. | 2026-10-02 |
| D2 | **Team joins by email invite link.** The owner (or a member with `team.manage`) invites; the person sets their own password. | 2026-10-02 |
| D3 | **Doctors see only their own patients.** A patient is a doctor's own if the doctor is the patient's assigned doctor, **or** has any appointment, visit or treatment with them. Owners see every patient; staff see every patient if they hold `patients.view`. | 2026-10-02 |
| D4 | **Bills + patient balance.** Charges are bill line items from a per-clinic price list; payments go against the patient's balance (instalments just work). Outstanding = billed − paid + refunded. | 2026-10-02 |
| D5 | **V1 clinical records:** visit notes (complaint, diagnosis, notes), **prescriptions**, **vitals**, **allergies, conditions and current medications**. No file attachments. | 2026-10-02 |
| D6 | **Dental module: later, unscheduled.** | 2026-10-02 |
| D7 | **Scheduling:** double-booking refused by the database; a walk-in queue with token numbers; clinic holidays and doctor leave. No per-doctor working hours. | 2026-10-02 |
| D8 | **Platforms:** responsive web + installable PWA. No Android/iOS app. | 2026-10-02 |
| D9 | **Market: India only.** ₹ in integer paise, +91 mobiles, Asia/Kolkata by default, English UI, hosting in Mumbai. | 2026-10-02 |
| D10 | **Developer console:** read-only, plus extending a clinic's subscription. DEV never sees clinic data. | 2026-10-02 |
| D11 | **Subscription:** every new clinic gets a 1-month free trial; afterwards the clinic contacts the admin and pays offline; the admin sets the clinic's validity date. Default prices ₹300/month, ₹3,000/year. | 2026-10-02 |
| D12 | **On expiry:** warning banners 7 days before, then a 7-day grace period with full access, then **read-only** (view, search, print; nothing new) until extended. | 2026-10-02 |
| D13 | **Flat price per clinic, unlimited doctors, staff and patients.** | 2026-10-02 |
| D14 | **Retention:** audit trail 1 month, error log 7 days. | 2026-10-02 |
| D15 | **Own design system**, as Brio: PRODUCT.md, DESIGN.md, tokens, our own UI kit, shaped and audited with Impeccable. | 2026-10-02 |
| D16 | **Coverage 100%, enforced in CI.** | 2026-10-02 |
| D17 | **Release as Brio:** CI on every push/PR; a published GitHub release re-runs the gates, migrates the hosted database and uploads a prebuilt app to Vercel. No staging. | 2026-10-02 |
| D18 | **Landing page with pricing at `/`**, plus `/privacy` and `/terms`. | 2026-10-02 |
| D19 | **Bills: no GST, numbered per clinic** (`BILL-1001`), PDF on the clinic's letterhead; an optional GSTIN may be printed. | 2026-10-02 |
| D20 | **Email over SMTP, Gmail first**, behind one mail abstraction; a provider change is an env change only. | 2026-10-02 |
| D21 | **AGENTS.md and CLAUDE.md as in Brio**, adapted to ClinicDesk, for a consistent coding and agent workflow. | 2026-10-02 |
| D22 | **Business rules are not hard-coded.** Grace period, warning window, trial length, prices, audit and error-log retention and the like are **platform settings** the DEV edits in the developer console. The values above are only their defaults (§6). | 2026-10-02 |
| D23 | **One clinic per person in V1** (Q4). The schema allows more; a clinic switcher is later. | 2026-10-02 |
| D24 | **Exactly one owner per clinic** (Q5); a partner is Staff with the Clinic manager preset. Ownership transfer is later. | 2026-10-02 |
| D25 | **Owners see everything**, clinical records included, whether or not they are a doctor. | 2026-10-02 |
| D26 | **Per-doctor consultation fee:** the price list is clinic-wide; each doctor may have their own consultation fee, which "Bill this visit" uses. | 2026-10-02 |
| D27 | **Bill numbers per financial year:** `2026-27/0001`, restarting each April (clinic timezone), unique per clinic and year, never reused. | 2026-10-02 |
| D28 | **Print formats: A4 and A5**, both with the letterhead the app draws. No pre-printed-pad mode, no thermal receipt. | 2026-10-02 |
| D29 | **Discounts and price changes need `payments.discount`.** Owner, Doctor and Clinic manager have it; Receptionist does not (Q11). | 2026-10-02 |
| D30 | **A small "Generated with ClinicDesk" footer** on bills and prescriptions (Q16). | 2026-10-02 |
| D31 | **Temperature in °F** (Q21). | 2026-10-02 |
| D32 | **Appointment types are per clinic**, editable in Settings, seeded with Consultation 15, Follow-up 10, Procedure 30, Review 15, Other 15 (Q9). | 2026-10-02 |
| D33 | **Required patient details:** name, mobile, age or date of birth, gender (Q7, Q8). | 2026-10-02 |
| D34 | **The queue refreshes every 15 s** and on focus; realtime is later (Q20). | 2026-10-02 |
| D35 | **"ClinicDesk" is a working name** (Q1), used only through `UI_TEXT.appName` and the brand constants, so the final name is one change before Phase 12. | 2026-10-02 |
| D36 | **Light and dark themes**; dark follows the device, with a switch in My account (Q12). | 2026-10-02 |
| D37 | **Clinic deletion: the owner requests, the DEV deletes** after a cooling-off period (`deletion_cooling_days`, a platform setting, default 7). The owner may cancel until then (Q14). | 2026-10-02 |
| D38 | **Commits are authored `jaFFa <jafakash.14@gmail.com>`**, as Brio (Q15). | 2026-10-02 |
| D39 | **Sign in with email or mobile number** + password; both unique per account. | 2026-10-02 |
| D40 | **Expense categories are per clinic**, editable, seeded with the draft's nine (Q10). | 2026-10-02 |
| D41 | **CSV export in V1:** the owner downloads the clinic's data, one CSV per area, generated on demand and never stored. | 2026-10-02 |
| D42 | **One free trial per owner mobile number**, ever: a mobile that has owned a trial before starts its new clinic without one. | 2026-10-02 |
| D43 | **Staff run the queue.** Staff with `appointments.edit` send patients in and mark them done; the doctor has one **Next patient** button that closes the current patient and calls the next. A doctor never has to touch the app to finish a consultation. | 2026-10-02 |
| D44 | **When the consultation fee is collected is a clinic setting:** at arrival (with the token) or after the consultation (at checkout). Other charges are always billed at checkout. | 2026-10-02 |
| D45 | **Staff may type for the doctor:** notes through `visits.edit`, prescriptions through a new `prescriptions.write`. A prescription is always in the visit doctor's name and records who typed it. | 2026-10-02 |
| D46 | **Checkout is a "To bill" list.** Every finished visit is *To bill*, *Billed* or *No charge*; the To-bill list pre-fills the doctor's fee and the procedures, and nothing is billed without a person issuing it. | 2026-10-02 |
| D47 | **No waiting-room token display in V1** (Later). | 2026-10-02 |
| D48 | **WhatsApp click-to-send:** buttons open WhatsApp with a pre-written message (a `wa.me` link — no API, no cost) for appointment and follow-up reminders and for a bill or prescription; on phones the PDF is attached through the share sheet. Staff press send. | 2026-10-02 |
| D49 | **Day-end collection summary** in Reports → Daily: collections by method and by who received them, refunds, net; printable. No locking. | 2026-10-02 |
| D50 | **Patient self-booking: Later.** V1 is staff-only. | 2026-10-02 |
| D51 | **Patient import from CSV/Excel:** column mapping, a preview with errors and possible duplicates, then import. Patients only; the file is read in the browser and never stored. | 2026-10-02 |
| D52 | **No referral source** on patients. | 2026-10-02 |
| D53 | **Revenue by doctor in Monthly reports:** patients seen, visits, billed, and how much of it is paid to date, per doctor. | 2026-10-02 |
| D54 | **Prescription aids:** repeat the patient's last prescription; saved prescription templates per doctor. | 2026-10-02 |
| D55 | **Online-only, nothing lost:** an offline banner; saves wait and retry; what is being typed stays on screen; no patient data stored on the device. | 2026-10-02 |
| D56 | **No idle lock.** Sessions last until sign-out. | 2026-10-02 |
| D57 | **Two-factor authentication: Later.** | 2026-10-02 |
| D58 | **A receipt PDF for every plan payment**, on the owner's Plan screen, from the platform's business details (platform settings). | 2026-10-02 |
| D59 | **Visual direction: "The Clinic Map"** — the guide-map world (flat land field, coastline edges, capsule controls with a travelling chip), translated for a clinic: green + ink + one coral, no yellow or gold, no photos, no bounce, light and dark. Shaped with Impeccable (seed `d61c6e96`); the brief is §32.1. | 2026-10-02 |
| D60 | **The typeface is chosen from a sample page:** three legible grotesks in the Clinic Map's colours, light and dark, with tokens, ₹ amounts and a queue row; the user picks before the tokens and the kit are built (R2.2). | 2026-10-02 |
| D61 | **Until the final name (Q1), the brand is a text wordmark only:** "ClinicDesk" set in the app's typeface, no symbol — renaming stays one constant change. | 2026-10-02 |
| D62 | **Phase 1 stays local for now;** Phase 2 branches from `phase-1/identity`, and both are pushed together later, when CI first runs. | 2026-10-02 |
| D63 | **Invites use the app's own token** (answers Q23): a random token in the emailed link, only its hash kept on the membership with `invite_expires_at`; the account is made at invite with no password (admin API); `/accept-invite` checks the token on the server, which then sets the password and mobile and confirms the email. The link lasts `invite_valid_days`; Supabase's own invite link is not used. | 2026-10-02 |
| D64 | **The typeface is Figtree** (the user, from the sample page, D60), regular and bold, with its `latin` and `latin-ext` subsets (the ₹ sign is in `latin-ext`) and tabular figures. It has no slashed zero or alternate I/l, so codes and doses rely on Figtree's flagged 1 and on context. | 2026-10-02 |
| D65 | **Select, date and time fields open the app's own list and calendar** (the user, as in Brio): a select-only combobox and a month calendar in the Clinic Map's look, in both themes, keyboard-complete — never the browser's pickers. | 2026-10-02 |
| D66 | **The calendar grid and the chart kit are built with their screens:** the appointment calendar's grid in R5.3, the bar and donut charts in R10.3, shaped by the data they show. R2.3 builds the rest of the §32.2 kit, the date picker's month grid included. | 2026-10-02 |
| D67 | **Quick add takes you there, its form open** (the user): each ＋ action goes to its own screen with its form already open — Walk-in to the Queue, Appointment to the calendar, Patient to Patients, Payment to Billing, Expense to Expenses (`?add=`) — so the outcome is seen in place and Back closes the form. Each screen owns its form; the shell carries none. | 2026-10-02 |
| D68 | **No top bar on a phone** (the user): each screen's land carries its title; the account, the clinic and Settings are reached from More, which opens on who is signed in. | 2026-10-02 |
| D69 | **＋ on tablet and desktop too** (the user): a round ＋ at the top of the rail and an **Add** capsule at the top of the sidebar open the same Quick Actions. | 2026-10-02 |
| D70 | **Account screens: the land leads** (the user): on a phone the land holds the app's name and its line over a coastline, the form on the ground below; from 1024 px the land fills the left half, its edge a coastline, and the form stands on the right. Sign in, sign up, confirm email, forgot and reset password all share it. | 2026-10-03 |
| D71 | **The Settings index lists every row now** (the user): You (My account), Clinic setup (`settings.manage`) and Plan and records (owner), then Sign out — each person seeing the rows their permissions allow. A row whose screen a later phase builds opens the not-found screen until then. | 2026-10-03 |
| D72 | **My account: a sheet per detail** (the user): Name and Mobile are rows, each opening a sheet for that one detail; Change password opens a sheet with the current and the new; Email is shown and not changed (later); the theme is a System · Light · Dark switch on the screen; Sign out asks first. | 2026-10-03 |
| D73 | **The plan banner is a slim band on top** (the user): across the top of every signed-in screen, above its land — quiet while the plan ends soon, coral once it has ended and while the clinic is view-only; the state in its words and icon, never colour alone. The offline banner (R2.11) is the same kind of band. | 2026-10-03 |
| D74 | **How to renew leads to the Plan screen** (the user): the banner offers the owner **How to renew**, which opens `/settings/plan` (R11.1); until R11.1 it opens the not-found screen, as the other Settings rows do (D71). | 2026-10-03 |
| D75 | **Menus are one list on the ground** (the user, at the Phase 2 finish review): Settings, My account and the More sheet list their rows as one continuous list per section, parted by hairlines, each icon bare (coral for Delete clinic) — never a card per row or a tile under an icon (§32.1 Refuses). Separate surface rows stay for lists of people and records (the queue, bills). The response and confirm cards set their icon bare beside the title. | 2026-10-03 |
| D76 | **Quick Actions drops from its ＋ on tablet and desktop** (the user, at the Phase 2 finish review): from 768 px the lobe opens beside the rail's ＋ and the sidebar's **Add**, at the top, its lower edge the coastline; on a phone it still rises from the bottom. Each action is a capsule with its chip on the trailing edge, as every capsule's at rest. | 2026-10-03 |
| D77 | **Migrations are numbered in the order they are built** (the user): Phase 3 builds the clinic profile (R3.1) before the team (R3.4), so they are `0009_clinic_profile`, `0010_closures`, `0011_team`. A number is fixed once its migration is committed; none is renumbered after release. | 2026-10-03 |
| D78 | **Clinic details: rows and sheets, like My account** (the user): the logo at the top with Change and Remove; the details as rows, one sheet holding name, type, address, city, phone, email and GSTIN; paper size and fee timing as choices saved the moment they are picked, like the theme. | 2026-10-03 |
| D79 | **The logo can be removed** (the user): Remove asks first, deletes the file and leaves the letterhead with the clinic's name only. A new logo still replaces the old only after it is stored. | 2026-10-03 |
| D80 | **Archived catalogue entries can be restored** (the user): a service, appointment type or expense category that is archived leaves its list for **Show archived** at the foot, where **Restore** brings it back — refused, in words, while an active entry has its name. Archive still asks first. | 2026-10-03 |
| D81 | **New appointment types and expense categories join the end; no reordering** (the user): the seeded order stays, each new one is placed last (`0010`), and the plan names no way to move one. | 2026-10-03 |
| D82 | **The price list is grouped by category, with a search** (the user): a section per category in the plan's order — Consultation, Procedure, Investigation, Medicine, Other — each row a name and its price; the search finds a service by name; **Add service** beside it. | 2026-10-03 |
| D83 | **A clinic keeps one of each** (the user): the last active appointment type (booking needs one), the last active expense category (an expense needs one) and the last active service in Consultation (a bill starts from it) cannot be archived — nor that service moved to another category. The database refuses it (`0010`), in words. Migrations from closures on move up one: `0011_closures`, `0012_team`, … | 2026-10-03 |
| D84 | **Past closures are kept, behind Show past** (the user): Holidays and leave lists the closures not yet over, by date; the past ones wait behind **Show past (n)**, read-only, as a record. Only a closure not yet over can be removed, asked first; it is never edited — removed and added again. | 2026-10-03 |
| D85 | **A closure starts today or later and lasts at most a year** (the user): it ends on or after its start, within 366 days of it (a column-protecting bound in `limits.ts`, kept equal to the table's `CHECK`). A start before today, in the clinic's timezone, is refused by the database — booking is never in the past, so it would change nothing. | 2026-10-03 |
| D86 | **Closures for the same people do not overlap** (the user): two whole-clinic closures, or two of the same doctor's, may not share a day — the database refuses it (an exclusion constraint), in words. A doctor's leave inside a clinic holiday is allowed: they say different things. | 2026-10-03 |
| D87 | **The appointments a closure falls on are listed in R5.1** (the user): R3.3 builds closures and their screen; R5.1, which brings appointments and the booking check, adds the list of appointments on the days of a closure being added (not cancelled). | 2026-10-03 |
| D88 | **The Receptionist preset takes payments, without discounts** (the user; answers Q19): `payments.view` and `payments.create`, never `payments.discount`, so a receptionist's bill holds to the price list and the doctor's fee. The owner may untick it per person. | 2026-10-03 |
| D89 | **Inviting is one sheet in sections** (the user): the person (name, email); the role (Doctor or Staff, a job title for staff); access — preset chips that tick the permissions, grouped by area, each still changeable; and, for a doctor only, their details (specialization, qualifications, registration number, fee). One **Send invite**. | 2026-10-03 |
| D90 | **The invite link is only ever emailed** (the user): no link is shown on screen or shared another way; **Resend** sends a new one. The token stays out of chats and screens. | 2026-10-03 |
| D91 | **Everyone accepting an invite sets a password** (the user): someone who already has an account (they left another clinic) confirms their name, gives their mobile and sets a password like anyone else — the link proves the email, as a reset link does, so their old password is replaced. | 2026-10-03 |
| D92 | **Accepting an invite signs the invitee in, whoever was signed in** (the user): the accept screen shows as usual on a device where someone else is signed in; accepting replaces that session with the invitee's and lands on Home in a new page load. | 2026-10-03 |
| D93 | **A manager changes only those within their own access** (the user): a member with `team.manage` who is not the owner may change or deactivate a member only when they hold every permission that member has, and never one with `team.manage`; anyone else is the owner's to change. Never the owner, never themselves (§8.2 rule 5). The database holds the same. | 2026-10-03 |
| D94 | **A member has a page of their own** (the user): `/team/[id]` — who they are (name, email, mobile, role) at the top; the job title or the doctor's details as a row opening a sheet; what they can do, with the same presets and grouped permissions as the invite, saved with one **Save changes**; **Deactivate** (asked first) or **Reactivate** at the foot. | 2026-10-03 |
| D95 | **A member's role is fixed in V1** (the user): a member stays the Doctor or Staff they were invited as; their permissions, job title and doctor details change, the role does not — a doctor's records keep a doctor profile that never vanishes. | 2026-10-03 |
| D96 | **The owner's doctor profile lives on their own row in Team** (the user): "Asha Menon (you)" opens their page — contact, a note that the owner has every permission, an **I also see patients** switch and, while it is on, their doctor details in the same sheet as any doctor's. Only the owner changes it. | 2026-10-03 |
| D97 | **Turning "I also see patients" off keeps the profile, inactive** (the user): the owner leaves the doctor pickers, the queue and booking; records in their name keep it; turning it on brings the same profile back with its details. Migrations from patients on move up one: `0015_patients`, … | 2026-10-03 |
| D98 | **What is typed about a patient travels in the body, never the address** (the user): the patients search and the mobile-match hint are `POST /api/patients/search` and `POST /api/patients/matches`, so no name or number lands in an address or a hosting log (§27.6) — as the invite preview keeps its token (R3.5). | 2026-10-03 |
| D99 | **Adding a patient counts as contact** (the user): the doctor who adds a patient joins that patient's access list beside the assigned doctor, so a patient a doctor has just saved never leaves their view, whichever doctor they assigned (§27.3). | 2026-10-03 |
| D100 | **An age is given in years; a baby by date of birth** (the user): 0 – 120 years (`MAX_PATIENT_AGE`), stored as today that many years ago with `dob_is_estimated`, so the age stays right as time passes. Shown as "34 y", and under a year as "8 mo". | 2026-10-03 |
| D101 | **Each phase adds its own part of the patients list and profile** (the user): Phase 4 builds what patients have — search, All and Archived, the header, alerts, details. The next appointment and appointments come with Phase 5, the last visit and visits with Phase 6, open treatments with Phase 7, the balance, the Owing tab, the balance chip, bills and payments with Phase 8; their tracker rows say so. | 2026-10-03 |
| D102 | **Adding or editing a patient needs seeing them** (the user): `patients.create` and `patients.edit` both imply `patients.view` (§8.2 rule 2); the editor ticks it and the database refuses a set without it (`0015`). | 2026-10-03 |
| D103 | **An archived patient is read-only until restored** (the user): their profile and records are read as before, but their details and alerts cannot change, and nothing is booked for them; Restore first. The database refuses it, in words (`PATIENT_ARCHIVED`). | 2026-10-03 |
| D104 | **The patients list is newest first** (the user): by patient number, the latest at the top, with nothing typed; a search puts the best match first — the patient number, then the mobile, then names that start with the words, hold them, or come close. | 2026-10-03 |

## 3. Users and roles

### 3.1 Clinic roles

A person's access to a clinic is a **membership** (`clinic_members`) with one
role. Identity (who you are) is kept apart from membership (what you may do in
which clinic).

| Role | Who | Access |
|---|---|---|
| **OWNER** | The person who registered the clinic. Exactly one per clinic (D24). | Everything in the clinic, always. Can never be restricted, deactivated or removed. |
| **DOCTOR** | A doctor invited by the owner. | The permissions they are given (default preset §8.3), **limited to their own patients** (D3). The only role that writes prescriptions. |
| **STAFF** | Reception, assistants, nurses, managers. | Exactly the permissions they are given (§8). |

**An owner may also be a doctor.** They then have a doctor profile (`doctors`
row) besides their OWNER membership: they see every patient (as owner) and can
be booked, run a queue and write prescriptions (as doctor). This is a toggle at
registration ("I also see patients") and in Team.

### 3.2 Platform role

| Role | Who | Access |
|---|---|---|
| **DEV** | The platform admin (you). | The developer console only (§20): clinics, accounts, subscriptions, platform settings, the error log. **Never any clinic's patients, clinical or financial records.** Added from the Supabase dashboard, never by signing up. Holds no clinic membership. |

The platform role lives on `profiles.platform_role`; it is never read from or
written to Supabase `user_metadata` (users can edit their own metadata — Brio
BUG-17).

### 3.3 Words

A screen says **clinic**, **patient**, **doctor**, **team**. Identifiers say the
same (`clinic_id`, `patientId`) — there is no internal/external split as in
Brio's `bakery`/`business`.

## 4. Scope

### 4.1 V1 (Phases 0 – 13)

- Sign-up with a free trial (one per mobile); sign-in by email or mobile;
  email confirmation; password reset; light and dark themes.
- Platform settings and the subscription: trial, expiry warnings, grace,
  read-only; extension by the admin.
- Team: invite doctors and staff by email; roles; granular permissions with
  presets; per-doctor consultation fees; deactivate.
- Clinic settings: profile and logo, paper size, price list, appointment
  types, expense categories, holidays and leave.
- Patients: create, search, profile, history, allergies/conditions/medications,
  archive.
- Appointments: calendar, book, reschedule, cancel, statuses, no double-booking,
  walk-ins with tokens, today's queue per doctor.
- Visits: complaint, diagnosis, notes, vitals, follow-up date.
- Prescriptions, with a PDF on the clinic's letterhead.
- Treatments across visits, and the follow-ups views (today, overdue, upcoming,
  lapsed, completed) with call outcomes.
- Bills from the price list, payments, refunds, patient balance, outstanding;
  bill PDF.
- Expenses.
- Home dashboard and daily/monthly reports.
- The clinic's activity log (owner).
- Developer console.
- WhatsApp click-to-send for reminders, bills and prescriptions.
- Patient import from CSV/Excel; CSV export of the clinic's data (owner).
- Day-end collection summary; revenue by doctor; plan payment receipts.
- Landing page with pricing, privacy, terms; installable PWA, online-only
  with nothing lost when the connection drops.
- Deleting a clinic: the owner requests, the admin deletes after a cooling-off.

### 4.2 Later — in the roadmap but unscheduled (§42)

Dental module; inventory; payroll; file attachments; doctor working hours and
slot suggestions; automated appointment reminders (WhatsApp API/SMS/email); a
waiting-room token display; patient self-booking; two-factor authentication;
online payment of
the subscription; multi-clinic membership and a clinic switcher; ownership
transfer; GST billing; pre-printed-pad printing and thermal receipts; Google /
phone-OTP sign-in; realtime queue; OpenAPI; third-party monitoring; multiple
languages.

### 4.3 Out of scope

Patient-facing logins or portals; telemedicine; insurance claims; lab or
pharmacy integrations; e-prescription networks; an Android/iOS store app;
anything the plan does not name.

---

# Part II — Specifications

## 5. Sign-up, sign-in and accounts

Built on **Supabase Auth** with our own session handling, exactly as Brio
(AGENTS.md §9): HttpOnly cookies set by the server, never `localStorage`; the
response body carries a session view, never a token.

### 5.1 Sign-up (owner) — `/register`

Two steps on one screen:

1. **You:** full name, email, mobile number (+91) — either one signs in
   (D39) — password (min 8, never trimmed or altered), and "I also see
   patients" (creates the owner's doctor profile; its fee and registration
   number are set in Team).
2. **Your clinic:** clinic name, clinic type (Dental, General, Physiotherapy,
   Dermatology, Other), city, address, clinic phone (optional).

The server, in order:

1. Creates the auth user (unconfirmed).
2. Calls `register_clinic` (service role, one transaction): profile, clinic,
   OWNER membership, the doctor profile if asked, the subscription row — a
   `TRIAL` valid for `trial_days` (§6) from today in the clinic's timezone, or
   **no trial** when the owner's mobile has had one before (§7.6) — the
   trial claim, the seeded appointment types (D32) and expense categories
   (D40), and one price-list entry ("Consultation", ₹0, for the owner to
   price).
3. Sends the confirmation email (§22). A failed send never undoes the account;
   it is logged and the confirm screen offers **Resend**.
4. If step 2 fails, deletes the auth user (compensation) and answers with the
   catalogue error.

**Email must be confirmed before first use** (Q17). Email and mobile are unique
per account.

### 5.2 Sign-in — `/login`

Email **or** mobile number, and password (D39). The server resolves the
identifier as Brio does: an email as typed, or a mobile normalised to +91
E.164 (`9876543210`, `09876543210` and `+91 98765 43210` are one account). A
wrong identifier and a wrong password answer the same
(`AUTH_INVALID_CREDENTIALS`). A deactivated member, or an invitee who has not accepted,
cannot sign in to the clinic (`AUTH_MEMBERSHIP_INACTIVE`). A DEV lands on
`/admin`; everyone else on `/home`. A `next` parameter returns them where they
were going (same-origin paths only — no open redirect).

### 5.3 Password reset — `/forgot-password` → `/reset-password`

A recovery link (Supabase `generateLink({ type: "recovery" })`) sent through our
mail service; the link opens `/reset-password`, which sets a new password and
signs the person in. The request answers the same whether or not the email
exists (no account enumeration). (Brio used a temporary password; ClinicDesk
uses a link — Q18.)

### 5.4 My account — `/settings/account`

Full name, mobile, theme (System, Light, Dark — D36; kept per device), change
password (current + new), sign out (asks first). Changing the sign-in email is
**later**. Name, mobile and the password each open a sheet of their own; the
theme switches on the screen (D72). The Settings index (`/settings`) leads to
it, then to the clinic's setup and the owner's screens, each shown to those
who may open it (D71).

### 5.5 Sessions and the proxy

As Brio: `src/proxy.ts` keeps a signed-out visitor out of app screens (cookie
presence only — not authorization), renews an expired access token before a
screen is drawn, and the root layout hands `AuthProvider` the session view. The
session view carries the profile, the active membership (role, permissions,
doctor id) and the clinic's **subscription state** (§7), so the shell can show
the plan banner and read-only mode without another request.

## 6. Platform settings

**Business rules are data, not code (D22).** Every rule the platform admin might
want to tune lives in one typed row, `platform_settings`, which only a DEV
changes, from the developer console (§20.4). The code holds **defaults**
(seeded by the migration) and **bounds** (what a setting may be set to), never
the live value.

| Setting | Default | Bounds | Used by |
|---|---|---|---|
| `trial_days` | 30 | 0 – 365 | New sign-ups only (§5.1). |
| `monthly_price_paise` | 30 000 (₹300) | 0 – 10 000 000 | Pre-fills a Monthly extension; shown on the landing page and the Plan screen. |
| `yearly_price_paise` | 300 000 (₹3,000) | 0 – 100 000 000 | Same, for Yearly. |
| `expiry_warning_days` | 7 | 0 – 60 | When the "plan ends soon" banner starts (§7.2). |
| `grace_days` | 7 | 0 – 60 | Full access after the validity date, before read-only. |
| `expiry_notice_days` | {7, 1} | each 1 – 60 | Days before expiry an email is sent (§22). |
| `audit_keep_days` | 30 | 7 – 3 650 | Audit purge (§19, §36). |
| `error_log_keep_days` | 7 | 1 – 365 | Error-log purge (§36). |
| `invite_valid_days` | 7 | 1 – 30 | How long an invite link works (§8.4). |
| `follow_up_lapsed_days` | 30 | 7 – 365 | When an overdue follow-up becomes "lapsed" (§14.3). |
| `deletion_cooling_days` | 7 | 0 – 90 | How long after an owner's deletion request the admin may delete the clinic (§9.1). |
| `renewal_contact_name` | — | ≤ 100 | Plan screen, landing page, expiry emails. |
| `renewal_contact_phone` | — | +91 mobile | Same; a **Call** and a **WhatsApp** link. |
| `renewal_contact_email` | — | email | Same. |
| `renewal_upi_id` | — | UPI id | Shown with the prices, for paying. |
| `business_name` | — | ≤ 100 | The platform's own name on plan receipts (§7.5). |
| `business_address` | — | ≤ 500 | Its address on plan receipts. |

Rules:

- **One row** (`id boolean primary key default true check (id)`), typed
  columns, a `CHECK` for every bound. The TS defaults and bounds
  (`src/constants/platform.ts`) are kept equal to the migration's by a DB
  contract test.
- **Read:** the database reads it directly (`subscription_state()`, the purge
  functions). The server reads it through `getPlatformSettings()`
  (`src/lib/platform/settings.ts`, service role, memoised per request). Clinic
  users never read the table; what they may see (prices, contact, their own
  dates) comes through the API.
- **Write:** only `update_platform_settings` (DEV, via the console), which
  validates bounds, records `updated_by`/`updated_at`, and writes a platform
  audit row with the old and new values.
- **Effect is immediate** and never retroactive: a new `trial_days` applies to
  clinics that sign up afterwards; a new price pre-fills the next extension (a
  recorded payment keeps the amount it was recorded with); new `grace_days`
  or `expiry_warning_days` change every clinic's state at once (that is the
  point); retention applies at the next purge.
- **Contact and business details unset** are simply not shown; the release
  checklist (R13.8) requires them set before v1.0.0.

What stays in code: vocabularies (statuses, roles, permissions), transition
tables, validation bounds that protect columns (lengths, money limits), and UI
timings. A value belongs in `platform_settings` when the platform admin could
reasonably want it different without a deploy.

## 7. Subscription and trial

### 7.1 Model

One subscription row per clinic: `plan` (`TRIAL`, `MONTHLY`, `YEARLY`) and
`valid_until` — the **last day** of access, inclusive, in the clinic's timezone.
Every extension is a row in `subscription_payments` (amount, plan, method,
reference, date paid, the validity it moved from and to, who recorded it).
Payments happen outside the app; the console only records them.

### 7.2 States

Derived, never stored — `subscription_state(clinic)` in SQL and
`subscriptionState()` in TS, kept equal by a test. With `today` in the
clinic's timezone, and `warning = expiry_warning_days`, `grace = grace_days`
from §6:

| State | When | What the clinic sees |
|---|---|---|
| `ACTIVE` | today ≤ valid_until − warning | Nothing. |
| `EXPIRING` | valid_until − warning < today ≤ valid_until | A quiet banner (D73): "Your plan ends on 12 Nov." + how to renew (owner); a quiet line for others. |
| `GRACE` | valid_until < today ≤ valid_until + grace | A coral banner: "Your plan ended on 12 Nov. The clinic becomes view-only on 20 Nov." Full access. |
| `READ_ONLY` | today > valid_until + grace | Persistent banner; every create/edit/delete control is disabled with the reason; the server and the database refuse writes (`CLINIC_PLAN_EXPIRED`, 422). |

**What still works in `READ_ONLY`:** signing in and out; reading and searching
everything; viewing, downloading, sharing and printing existing bills and
prescriptions; changing one's own password; the Plan screen; deleting the
clinic account.

### 7.3 Enforcement

In the database, not only the UI: every write policy on a clinic-owned table
includes `clinic_can_write(clinic_id)` (false in `READ_ONLY`), and every write
RPC checks it first. The API maps the refusal to `CLINIC_PLAN_EXPIRED`. A test
proves a `READ_ONLY` clinic's owner, holding a valid token, cannot insert
through the REST API directly.

### 7.4 Extending (the admin)

From the console (§20.3): **Extend plan** →

- **Monthly**: `valid_until` = (later of today − 1 and current `valid_until`) +
  1 calendar month; amount pre-filled `monthly_price_paise`.
- **Yearly**: the same + 12 calendar months; amount `yearly_price_paise`.
- **Set date**: any date (to correct, or to give days free), amount may be ₹0,
  a reason is required.

Paying early never loses days. Method (cash, UPI, bank transfer, card, other),
reference and date paid are recorded. One transaction
(`extend_clinic_subscription`, DEV only): the payment row, the new validity,
the plan, a platform audit row. The owner is emailed a confirmation (§22).

### 7.5 The owner's Plan screen — `/settings/plan`

Current plan and state, valid until, the prices and the renewal contact from
§6 (Call, WhatsApp, email, UPI id), and the payment history. Visible to the
owner only.

**Receipts (D58):** every recorded payment has a **receipt PDF** — the
platform's business name and address (§6), the clinic, the plan, the period,
the amount, the method and reference, and a receipt number from one
platform-wide, per-financial-year counter (`R/2026-27/0001`). Generated on
demand, never stored; also linked from the "Plan extended" email. No GST (a
GST invoice is later).

### 7.6 One trial per mobile (D42)

`trial_claims` is a platform table that remembers every owner mobile that has
started a trial — **as an HMAC of the E.164 number** keyed by
`TRIAL_CLAIM_SECRET` (server env), never the number itself — and outlives the
clinic it was for, so deleting a clinic and registering again does not restart
the trial.

At registration, a mobile already claimed gets **no trial**: the clinic is
created with `valid_until` set so that it is `READ_ONLY` at once, and the
owner lands on a screen that says the free trial was used before and shows the
renewal contact (§6). The console marks such clinics **No trial** (§20) so the
admin can activate them on payment. The privacy policy says the hash is kept,
and why (§21).

## 8. Team, roles and permissions

### 8.1 The permission catalogue

Granular permissions, as the draft asked, stored on the membership
(`clinic_members.permissions text[]`), named in `src/constants/permissions.ts`
and mirrored by a database `CHECK` (kept equal by a test).

| Permission | Allows |
|---|---|
| `patients.view` | See patients and their contact details. |
| `patients.create` | Add patients. |
| `patients.edit` | Edit patients; archive and restore. |
| `appointments.view` | See the calendar and today's queue. |
| `appointments.create` | Book appointments; add walk-ins. |
| `appointments.edit` | Reschedule; confirm; mark arrived and no-show. |
| `appointments.cancel` | Cancel appointments. |
| `visits.view` | See clinical records: visits, vitals, alerts, prescriptions, treatments, follow-ups. |
| `visits.create` | Start visits; record vitals. |
| `visits.edit` | Write and correct clinical notes, alerts, treatments and follow-ups. |
| `prescriptions.write` | Type a prescription on the visit doctor's behalf (D45). A doctor writes their own without it. |
| `payments.view` | See bills, payments and balances. |
| `payments.create` | Create bills from the price list; record payments; mark a visit No charge. |
| `payments.discount` | Give a discount, or change a line's price from the price list (D29). |
| `payments.edit` | Void bills and payments; record refunds. |
| `expenses.view` | See expenses. |
| `expenses.create` | Add expenses. |
| `expenses.edit` | Edit and archive expenses. |
| `reports.view` | Home's money figures and the reports. |
| `team.manage` | Invite members, change their permissions, deactivate them. |
| `settings.manage` | Clinic details, logo, price list, holidays and leave. |

Inventory permissions (`inventory.view`, `inventory.manage`) arrive with the
inventory module (§42).

### 8.2 Rules

1. **The owner holds every permission implicitly** — nothing is stored, nothing
   can be removed.
2. **Patient data needs `patients.view`.** Any `appointments.*`, `visits.*`,
   `prescriptions.*` or `payments.*` permission implies it, and so do
   `patients.create` and `patients.edit` (D102);
   `prescriptions.write` also implies `visits.view`, and `payments.discount`
   implies `payments.create` (`PERMISSION_DEPENDENCIES`). The editor ticks
   them automatically and the server refuses a set that breaks the rule.
3. **Doctors are scoped (D3).** Whatever a doctor's permissions, every
   patient-linked read and write is limited to their own patients
   (`can_see_patient`, §27.3). Staff with `patients.view` see every patient.
4. **A prescription belongs to the visit's doctor**, whose profile must carry
   a registration number. The doctor writes it (no permission needed for
   their own visits), or a staff member with `prescriptions.write` types it
   for them (D45); `entered_by` records who typed it, and the printout carries
   the doctor's name for the doctor to sign. No one else writes one.
5. **No escalation.** A member with `team.manage` grants only permissions they
   hold, never `team.manage` itself (only the owner does), and never edits the
   owner or themselves.
6. **Deactivation is immediate.** Every RLS helper checks `status = 'ACTIVE'`,
   so a deactivated member's next request is refused; the record of what they
   did (`created_by`, `updated_by`) stays.
7. **The last owner** cannot be deactivated; ownership transfer is later (D24).

### 8.3 Presets

Presets fill the checkboxes; the owner can change any of them afterwards.
Kept in `PERMISSION_PRESETS`.

| Preset | Permissions |
|---|---|
| **Doctor** (default for DOCTOR) | patients.view/create/edit · appointments.view/create/edit/cancel · visits.view/create/edit · payments.view/create/discount |
| **Receptionist** | patients.view/create/edit · appointments.view/create/edit/cancel · payments.view/create (D88) |
| **Assistant / Nurse** | patients.view · appointments.view/edit · visits.view/create/edit · prescriptions.write |
| **Clinic manager** | every permission except `settings.manage` |
| **Custom** | none ticked |

### 8.4 Inviting — `/team`

The owner (or `team.manage`) enters: name, email, role (Doctor or Staff), job
title (staff), a preset and the permission checkboxes, and for a doctor:
specialization, qualifications (e.g. "BDS, MDS"), registration number, and
consultation fee (optional — overrides the price list's Consultation for this
doctor, D26).

The server makes the account (no password yet, through the admin API), a
membership with `status = 'INVITED'`, the doctor profile if any, and an
**invite token of its own** (D63) — random, emailed in the link, only its hash
kept beside `invite_expires_at` — and sends the invite email (§22). The link
works for `invite_valid_days` (§6); `/accept-invite` checks the token on the
server, which then sets the password and mobile and confirms the email.
**Resend** issues a new link; **Revoke** removes the invite. An email that
already belongs to an active member of any clinic is refused in V1 (one clinic
per person — D23).

### 8.5 Accepting — `/accept-invite`

The invitee sees the clinic's name and their role, confirms their name, adds
their mobile, sets a password, and lands on Home as an ACTIVE member.

### 8.6 The team list

Doctors and staff together, with role, job title, status (Invited, Active,
Inactive) and, for doctors, specialization. Member detail: edit permissions,
job title, doctor details; deactivate / reactivate (asks first).

## 9. Clinic settings

- **Clinic details — `/settings/clinic`** (`settings.manage`): name, type,
  phone, email, address, city, GSTIN (optional, format-checked), timezone
  (Asia/Kolkata in V1; the column exists), **paper size** for bills and
  prescriptions (A4 or A5, D28), and **when the consultation fee is
  collected** (at arrival or after the consultation, D44).
- **Logo:** the **only file a user uploads** (AGENTS.md §20): ≤ 500 KB, PNG/JPG/
  WebP typed by its first bytes, private bucket `clinic-logos` at
  `clinics/{clinic_id}/logo/{id}`, read back only through the API. A new logo
  replaces the old only after it is stored; it may be removed, asked first
  (D79). It heads the bill and the prescription. The screen: the logo at the
  top, the details as rows opening one sheet, paper size and fee timing saved
  as they are picked (D78).
- **Price list — `/settings/price-list`** (`settings.manage`): services with
  name, category (Consultation, Procedure, Investigation, Medicine, Other) and
  price. Archived, never deleted (bills keep their own copy of the line).
- **Appointment types — `/settings/appointment-types`** (`settings.manage`,
  D32): name and default duration; seeded with Consultation (15), Follow-up
  (10), Procedure (30), Review (15), Other (15); archived, never deleted.
- **Expense categories — `/settings/expense-categories`** (`settings.manage`,
  D40): seeded with the nine in §16; renamed or archived; a category in use
  is never deleted.
- **Holidays and leave — `/settings/closures`** (`settings.manage`): a date
  range, the whole clinic or one doctor, and a reason. Booking refuses those
  days. Adding a closure over existing appointments lists them (it does not
  cancel them; built with appointments in R5.1, D87). A closure starts today
  or later and lasts at most 366 days (D85); closures for the same people do
  not overlap (D86); past ones are kept behind **Show past**, and only one not
  yet over is removed, asked first (D84).
- **Import patients — `/settings/import`** (owner, D51): see §10.5.
- **Export — `/settings/export`** (owner, D41): one CSV per area — patients,
  appointments, visits (with vitals and diagnosis), prescriptions,
  treatments, bills and their lines, payments, expenses — streamed on demand,
  never stored, `no-store`. Allowed in `READ_ONLY` too. Each export is
  audited.

### 9.1 Deleting a clinic (D37)

- **The owner requests it — `/settings/delete-clinic`:** types the clinic's
  name and their password, after a prompt to export first. The clinic is
  marked for deletion on `today + deletion_cooling_days` (§6); everyone sees a
  banner with the date; the owner is emailed (§22). The clinic keeps working
  until then.
- **The owner may cancel** any time before it is deleted; they are emailed.
- **The admin deletes it** from the console (§20) once the date has passed,
  typing the clinic's name to confirm. `delete_clinic` (service role, one
  transaction) removes the clinic and every row that hangs from it, the logo,
  and the auth users of members who belong to no other clinic — but **not**
  the trial claim (§7.6). The owner is emailed that it is done.
- Every clinic-owned table cascades from `clinics` (AGENTS.md §28); the
  deletion test finds every one empty afterwards.

## 10. Patients

### 10.1 The record

Patient number (`P-1001`, a per-clinic counter, never reused), and:

- **Required (D33):** full name, mobile, date of birth **or age** (an age
  stores an estimated date of birth with `dob_is_estimated`), gender (Male,
  Female, Other) — enough to find, call and prescribe.
- **Optional:** alternate phone, email, address, emergency contact name and
  phone, assigned doctor, non-clinical notes.

- **A mobile number is not unique** — families share one. Adding a patient
  whose number is already on file shows those patients first ("Already here?")
  and lets the person continue.
- **An age instead of a date of birth** is given in years, 0 – 120
  (`MAX_PATIENT_AGE`), and stored as today that many years ago; a baby is
  entered by their date of birth (D100). Ages show as "34 y", and under a
  year as "8 mo".
- **A doctor who adds a patient becomes their assigned doctor** by default, so
  the patient is theirs (D3) — and stays theirs if they assign another doctor
  (D99).
- **Archived, never deleted** (`archived_at`, `archived_by`): an archived
  patient leaves the lists and search, keeps every record, and can be
  restored. Until then they are read-only (D103).

### 10.2 Patients list — `/patients`

Search by name (fuzzy, trigram), mobile (on its digits however typed), or
patient number — sent in the request's body, never its address (D98); the
best match first, and newest first with nothing typed (D104). Each row: name,
age and gender, mobile, patient number, last
visit ("Last visit: 28 Sep"), and a balance chip when they owe. Paged
(**Show more**, `PAGE_SIZE`). Tabs: All · Owing (`payments.view`) · Archived
(`patients.edit`). A doctor sees only their own patients, without a filter to
choose. The last visit comes with Phase 6, the Owing tab and the balance chip
with Phase 8 (D101).

### 10.3 Patient profile — `/patients/[id]`

One screen that tells the patient's current state without opening others:

1. **Header:** name, age · gender, mobile (Call, WhatsApp), patient number,
   assigned doctor; **alerts** (allergies in the danger tone first, then
   conditions and medications).
2. **Next appointment** (date, time, doctor) or **Book**.
3. **Open treatments:** name, status, next due ("Overdue by 4 days").
4. **Balance** (`payments.view`): due or advance; **Record payment**, **New
   bill**.
5. **History:** a timeline of visits (date, doctor, diagnosis, treatments
   worked on, prescription), appointments (cancelled and no-show included),
   bills and payments — each part shown only with its permission.

Desktop lays these out in two columns (state on the left, history on the
right); a phone stacks them in that order. Phase 4 builds the header, the
alerts and the details; each later phase adds its part as its records arrive
(D101).

### 10.4 Alerts — allergies, conditions, current medications

`patient_alerts`: kind (Allergy, Condition, Medication), a label ("Penicillin"),
an optional note, active or not. Read with `visits.view`, changed with
`visits.edit`. Shown on the profile header, at the top of every visit, and
above the prescription editor.

### 10.5 Importing patients — `/settings/import` (D51)

For a clinic moving from Excel or other software. Owner only.

1. **Choose a file** — CSV or Excel (`.xlsx`). It is **parsed in the browser**;
   the file itself never leaves the device and is never stored.
2. **Map columns** — each of the sheet's columns to a patient field (name,
   mobile, date of birth or age, gender, alternate phone, email, address,
   emergency contact, notes), guessed from the headers.
3. **Preview** — every row checked with the same schema as the patient form
   (§10.1): rows with errors listed with the reason; possible duplicates
   (same mobile and a similar name, in the file or already in the clinic)
   flagged, skipped by default.
4. **Import** — the valid rows are sent in batches of `IMPORT_BATCH_SIZE`
   (`POST /api/patients/import`, idempotent per batch), validated again on the
   server, numbered from the clinic's counter, and audited as one import.
   A summary says how many were imported, skipped and refused, and the refused
   rows can be downloaded as a CSV to fix and try again.

Up to `MAX_IMPORT_ROWS` (10 000) rows per import. Patients only: visits,
bills and balances stay in the old system.

## 11. Appointments, calendar and the queue

### 11.1 The appointment

Patient, doctor, date and time (5-minute steps), duration, type, notes. Types
are the clinic's own (`appointment_types`, §9, D32); picking one fills its
default duration, which may be changed per booking.

**Rules, enforced by the server and the database:**

- **No double-booking (D7):** a `BOOKED` appointment's time range may not
  overlap another live `BOOKED` appointment of the same doctor — a Postgres
  exclusion constraint (`btree_gist`, `tstzrange && `) excluding `CANCELLED`
  and `NO_SHOW`. A clash answers `APPOINTMENT_SLOT_TAKEN` naming the clashing
  time; the sheet keeps what was typed.
- **Not on a closed day:** a clinic holiday, or the doctor's leave
  (`APPOINTMENT_ON_CLOSED_DAY`).
- **Not in the past** when booked (a walk-in is "now").
- **The doctor must be active** and in the same clinic.

### 11.2 Statuses

`SCHEDULED`, `CONFIRMED`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`,
`NO_SHOW`. Moves follow one table (`APPOINTMENT_STATUS_TRANSITIONS`, mirrored by
`appointment_status_next()` in SQL, kept equal by a test):

| From | May go to |
|---|---|
| SCHEDULED | CONFIRMED, ARRIVED, CANCELLED, NO_SHOW |
| CONFIRMED | ARRIVED, SCHEDULED, CANCELLED, NO_SHOW |
| ARRIVED | IN_PROGRESS, SCHEDULED, CANCELLED |
| IN_PROGRESS | COMPLETED, ARRIVED |
| NO_SHOW | ARRIVED (came late) |
| COMPLETED | — |
| CANCELLED | — |

`IN_PROGRESS` and `COMPLETED` are reached only through the queue — **Send in**,
**Done**, **Next patient** (§11.4) — which open and close the visit with them
(§12.1). Cancelling asks first and takes a reason.

### 11.3 Arrivals, walk-ins and tokens

- **Add walk-in** (`appointments.create`): patient (search, or quick-add with
  name, mobile, age, gender), doctor, type. Creates an appointment with
  `source = 'WALK_IN'`, status `ARRIVED`, at now. A walk-in does not hold a
  slot, so it never clashes.
- **Arrived** (`appointments.edit`): a booked patient is at the desk.
- **Tokens:** every patient who arrives — walk-in, or booked and marked
  **Arrived** — takes the next token for that doctor that day (`#7`), from a
  per-doctor-per-day counter taken under a row lock. Tokens restart each day
  in the clinic's timezone.
- **Fee at arrival (D44):** in a clinic that collects the consultation fee at
  arrival, arriving (or adding a walk-in) continues to **Collect fee**: the
  doctor's consultation fee (D26) pre-filled, the method, **Issue and
  collect** — one transaction that issues the consultation bill (linked to the
  appointment) and records its payment. **Skip** leaves it for checkout. The
  step is offered only with `payments.create`.

### 11.4 Today's queue — `/queue`

**Run by the front desk (D43).** Reception sees a tab per doctor (or all
doctors); a doctor sees their own.

| Column | Holds | Actions |
|---|---|---|
| **Waiting** | Arrived, by token: name, token, booked time or "Walk-in", fee paid or not, wait so far. | **Send in** · No-show · Cancel |
| **With doctor** | The patient in the room. | **Done** · Back to waiting |
| **Still to come** | Booked for later today. | Arrived · No-show |
| **To bill** (`payments.view`) | Finished visits waiting for checkout, from any day (§15.6). | **Bill** · No charge |
| **Done** | Finished today and settled (billed or no charge). | — |

- **Send in** (`appointments.edit`): the appointment goes `IN_PROGRESS` and its
  visit opens by itself (§12.1). Any waiting patient may be sent in, not only
  the lowest token.
- **Done** (`appointments.edit`): the appointment goes `COMPLETED` and its visit
  closes — whatever was or was not recorded — and the patient moves to **To
  bill**, or straight to **Done** when there is nothing to bill (§15.6).
- **Next patient** — the doctor's one button, on their queue and in the visit
  workspace: marks the patient with them Done and sends in the lowest waiting
  token, in one transaction (`next_patient`). A doctor can run a session with
  this button alone — or never touch the app.
- Sending in a patient while another is still with that doctor asks first
  ("Rahul is still with Dr. Maya — mark him done?").
- A patient still "With doctor" when the day ends heads the next day's queue,
  to be marked done.
- Phone: the columns are tabs with counts. Desktop: side by side.

Refreshes every `QUEUE_REFRESH_MS` (15 s) and on focus; realtime is later
(D34).

### 11.5 Calendar — `/appointments`

- **Phone:** one day as a list by time, a doctor filter, a date strip; **＋**
  books.
- **Tablet/desktop:** day view with a column per doctor; week view for one
  doctor; closures shaded; tap an empty time to book there.
- Each appointment: time, patient, type, status pill. Opening one shows its
  detail with the actions its status allows; **Reschedule** reopens the
  booking sheet (same rules).

## 12. Visits and clinical records

### 12.1 The visit

A visit is one consultation: patient, doctor, optional appointment (one visit
per appointment), visit date, complaint, diagnosis, notes, follow-up date,
status `OPEN` → `COMPLETED`, and a **billing state** (§15.6).

- **Opens by itself** when the patient is sent in (§11.4) — empty, ready for
  whatever the doctor or an assistant records. A doctor may also start one
  from a patient's profile (**New visit**) when there is no appointment.
- **Closes by itself** with **Done** or **Next patient**. A visit may close
  with nothing recorded: the app never makes a doctor fill anything in to
  finish a consultation (D43).
- **Who records:** the doctor, or an assistant typing for them — vitals and
  notes with `visits.create`/`visits.edit`, the prescription with
  `prescriptions.write` (D45) — during the visit or after it closes.
- **Corrections:** a completed visit can still be corrected by a member with
  `visits.edit`; `updated_by` and `updated_at` record who and when (the audit
  trail adds what changed, for `audit_keep_days`).

### 12.2 The visit workspace — `/visits/[id]`

Built for the doctor — and for an assistant typing for them — on a phone or at
a desk. **Every section is optional:**

1. Patient header with **alerts** (always visible), the token, and **Next
   patient** (the doctor).
2. **Vitals:** BP (systolic/diastolic), pulse, temperature, SpO₂, respiratory
   rate, weight, height; BMI computed for display. Each field checked against
   `VITAL_LIMITS`. Temperature in °F (D31). Often taken by an assistant before
   the patient goes in.
3. **Complaint, diagnosis, notes.**
4. **Treatments:** start a new one, or record progress on an open one (§14).
5. **Prescription** (§13).
6. **Follow-up:** a date ("Review in 7 days" chips), or **Book next
   appointment** pre-filled.
7. **Bill now** (`payments.create`): for a clinic that bills in the room;
   otherwise the front desk bills at checkout (§15.6).

Saving is per section, so a long visit is never lost to one failed request.

## 13. Prescriptions

One prescription per visit, always in the visit doctor's name — written by the
doctor, or typed for them by a staff member with `prescriptions.write`, who is
recorded as `entered_by` (§8.2 rule 4, D45):

- **Items:** medicine (free text, with suggestions from this clinic's past
  prescriptions — no drug database), strength ("500 mg"), dose ("1 tab"),
  frequency (`1-0-1`, `1-1-1`, `0-0-1`, SOS … from `PRESCRIPTION_FREQUENCIES`,
  or typed), timing (before food, after food, with food, empty stomach,
  bedtime), duration in days, instructions. Reorderable.
- **Advice** (free text) and the visit's **follow-up date**.
- **Repeat last prescription (D54):** one tap copies this patient's most
  recent prescription — from any doctor the current doctor may see — into
  this visit, to edit before saving.
- **Templates (D54):** a doctor saves the current items and advice as a named
  template ("Post-extraction", "Viral fever") and applies one in a tap; a
  template adds its items to what is already there. Templates belong to the
  doctor (`prescription_templates`), are edited or archived in My account,
  and are offered to whoever types for that doctor.
- **Allergy check:** if a medicine's name contains an active allergy's label,
  the line shows a warning before saving (a text match, not a clinical
  database).
- **The PDF** (§33), A4 or A5 by the clinic's paper size (D28): the clinic's
  letterhead (logo, name, address, phone), the doctor's name, qualifications
  and registration number, the patient's name,
  age/gender and number, the date, the vitals recorded, the diagnosis (if the
  doctor chooses to print it), the items, the advice and the follow-up date,
  and a signature line. **Generated on demand, never stored.** Share (Web
  Share API with the file), download, print.

## 14. Treatments and follow-ups

### 14.1 Treatments

A treatment is a course of care that may span visits (a root canal over three
sittings). Patient, doctor, name (suggested from the price list's procedures),
description, estimated cost (information only — money is billed through bills),
started on, completed on, **next due on**.

Statuses `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED`
(`TREATMENT_STATUS_TRANSITIONS`, mirrored in SQL):

| From | May go to |
|---|---|
| PLANNED | IN_PROGRESS, ON_HOLD, CANCELLED |
| IN_PROGRESS | ON_HOLD, COMPLETED, CANCELLED |
| ON_HOLD | IN_PROGRESS, CANCELLED |
| COMPLETED | — |
| CANCELLED | — |

A visit that works on a treatment records a **session** (`treatment_sessions`:
the visit, a note) so the treatment's history reads visit by visit.

### 14.2 Follow-ups

A follow-up is either an **open treatment's next due date** or a **visit's
follow-up date**. A follow-up is **done** when the patient has an appointment
booked on or after it, or a later visit, or the treatment is completed or
cancelled.

### 14.3 The follow-ups screen — `/follow-ups`

Tabs (with counts), computed by the database from one view
(`follow_up_items`), scoped by `can_see_patient`:

| Tab | Holds |
|---|---|
| **Today** | Due today. |
| **Overdue** | Due before today, up to `follow_up_lapsed_days` (§6) ago. |
| **Upcoming** | Due in the next 30 days. |
| **Lapsed** | Overdue by more than `follow_up_lapsed_days` — "patients who haven't returned". |
| **Completed** | Treatments completed in the last 30 days. |

Each row: patient, treatment or "Follow-up", doctor, due label ("Due
tomorrow", "Overdue by 4 days"), last contact. Actions: **Call** (`tel:`),
**Remind on WhatsApp** (§22.1), **Book** (pre-filled appointment), **Mark
contacted** — outcome (Reached, No answer, Booked, Declined, Reminder sent), a note, and an optional "remind me on"
date that hides the row until then (`follow_up_contacts`).

## 15. Billing and payments

### 15.1 Money rules

Integer paise everywhere; `src/lib/money.ts` is the only place that converts;
screens show money through `formatPaise`; a bill's totals come from one formula
(`src/features/billing/totals.ts`) used by the screen's preview and by the
server, and the database recomputes and checks them (AGENTS.md §16).

### 15.2 Bills

- **New bill — `/billing/new`** (`payments.create`): from the **To bill** list
  or a visit (pre-filled: the consultation at the visit doctor's fee — D26 —
  unless it was already billed at arrival, and the treatments worked on), from
  **Collect fee** at arrival (§11.3), or from a patient. Lines come from the
  price list or are typed as a custom line (description + price); quantity;
  notes. **With `payments.discount`** (D29): a changed unit price, and a
  discount as an amount or a percentage (stored as paise); without it, prices
  are the price list's and there is no discount. A live preview shows
  subtotal, discount, total and the patient's balance after.
- **Collect now:** an optional payment (amount, method, reference) recorded in
  the same transaction.
- **Issue:** `create_bill` — one transaction, an idempotency key (a double tap
  makes one bill), the next number of the clinic's **financial year**
  (`2026-27/0001`, April – March in the clinic's timezone — D27) from its
  counter, the totals recomputed, the prices checked against the price list
  and the doctor's fee unless the issuer holds `payments.discount`, and the
  visit marked Billed. A bill is issued final.
- **Issued bills are never edited.** A mistake is **voided** (`payments.edit`,
  asks first, a reason) and a new bill issued. A void bill stays visible,
  marked Void, and leaves the balance.
- **Paid state of a bill** (Paid / Part paid / Unpaid) is computed: the
  patient's net payments settle their issued bills oldest first
  (`bill_settlement` view). The patient's balance is the truth; the bill's
  state is a reading of it.

### 15.3 Payments

- **Record payment** (`payments.create`): patient, amount, method (Cash, UPI,
  Card, Bank transfer, Other), reference (UPI ref, cheque no.), when paid
  (defaults to now), note. Recorded against the patient; an amount beyond what
  is owed becomes an **advance** (negative balance), used by later bills.
- **Refund** (`payments.edit`): money returned — up to what was paid in.
- **Void** (`payments.edit`, asks first, a reason): a payment entered by
  mistake. Voided payments stay visible and leave the balance.
- Every payment records who received it (`received_by`) and is idempotent.

### 15.4 Balance and outstanding

`patient_balances` view: billed (issued bills) − paid + refunded. Positive is
**due**, negative is **advance**.

**Billing — `/billing`** (`payments.view`) has tabs: **To bill** (§15.6),
**Bills** (number, patient, date, total, state; filters by date and state),
**Payments** (date, patient, amount, method, received by), **Outstanding**
(patients who owe, most first, with Call / WhatsApp / Record payment).

### 15.5 The bill PDF

A4 or A5 by the clinic's paper size (D28). Letterhead (logo, name, address,
phone, GSTIN if set), bill number and date, patient name, number and mobile,
the lines, subtotal, discount, total, paid against this bill, due on this bill,
the patient's overall balance, and a small "Generated with ClinicDesk" footer
(D30). On demand, never stored; share, download, print.

### 15.6 Checkout — the To-bill list (D46)

Every completed visit has a **billing state**, so no finished consultation
leaves unbilled by accident:

| State | Meaning | Set by |
|---|---|---|
| `TO_BILL` | Finished, nothing billed yet. | The visit closing — unless the rule below says Billed. |
| `BILLED` | A bill was issued for it. | `create_bill` linked to the visit or its appointment. |
| `NO_CHARGE` | Deliberately free — a review, a courtesy visit. | **No charge** (`payments.create`), with a reason from `NO_CHARGE_REASONS` (Review, Courtesy, Other + note). |

When a visit closes it is `BILLED` at once if its consultation was billed at
arrival (§11.3) **and** no treatment was worked on during it; otherwise
`TO_BILL`. A procedure done after an arrival-paid consultation therefore still
reaches checkout.

The **To bill** column of the queue (and a tab of Billing) lists `TO_BILL`
visits, oldest first, from any day: patient, doctor, token, what was done.
**Bill** opens the new bill pre-filled (§15.2): the consultation (if not paid
at arrival) and the treatments; staff add anything else, collect and issue —
one tap when nothing changes. **No charge** settles it without a bill. Voiding
a visit's only bill returns the visit to `TO_BILL`.

## 16. Expenses

`/expenses` (`expenses.view`): add (`expenses.create`) with category, description,
amount, date, payment method; edit and archive (`expenses.edit`). Categories are
the clinic's own (`expense_categories`, §9, D40), seeded with Rent,
Electricity, Equipment, Medicine, Supplies, Salary, Maintenance, Marketing,
Other. The list shows a month at a time with the month's total and a total per
category.

## 17. Home (dashboard) — `/home`

Operational, not analytical: what needs attention now. Sections appear only with
their permissions, so one route serves owner, doctor and reception.

| Section | Shown with | Contents |
|---|---|---|
| Greeting | everyone | "Good morning, Dr. Rahul", today's date. |
| Today tiles | `appointments.view` / `reports.view` | Appointments today (booked + walk-ins); Patients seen (visits completed); **Collected** (payments − refunds today) and **Outstanding** (total due) with `reports.view`. |
| Today's queue | `appointments.view` | Next waiting patients per doctor; a doctor sees their own. **Open queue**. |
| To bill | `payments.view` | How many finished visits wait for checkout, oldest first; **Open**. |
| Follow-ups | `visits.view` | Counts for Today / Overdue / Lapsed, the first five due; **View all**. |
| Upcoming | `appointments.view` | Tomorrow's appointments. |
| Outstanding | `payments.view` | The five patients owing most. |
| Recent payments | `payments.view` | The last five. |
| Recent expenses | `expenses.view` | The last five. |

Phone: a 2×2 tile grid, then sections stacked. Desktop: tiles in a row, then a
two-column grid. A brand-new clinic sees a short **getting started** list
instead of empty sections (set your prices, add your team, add your first
patient). Plain counts from one SQL function (`dashboard_summary`) — no charts
on Home.

## 18. Reports — `/reports`

`reports.view`. Two tabs; every figure defined once, computed by SQL functions
in the clinic's timezone.

**Daily** (pick a date): patients visited (distinct patients with a completed
visit), appointments (booked + walk-ins), completed, cancelled, no-shows,
**collected** (payments − refunds by `paid_at`), **billed** (issued bills),
expenses, **net** (collected − expenses).

**Day-end collection summary** (on Daily, D49): that day's payments by method
(Cash, UPI, Card, Bank transfer, Other) and by **who received them**, refunds
and voids, and the net — the figure each person at the desk should hand over.
Printable (A4/A5). It locks nothing.

**Monthly** (pick a month): active patients (with a visit in the month), new
patients (first-ever visit in the month), returning patients (a visit in the
month and one before it), appointments by status, collected, billed, expenses,
net, outstanding today. Charts: collected vs expenses by day (bars), appointment
outcomes (donut).

**By doctor** (on Monthly, D53): per doctor — patients seen, visits, **billed**
(bills issued in the month with that doctor) and **of which paid to date**
(from `bill_settlement`). A bill's doctor is its visit's doctor, or the doctor
picked when billing without a visit; bills with neither show as "No doctor".
Payments go against the patient, so "collected per doctor" is not invented —
"paid to date on that doctor's bills" is what can be stated truthfully.

Doctors without `reports.view` see none. "Revenue" in the draft is called
**Collected**; "Net operating amount" is **Net** (collected − expenses), as the
draft defined it.

## 19. Activity log — `/settings/activity`

The owner reads the clinic's audit trail: who did what, when ("Anu recorded a
payment of ₹2,000 for P-1023"), filterable by person and kind, for the last
`audit_keep_days` (§6). Written by the server only; no member can write or
change a row. DEV never reads a clinic's activity (it names patients).

## 20. Developer console — `/admin`

DEV only, behind `withDevRoute`. It shows **no clinic data** — no patients,
clinical or financial records, no clinic activity.

1. **Overview:** clinics by state (Trial, Active, Expiring, Grace, Read-only),
   sign-ups this week and month, extensions recorded this month, clinics
   waiting for activation (**No trial**), deletions due.
2. **Clinics — `/admin/clinics`:** name, city, type, owner (name, email,
   mobile), signed up, plan, valid until, state, members count, and flags —
   **No trial** (§7.6), **Deletion requested** with its date (§9.1). Search
   and filter by state and flag.
3. **Clinic — `/admin/clinics/[id]`:** the above, the subscription's payment
   history, **Extend plan** (§7.4), and **Delete clinic** once its deletion
   date has passed (typing its name; asks first; §9.1).
4. **Platform settings — `/admin/settings`:** every setting in §6, grouped
   (Trial and pricing · Expiry · Retention · Invites and follow-ups · Renewal
   contact), each with its default and bounds shown; saving asks first and is
   audited.
5. **Accounts — `/admin/accounts`:** every profile: name, email, clinic, role,
   status, last sign-in.
6. **Error log — `/admin/logs`:** failures of the server's own, for
   `error_log_keep_days`. Rows carry codes, paths and ids — never patient data
   (§36).
7. **Platform audit — `/admin/audit`:** the console's own actions (extensions,
   settings changes).

## 21. Landing, legal and the installable app

- **Landing — `/`** (public): what ClinicDesk does (queue and appointments,
  visits and prescriptions, follow-ups, bills and payments, reports), that it
  works on a phone and a desk, the free trial, the two prices and the renewal
  contact from §6, and **Start free trial** / **Sign in**. Prices are read
  from platform settings at request time. Real screenshots come from a demo
  clinic made and deleted by a script (as Brio's `landing-shots`). No invented
  testimonials, numbers or logos.
- **`/privacy` and `/terms`** (public): their words in
  `src/constants/privacy.ts` and `terms.ts`, with an updated date. When the app
  starts keeping something new, the policy changes with it. It says that a
  keyed hash of an owner's mobile is kept after a clinic is deleted, to allow
  one free trial per number (§7.6).
- **The installable app (PWA):** manifest, icons, a service worker that caches
  **only** the app's hashed static files and an offline page — **never a
  screen, an API answer or a PDF** (patient data must not outlive a session on a
  shared front-desk computer). **Install app** in the menus, hidden inside the
  installed app.
- **Online-only, nothing lost (D55).** When the connection drops, a banner
  says so; a save waits and retries when it returns (with its idempotency
  key, so it can never land twice); whatever is being typed — a visit, a bill,
  a patient — stays on screen until it saves. Drafts live in memory only:
  **no patient data is written to the device** (no `localStorage`, no
  IndexedDB, no cache). Reading needs the connection. Which saves wait and
  which are refused with what was typed kept: Q25.
- **Security headers** on every response: CSP, HSTS, `X-Frame-Options: DENY`,
  `Referrer-Policy: same-origin`, `Permissions-Policy`. App routes are
  `noindex`.

## 22. Emails and WhatsApp

One mail abstraction (`src/lib/mail`), nodemailer over SMTP — Gmail first
(D20), Mailpit locally. Every word in `MAIL_TEXT`. A failed send never undoes
what it was for; it is logged and, where the person is waiting, reported.

| Email | When | To |
|---|---|---|
| Confirm your email | Sign-up; Resend | Owner |
| You're invited | Invite; Resend | Invitee |
| Reset your password | Forgot password | The account |
| Plan ends soon | `expiry_notice_days` before `valid_until` | Owner |
| Plan ended (grace) | The day after `valid_until` | Owner |
| Clinic is view-only | The day read-only starts | Owner |
| Plan extended | An extension is recorded | Owner |
| Deletion requested | The owner requests deletion (§9.1): the date, and how to cancel | Owner |
| Deletion cancelled | The owner cancels | Owner |
| Clinic deleted | The admin deletes the clinic | Owner (sent before the account is removed) |

The four plan emails are sent by `POST /api/cron/subscription-notices`, called
daily by **pg_cron through pg_net** with `CRON_SECRET` (its address and secret
in Supabase Vault, never in a migration) — the database's scheduler, not a
worker. Each email is sent once per validity period (recorded on the
subscription row).

### 22.1 WhatsApp click-to-send (D48)

No WhatsApp API, provider, template approval or cost: a button opens WhatsApp
on the device with the patient's number and a pre-written message, and a
person presses send. Wording in `WHATSAPP_TEXT` (`messages.ts`), with the
clinic's name, the doctor, the date and time filled in; English in V1.

| Button | Where | Message |
|---|---|---|
| Remind | Appointment detail; Still-to-come in the queue; tomorrow's list | "Reminder: your appointment with Dr. Maya at Smile Dental on Tue 14 Oct, 10:30 AM." |
| Remind | Follow-ups (§14.3) | "Dr. Maya asked to see you again around 14 Oct. Reply or call 98xxxxxxx to book." |
| Send bill | Bill | "Your bill 2026-27/0042 from Smile Dental: ₹1,500." + the PDF |
| Send prescription | Visit, prescription | "Your prescription from Dr. Maya, Smile Dental, 12 Oct." + the PDF |

- **The PDF:** on a phone, the share sheet (Web Share API with the file) hands
  it to WhatsApp with the text; on a desktop, WhatsApp Web opens with the text
  and the PDF is downloaded to attach.
- Every reminder sent is recorded where it was sent from (an appointment's
  "Reminded at", a follow-up contact with outcome *Reminder sent*), so the
  desk knows who has been told.
- Messages carry no clinical detail beyond what the patient is being sent.

---

# Part III — Architecture and engineering

## 23. System architecture

```text
Browser / installed PWA  (phone · tablet · desktop)
        │  HTTPS, HttpOnly session cookies
        ▼
Next.js 16 on Vercel (bom1)
  ├── proxy.ts            signed-out gate, token renewal (not authorization)
  ├── app/ screens        AppScreen: server-drawn with their first reads (ServerData)
  ├── app/api/ routes     withApiHandler → withClinicRoute / withDevRoute
  │                        → Zod schema at the boundary → feature function(Tenant)
  └── lib/                errors, api, audit, mail, pdf, query, supabase, validation…
        │  supabase-js with the caller's token (RLS applies)
        │  service role only for: registration, invites, audit/error writes,
        │  platform settings, DEV console, cron, clinic deletion
        ▼
Supabase Cloud (ap-south-1)
  ├── Auth                identities, confirmation and recovery links
  ├── PostgreSQL          tables · RLS on every table · SQL functions (RPCs) for
  │                        every multi-row write · views for balances/follow-ups ·
  │                        pg_cron (purges, daily notices via pg_net)
  └── Storage             clinic-logos (private)
```

- **No worker, no Redis, no queue** (draft §25 – §27). Work happens in the
  request; the database's scheduler covers the two timed jobs (purges, plan
  emails). A queue is added only when a requirement needs one (§42).
- **REST API routes + SWR**, as Brio (the draft's "Server Actions/API" is
  settled as API routes): one response envelope, one client, server-seeded
  first reads, and routes that tests and a future mobile client can call alike.
- **Every multi-row or rule-heavy write is one SQL function** (create bill,
  record payment, change appointment status, arrive with a token, start and
  complete a visit, register, invite, extend, delete) — transactional,
  idempotent where it matters, and checked by RLS-aware guards inside.

## 24. Technology stack

Pinned to Brio's versions at Phase 0 (newest patch at the time):

| Layer | Choice |
|---|---|
| Runtime | Node 22 (`.nvmrc`, `engines`) · npm |
| Framework | Next.js 16 (App Router, React Compiler) · React 19.2 · TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 · tokens in `src/app/globals.css` · lucide-react icons |
| Forms and validation | React Hook Form 7 · Zod 4 · @hookform/resolvers |
| Data on the client | SWR 2 through `useApiQuery` / `useApiPages` / `useApiMutation` |
| Backend | Next.js route handlers · supabase-js 2 |
| Database | Supabase PostgreSQL 17 · RLS · pg_cron · pg_net · pg_trgm · btree_gist · citext |
| Auth | Supabase Auth (email + password; confirmation and recovery links); invites by the app's own token (D63) |
| Storage | Supabase Storage (the logo only) |
| Mail | nodemailer over SMTP (Gmail first; Mailpit locally) |
| PDF | pdfkit with bundled fonts |
| Tests | Vitest 4 (+ v8 coverage) · Testing Library · jsdom · Playwright · @axe-core/playwright |
| Quality | ESLint 9 (next config) · Prettier 3 (120 columns) |
| CI/CD | GitHub Actions · Vercel (prebuilt deploy) · Supabase CLI (pinned) |

## 25. Folder structure

Feature-based, exactly Brio's shape (AGENTS.md §5):

```text
clinicdesk/
├── AGENTS.md  CLAUDE.md  README.md  changelog.md
├── PRODUCT.md  DESIGN.md                 # written by Impeccable in Phase 2
├── clinic-management-app-planning.md     # this plan
├── docs/
│   ├── planning/                          # the initial draft, kept
│   └── RELEASE.md                         # Phase 13
├── .github/workflows/ ci.yml release.yml
├── scripts/                               # check-test-paths, check-deploy-output,
│                                          # brand, og-image, landing-shots, pdf-fonts
├── supabase/ config.toml  seed.sql  migrations/NNNN_name.sql
├── public/ sw.js  icons/  email/  fonts/pdf/
├── src/
│   ├── app/                               # routes only — thin, no business logic
│   │   ├── (auth)/ login register confirm-email forgot-password
│   │   │           reset-password accept-invite
│   │   ├── page.tsx                       # landing
│   │   ├── privacy/ terms/ offline/
│   │   ├── home/ queue/ appointments/ patients/ patients/[id]/
│   │   ├── visits/[id]/ follow-ups/ billing/ billing/new/ bills/[id]/
│   │   ├── expenses/ reports/ team/ team/[id]/
│   │   ├── settings/ (account clinic price-list closures plan activity delete-clinic)
│   │   ├── admin/ (clinics clinics/[id] settings accounts logs audit)
│   │   ├── api/…                          # §30
│   │   ├── layout.tsx error.tsx global-error.tsx not-found.tsx manifest.ts
│   ├── assets/brand/                      # the app's own marks
│   ├── components/
│   │   ├── nav/                           # AppShell, AppScreen, MoreSheet, QuickAdd, PlanBanner
│   │   └── ui/                            # the shared kit, kebab-case files
│   ├── constants/                         # §26
│   ├── features/<domain>/
│   │   ├── api.ts                         # server data functions, take a Tenant
│   │   ├── api.client.ts                  # the endpoints the browser calls
│   │   ├── components/                    # PascalCase screens and sheets
│   │   ├── hooks/                         # useXxx.ts
│   │   └── types.ts
│   ├── hooks/                             # shared hooks
│   ├── lib/
│   │   ├── api/        handler, responses, client, pagination, params, idempotency
│   │   ├── audit/      auditLog (logActionSafe), errorLog (captureError)
│   │   ├── dates/      the clinic's calendar (timezone-aware days, ranges)
│   │   ├── env/        public.ts, server.ts (validated at start)
│   │   ├── errors/     AppError, kinds, fromSupabaseError
│   │   ├── format/     currency, date, age, phone
│   │   ├── mail/       provider, service, templates/
│   │   ├── pdf/        letterhead, tables, fonts — shared by bill and Rx
│   │   ├── platform/   settings.ts (getPlatformSettings)
│   │   ├── pwa/        install, serviceWorker
│   │   ├── query/      keys, useApiQuery, useApiPages, useApiMutation, ServerData
│   │   ├── supabase/   server clients, tenant, records, search, columns
│   │   ├── text/       normalise
│   │   ├── validation/ primitives.ts, schemas/<entity>.ts, index.ts
│   │   ├── logger.ts  money.ts  phone.ts
│   ├── proxy.ts
│   └── instrumentation.ts
└── tests/
    ├── unit/            # mirrors src/ exactly
    ├── contract/        # route-shape contracts
    ├── db/              # migration contracts (SQL read as text)
    │   └── integration/ # feature functions against the local Supabase
    ├── e2e/             # Playwright journeys
    └── support/         # setup, fixtures, factories, auth helpers
```

**Features** (`src/features/`): `auth`, `clinic` (profile, logo, price list,
closures, deletion), `team`, `subscription`, `patients` (incl. alerts),
`appointments` (incl. walk-ins and the queue), `visits` (incl. vitals),
`prescriptions`, `treatments` (incl. follow-ups), `billing` (bills, payments,
balances), `expenses`, `dashboard`, `reports`, `activity`, `documents` (the bill
and Rx PDFs), `admin`. No other feature is created unless the plan adds it.

The draft's `src/types/` and `src/utils/` are not used: types live with their
feature (`types.ts`), helpers in `src/lib`.

## 26. Central constants

No magic strings, no inline messages (AGENTS.md §5). Each vocabulary the
database also knows has its `CHECK` constraint kept equal by a test.

| File | Holds |
|---|---|
| `messages.ts` | `ERROR_MESSAGES` (every API error code), `VALIDATION_MESSAGES`, `UI_TEXT` (every word on every screen), `MAIL_TEXT`, `WHATSAPP_TEXT`. |
| `statuses.ts` | Appointment statuses + transitions + sources; treatment statuses + transitions; visit statuses and billing states; no-charge reasons; bill statuses; payment kinds, statuses and methods; member statuses; genders; clinic types; fee timings; paper sizes; alert kinds; service categories; follow-up tabs and outcomes; subscription plans and states; themes — each with labels and tones. |
| `seeds.ts` | What a new clinic starts with: `DEFAULT_APPOINTMENT_TYPES` (with durations), `DEFAULT_EXPENSE_CATEGORIES`, the Consultation service — kept equal to `register_clinic` by a test. |
| `roles.ts` | `CLINIC_ROLES`, `PLATFORM_ROLES`, labels. |
| `permissions.ts` | `PERMISSIONS` (catalogue with labels and descriptions), `PERMISSION_DEPENDENCIES`, `PERMISSION_PRESETS`. |
| `platform.ts` | `PLATFORM_SETTING_DEFAULTS`, `PLATFORM_SETTING_BOUNDS` (§6) — defaults only, never read as the live value. |
| `routes.ts` | Screen routes, public paths, sign-in/return-to helpers. |
| `navigation.ts` | Nav items with icon, route and the permission each needs. |
| `limits.ts` | Column-protecting bounds (lengths, `MAX_AMOUNT_PAISE`, quantities), `PAGE_SIZE`, `MAX_SEARCH_LENGTH`, `SLOT_STEP_MINUTES`, `QUEUE_REFRESH_MS`, `IMPORT_BATCH_SIZE`, `MAX_IMPORT_ROWS`, Home list sizes. |
| `clinical.ts` | `VITAL_LIMITS`, `PRESCRIPTION_FREQUENCIES`, `PRESCRIPTION_TIMINGS`, follow-up date chips. |
| `uploads.ts` | Logo size and types. |
| `privacy.ts`, `terms.ts` | The legal pages' words and dates. |

## 27. Security model

### 27.1 Tenant

`Tenant` (`src/lib/supabase/tenant.ts`) is what every feature data function
takes, built by `withClinicRoute` from the session — never from the request:

```ts
interface Tenant {
  supabase: SupabaseClient; // carries the caller's token: RLS applies
  clinicId: string;
  actorId: string;          // auth user id, for audit and *_by columns
  memberId: string;
  role: ClinicRole;
  permissions: readonly Permission[]; // the owner's are all of them
  doctorId: string | null;  // set when the member has an active doctor profile
}
```

`withClinicRoute(request, { permission }, handler)` resolves the session, the
active membership and the subscription state; refuses a missing permission
(`AUTH_PERMISSION_DENIED`, 403) and a write in `READ_ONLY`
(`CLINIC_PLAN_EXPIRED`); then calls the handler. RLS checks it all again.

### 27.2 RLS helper functions

`security definer`, `stable`, `set search_path = ''`, owned by `postgres`,
executable by `authenticated`:

| Function | Returns |
|---|---|
| `current_member()` | The caller's ACTIVE membership row (one clinic per person in V1). |
| `current_clinic_id()` | Its clinic. |
| `is_clinic_owner()` | Whether the caller is the clinic's owner. |
| `has_permission(p text)` | Owner → true; else `p = any(permissions)`. |
| `current_doctor_id()` | The caller's active doctor profile, or null. |
| `can_see_patient(patient uuid)` | Owner → true; DOCTOR → a row in `patient_doctors` for them; STAFF → `has_permission('patients.view')`. |
| `clinic_can_write()` | `subscription_state()` is not `READ_ONLY`. |
| `is_platform_dev()` | `profiles.platform_role = 'DEV'`. |

Policies call them as `(select fn())` so Postgres evaluates them once per
statement. Every policy is `to authenticated`; `anon` has no table access.

### 27.3 The doctor scope (D3)

`patient_doctors (patient_id, doctor_id)` is the access list, **maintained by
triggers**: the assigned doctor, the doctor who added the patient (D99), and
every doctor with an appointment, visit or treatment for the patient. It only grows (access granted by contact is kept, as
the history it reveals is the doctor's own work); changing the assigned doctor
adds the new one. One indexed lookup decides every patient-linked policy.

### 27.4 Policy pattern

For each clinic-owned table:

- **select:** `clinic_id = current_clinic_id()` and the view permission, and,
  for patient-linked tables, `can_see_patient(patient_id)` — written as the
  doctor scope's set, `(select sees_every_patient()) or patient_id in (select
  doctor_patient_ids())`, so it is asked once per statement, not per row.
- **insert/update:** the same, plus the write permission and
  `clinic_can_write()`; `created_by`/`updated_by` forced by trigger to
  `auth.uid()`.
- **delete:** none for clinical and financial rows (archive or void instead).
  Settings rows (closures, an invite) are deleted through their function.
- Counters, tokens, balances and status moves are written **only** through
  their SQL functions; the tables refuse direct writes of those columns.

### 27.5 The service role

Used only on the server, only in: registration, invites, audit and error-log
writes, platform settings, the DEV console, the cron route, clinic deletion,
reading the logo. Never in a feature function acting for a clinic user. It never
reaches the browser (`server-only` imports, an env split checked by a test).

### 27.6 Protecting patient data

- **No patient data in logs, the error log or URLs' query strings.** The logger
  and `captureError` redact by key (names, phones, emails, clinical fields,
  passwords, tokens); a unit test feeds them a patient and finds nothing.
- **Audit rows** record values for non-clinical changes (status from → to,
  amounts) and **field names only** for clinical text (diagnosis, notes,
  prescriptions).
- **PDFs are never stored**; the service worker caches no screen or API answer;
  `Cache-Control: no-store` on every API answer.
- **Trial claims** hold an HMAC of the mobile (`TRIAL_CLAIM_SECRET`), never
  the number; only the server computes it, and only the service role reads
  the table.
- **Sessions:** HttpOnly, `SameSite=Lax`, `Secure` in production; access token
  1 hour, refresh rotation on (Supabase defaults reviewed in R13.2).
- **Rate limits:** Supabase Auth's limits on sign-up, sign-in, recovery and
  invites; a Vercel firewall rule on `/api/auth/*` (as Brio).

## 28. Data model

Every clinic-owned table has `clinic_id uuid not null references clinics(id) on
delete cascade`, `created_at`/`updated_at` (trigger), an index leading with
`clinic_id`, RLS enabled, and a row in the tenant-isolation test. Text columns
are bounded by `CHECK`s matching the Zod schemas. Money is `integer` paise
(`bigint` for report sums). Clinical and financial rows carry `created_by` and
`updated_by` (and `archived_by`/`voided_by` where they apply), so who did it
survives the audit purge (D14).

### 28.1 Identity, tenancy, platform

```text
profiles              id (= auth.users.id, cascade) · full_name · phone · email citext unique
                      · platform_role ('DEV' | null)
clinics               id · name · clinic_type · phone · email · address · city
                      · timezone (default 'Asia/Kolkata') · gstin · logo_path
                      · next_patient_number (1001) · paper_size (A4|A5)
                      · fee_timing (AT_ARRIVAL|AFTER_CONSULTATION)
                      · deletion_requested_at · deletion_requested_by · deletion_due_on
clinic_members        id · clinic_id · user_id · role (OWNER|DOCTOR|STAFF)
                      · status (INVITED|ACTIVE|INACTIVE) · job_title · permissions text[]
                      · invited_by · invited_at · invite_token_hash · invite_expires_at · joined_at
                      · deactivated_at · deactivated_by
                      unique (clinic_id, user_id); one OWNER per clinic;
                      one INVITED/ACTIVE membership per user (V1, D23)
doctors               id · clinic_id · member_id (unique) · specialization · qualifications
                      · registration_number · consultation_fee_paise (null = price list)
                      · active
platform_settings     id (true) · every setting in §6 · updated_by · updated_at
clinic_subscriptions  clinic_id (PK) · plan (TRIAL|MONTHLY|YEARLY) · valid_until date
                      · last_notice · last_notice_for · updated_by
subscription_payments id · clinic_id · plan (MONTHLY|YEARLY|CUSTOM) · amount_paise ≥ 0
                      · method · reference · paid_on · valid_from · valid_until
                      · reason · recorded_by · receipt_number ('R/2026-27/0001')
receipt_counters      financial_year (PK) · last_number            platform-wide (§7.5)
trial_claims          mobile_hmac (PK) · first_claimed_at · last_clinic_id (no FK:
                      outlives the clinic — §7.6) · service role only
audit_logs            id · clinic_id (null for platform actions) · actor_id · action
                      · entity_type · entity_id · summary · changes jsonb · request_id
error_logs            id · source · message · reference · code · kind · http_status
                      · method · path · user_id · clinic_id · context jsonb (redacted)
```

### 28.2 Clinic setup

```text
services              id · clinic_id · name · category · price_paise · active
                      unique (clinic_id, lower(name)) where active
appointment_types     id · clinic_id · name · default_minutes (5–480) · position · active
                      unique (clinic_id, lower(name)) where active
expense_categories    id · clinic_id · name · position · active
                      unique (clinic_id, lower(name)) where active
clinic_closures       id · clinic_id · doctor_id (null = whole clinic) · starts_on · ends_on
                      · reason · created_by          check (ends_on >= starts_on)
```

### 28.3 Patients

```text
patient_counters      clinic_id · last_number   (the clinic's patient numbers, from 1001)
patients              id · clinic_id · patient_number (1001, shown P-1001; unique per clinic)
                      · full_name · phone · alt_phone · email · date_of_birth
                      · dob_is_estimated · gender · address · emergency_contact_name
                      · emergency_contact_phone · assigned_doctor_id · notes
                      · archived_at · archived_by · created_by · updated_by
                      indexes: trigram on full_name; (clinic_id, phone);
                      (clinic_id, patient_number); (clinic_id, archived_at)
patient_doctors       clinic_id · patient_id · doctor_id   PK (patient_id, doctor_id)
patient_alerts        id · clinic_id · patient_id · kind (ALLERGY|CONDITION|MEDICATION)
                      · label · note · active · created_by · updated_by
```

### 28.4 Appointments

```text
appointments          id · clinic_id · patient_id · doctor_id · source (BOOKED|WALK_IN)
                      · appointment_type_id · scheduled_at · duration_minutes (5–480)
                      · local_date (set by trigger, clinic timezone) · status
                      · token_number · arrived_at · started_at · completed_at
                      · notes · cancel_reason · cancelled_at · cancelled_by · reminded_at
                      · created_by · updated_by
                      EXCLUDE USING gist (doctor_id WITH =, tstzrange(scheduled_at,
                        scheduled_at + duration) WITH &&)
                        WHERE source = 'BOOKED' AND status NOT IN ('CANCELLED','NO_SHOW')
                      unique (doctor_id, local_date, token_number)
                      indexes: (clinic_id, local_date), (doctor_id, scheduled_at),
                      (patient_id, scheduled_at)
daily_tokens          clinic_id · doctor_id · day · last_token   PK (doctor_id, day)
```

### 28.5 Clinical

```text
visits                id · clinic_id · patient_id · doctor_id · appointment_id (unique, null)
                      · status (OPEN|COMPLETED) · visit_date · started_at · completed_at
                      · complaint · diagnosis · notes · follow_up_on
                      · billing_status (TO_BILL|BILLED|NO_CHARGE, set on completion)
                      · no_charge_reason · no_charge_note · created_by · updated_by
vitals                id · clinic_id · patient_id · visit_id (unique) · systolic · diastolic
                      · pulse · temperature_f numeric(4,1) · spo2 · respiratory_rate
                      · weight_kg numeric(5,2) · height_cm numeric(5,1)
                      · recorded_by · updated_by          each CHECKed against VITAL_LIMITS
prescriptions         id · clinic_id · patient_id · visit_id (unique) · doctor_id (= the
                      visit's) · advice · print_diagnosis bool · entered_by (who typed it)
                      · created_by · updated_by
prescription_items    id · clinic_id · prescription_id (cascade) · position · medicine
                      · strength · dose · frequency · timing · duration_days · instructions
prescription_templates id · clinic_id · doctor_id · name · advice · active
                      unique (doctor_id, lower(name)) where active
prescription_template_items  id · clinic_id · template_id (cascade) · position
                      · the same item columns as prescription_items
treatments            id · clinic_id · patient_id · doctor_id · name · description · status
                      · estimated_cost_paise · started_on · completed_on · next_due_on
                      · started_visit_id · created_by · updated_by
treatment_sessions    id · clinic_id · treatment_id · visit_id · note · created_by
                      unique (treatment_id, visit_id)
follow_up_contacts    id · clinic_id · patient_id · treatment_id · visit_id · outcome
                      · note · snooze_until · contacted_by · contacted_at
```

### 28.6 Money

```text
bills                 id · clinic_id · patient_id · visit_id · appointment_id (fee at arrival)
                      · doctor_id (the visit's, or picked; null = "No doctor" — §18)
                      · financial_year ('2026-27') · bill_number ('2026-27/0001')
                      unique (clinic_id, bill_number)
                      · issued_at · subtotal_paise · discount_paise · total_paise
                      · status (ISSUED|VOID) · notes · void_reason · voided_by · voided_at
                      · idempotency_key (unique per clinic) · created_by
                      check (discount ≤ subtotal, total = subtotal − discount)
bill_counters         clinic_id · financial_year · last_number   PK (clinic_id, financial_year)
bill_items            id · clinic_id · bill_id (cascade) · position · service_id · treatment_id
                      · description · quantity (1–999) · unit_price_paise · amount_paise
                      check (amount = quantity × unit_price)
payments              id · clinic_id · patient_id · kind (PAYMENT|REFUND) · amount_paise > 0
                      · method · reference · paid_at · note · status (RECORDED|VOID)
                      · void_reason · voided_by · voided_at · received_by
                      · idempotency_key (unique per clinic)
expenses              id · clinic_id · category_id · description · amount_paise · expense_date
                      · payment_method · archived_at · archived_by · created_by · updated_by
```

### 28.7 Views and functions

| Name | Purpose |
|---|---|
| `patient_balances` | billed, paid, refunded, balance per patient. |
| `bill_settlement` | each issued bill's paid and due, oldest first. |
| `patient_stats` | last visit, next appointment, open treatments, per patient (lists). |
| `follow_up_items` | the follow-ups and their tab (§14.3). |
| `subscription_state(clinic)` | §7.2. |
| `dashboard_summary()`, `report_daily(date)` (with the day-end collection summary), `report_monthly(month)` (with by doctor) | §17, §18. |
| `register_clinic`, `invite_member`, `accept_invite`, `update_member`, `set_member_active` | accounts and team. |
| `create_appointment`, `update_appointment`, `change_appointment_status`, `add_walk_in`, `mark_arrived` (token, optional fee bill) | appointments. |
| `send_in`, `mark_done`, `next_patient` (each opens or closes the visit with the appointment) | the queue (§11.4). |
| `start_visit` (from a profile), `save_vitals`, `save_prescription`, `save_prescription_template` | visits. |
| `import_patients(rows)` | one import batch (§10.5): validated, numbered, audited. |
| `create_bill`, `void_bill`, `mark_no_charge`, `record_payment`, `void_payment` | money. |
| `request_clinic_deletion`, `cancel_clinic_deletion` | owner (§9.1). |
| `extend_clinic_subscription`, `update_platform_settings`, `delete_clinic` | DEV. |
| `clean_up_logs()` | hourly (pg_cron): audit older than `audit_keep_days`, errors older than `error_log_keep_days`. |

### 28.8 Storage

`clinic-logos` (private): `clinics/{clinic_id}/logo/{logo_id}`; policies open it
only to the clinic's members (read) and `settings.manage` (write); served
through `GET /api/clinic/logo`.

## 29. Migrations

`supabase/migrations/NNNN_snake_name.sql`, sequential, never edited once
released; each has a DB contract test (`tests/db/<name>-migration.test.ts`).
Planned order (one or more per tracker row):

```text
0001_foundation                 extensions (pgcrypto, citext, pg_trgm, btree_gist, pg_cron,
                                pg_net), updated_at trigger, text-hygiene helpers
0002_identity                   profiles, is_platform_dev()
0003_clinics_and_members        clinics, clinic_members, doctors, permission CHECK,
                                RLS helpers (§27.2)
0004_platform_settings          platform_settings (seeded with the §6 defaults),
                                update_platform_settings
0005_subscriptions              clinic_subscriptions, subscription_payments,
                                subscription_state(), clinic_can_write(),
                                extend_clinic_subscription, trial_claims, receipt_counters
0006_logs                       audit_logs, error_logs, clean_up_logs() + its pg_cron job
0007_clinic_catalogues          services, appointment_types, expense_categories
0008_register_clinic            register_clinic (trial claim, seeds from seeds.ts)
0009_clinic_profile             update_clinic_profile (details, paper size, fee timing),
                                set_clinic_logo, clear_clinic_logo (D79), the clinic-logos bucket
0010_catalogue_rules            new appointment types and expense categories placed last (D81);
                                one of each kept, and one Consultation (D83)
0011_closures                   clinic_closures (no two for the same people on a day, D86),
                                remove_closure (D84)
0012_team                       the invite token; invite_member, resend_invite, revoke_invite,
                                find_invite, accept_invite (R3.4)
0013_members                    update_member, set_member_active (R3.6)
0014_owner_doctor               set_owner_sees_patients, update_own_doctor (R3.7, D96, D97)
0015_patients                   patients + counter, patient_doctors + triggers,
                                can_see_patient(), patient_alerts, search indexes,
                                create_patient, search_patients, import_patients;
                                patients.create and .edit need patients.view (D102)
0016_appointments               appointments, exclusion, transitions, daily_tokens,
                                create/update/status/walk-in/arrived functions
0017_visits                     visits (with billing state), vitals, send_in, mark_done,
                                next_patient, start_visit, save_vitals
0018_prescriptions              prescriptions, prescription_items, save_prescription,
                                prescription_templates (+ items)
0019_treatments                 treatments, treatment_sessions, transitions
0020_follow_ups                 follow_up_contacts, follow_up_items
0021_bills                      bills, bill_items, financial-year bill_counters, create_bill
                                (and the fee at arrival in mark_arrived), void_bill,
                                mark_no_charge
0022_payments                   payments, record_payment, void_payment,
                                patient_balances, bill_settlement, patient_stats
0023_expenses                   expenses
0024_dashboard_and_reports      dashboard_summary, report_daily, report_monthly
0025_subscription_notices       the daily pg_cron → pg_net call (address and secret in Vault)
0026_clinic_deletion            request_clinic_deletion, cancel_clinic_deletion,
                                delete_clinic (DEV)
```

## 30. API

REST, one envelope (AGENTS.md §29): `{ success: true, data }` or `{ success:
false, error: { code, message, requestId, details? } }`. Every route is
`withClinicRoute` (with its permission), `withDevRoute`, `withSessionRoute`, or
public. Bodies and queries are parsed once by their schema. Critical creates
take an `Idempotency-Key` header.

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/refresh` · `GET /api/auth/session` · `POST /api/auth/confirm` · `POST /api/auth/resend-confirmation` · `POST /api/auth/password-reset` · `POST /api/auth/password-reset/complete` · `POST /api/auth/password` · `PATCH /api/auth/profile` · `POST /api/auth/accept-invite/preview` (what a link opens onto; the token in the body, never an address) · `POST /api/auth/accept-invite` |
| Clinic | `GET, PATCH /api/clinic` · `GET, POST, DELETE /api/clinic/logo` · `POST, DELETE /api/clinic/deletion-request` · `GET /api/export/[area]` (CSV) |
| Catalogues | `GET, POST /api/services` · `PATCH /api/services/[id]` · `GET, POST /api/appointment-types` · `PATCH /api/appointment-types/[id]` · `GET, POST /api/expense-categories` · `PATCH /api/expense-categories/[id]` |
| Closures | `GET, POST /api/closures` · `DELETE /api/closures/[id]` |
| Team | `GET /api/team` · `POST /api/team/invites` · `POST /api/team/invites/[id]/resend` · `DELETE /api/team/invites/[id]` · `GET, PATCH /api/team/[id]` · `POST /api/team/[id]/active` |
| Doctors | `GET /api/doctors` (active doctors, for pickers) |
| Subscription | `GET /api/subscription` (state, dates, prices, contact, history — owner) · `GET /api/subscription/payments/[id]/receipt.pdf` |
| Patients | `GET, POST /api/patients` · `POST /api/patients/search` (the words in the body, D98) · `POST /api/patients/matches` (the mobile in the body, D98) · `GET, PATCH /api/patients/[id]` · `POST /api/patients/[id]/archive` · `POST /api/patients/[id]/restore` · `GET /api/patients/[id]/summary` · `GET /api/patients/[id]/timeline` · `GET /api/patients/[id]/last-prescription` · `POST /api/patients/import` · `GET, POST /api/patients/[id]/alerts` · `PATCH /api/patients/[id]/alerts/[alertId]` |
| Appointments | `GET, POST /api/appointments` · `GET, PATCH /api/appointments/[id]` · `POST /api/appointments/[id]/status` · `POST /api/appointments/[id]/arrived` · `POST /api/appointments/[id]/reminded` · `POST /api/appointments/walk-in` |
| Queue | `GET /api/queue` · `POST /api/queue/send-in` · `POST /api/queue/done` · `POST /api/queue/next` |
| Visits | `POST /api/visits` · `GET, PATCH /api/visits/[id]` · `PUT /api/visits/[id]/vitals` · `POST /api/visits/[id]/no-charge` |
| Prescriptions | `GET, PUT /api/visits/[id]/prescription` · `GET /api/visits/[id]/prescription.pdf` · `GET /api/prescriptions/medicines?q=` · `GET, POST /api/prescription-templates` · `PATCH /api/prescription-templates/[id]` |
| Treatments | `GET, POST /api/treatments` · `PATCH /api/treatments/[id]` · `POST /api/treatments/[id]/status` |
| Follow-ups | `GET /api/follow-ups` · `GET /api/follow-ups/counts` · `POST /api/follow-ups/contacts` |
| Billing | `GET /api/to-bill` · `GET, POST /api/bills` · `GET /api/bills/[id]` · `POST /api/bills/[id]/void` · `GET /api/bills/[id]/bill.pdf` · `GET, POST /api/payments` · `POST /api/payments/[id]/void` · `GET /api/outstanding` |
| Expenses | `GET, POST /api/expenses` · `PATCH /api/expenses/[id]` · `POST /api/expenses/[id]/archive` · `GET /api/expenses/summary` |
| Home, reports | `GET /api/dashboard` · `GET /api/reports/daily` · `GET /api/reports/monthly` |
| Activity | `GET /api/activity` (owner) |
| Admin | `GET /api/admin/overview` · `GET /api/admin/clinics` · `GET, DELETE /api/admin/clinics/[id]` · `POST /api/admin/clinics/[id]/extend` · `GET, PATCH /api/admin/settings` · `GET /api/admin/accounts` · `GET /api/admin/logs` · `GET /api/admin/audit` |
| Public | `GET /api/public/pricing` (landing) · `POST /api/cron/subscription-notices` (CRON_SECRET) |

## 31. Screens and navigation

### 31.1 Navigation

Items are filtered by permission (`NAVIGATION` in `src/constants/navigation.ts`).

- **Phone — bottom bar (5):** Home · Queue · **＋** · Patients · More.
  The Queue tab carries the To-bill count for those who bill.
  **＋ (quick add)** opens the Quick Actions lobe: Walk-in, Appointment,
  Patient, Payment, Expense — each only with its permission; each goes to its
  screen with its form open (D67). No top bar (D68). **More:** who is signed
  in (to My account), then Appointments, Follow-ups, Billing, Expenses,
  Reports, Team, Settings, Install app, Sign out.
- **Tablet — icon rail** with the same items; **desktop — sidebar** (the
  draft's layout): Home, Queue, Appointments, Patients, Follow-ups, Billing,
  Expenses, Reports, Team, Settings; the clinic's name and logo at the top,
  with the ＋ (D69); the account menu at the bottom. "Doctors" and "Staff" in
  the draft are one **Team** screen.
- The **plan banner** sits above every screen's content when the state is not
  `ACTIVE`.

### 31.2 Screens

| Route | Screen | Needs |
|---|---|---|
| `/` · `/privacy` · `/terms` | Landing, legal | public |
| `/register` · `/login` · `/confirm-email` · `/forgot-password` · `/reset-password` · `/accept-invite` | Account screens | public |
| `/home` | Home | signed in |
| `/queue` | Today's queue | appointments.view |
| `/appointments` | Calendar | appointments.view |
| `/patients` · `/patients/[id]` | Patients, profile | patients.view |
| `/visits/[id]` | Visit workspace | visits.view |
| `/follow-ups` | Follow-ups | visits.view |
| `/billing` · `/billing/new` · `/bills/[id]` | Billing, new bill, bill | payments.view / .create |
| `/expenses` | Expenses | expenses.view |
| `/reports` | Reports | reports.view |
| `/team` · `/team/[id]` | Team, member | team.manage |
| `/settings` | Settings index | signed in |
| `/settings/account` | My account | signed in |
| `/settings/clinic` · `/settings/price-list` · `/settings/appointment-types` · `/settings/expense-categories` · `/settings/closures` | Clinic setup | settings.manage |
| `/settings/plan` · `/settings/activity` · `/settings/import` · `/settings/export` · `/settings/delete-clinic` | Plan and receipts, activity, import, export, deletion request | owner |
| `/admin/*` | Developer console | DEV |
| `/offline` · not-found · error | System screens | — |

Create and edit forms are **sheets** (bottom sheet on a phone, side panel on a
desktop), except the visit workspace and the new bill, which are screens.

## 32. Design system and UI rules

Shaped with Impeccable on 2026-10-02 (`/impeccable init` → `PRODUCT.md`;
`/impeccable shape` → the brief in §32.1). The design references the user
supplied are kept in `design-references/` (git-ignored). `DESIGN.md` is
written at the end of Phase 2 **from the built world**, not before it.

### 32.1 The direction — "The Clinic Map" (D59)

Operate mode: working screens for reception, doctors, assistants and the
owner. Success is the right next action obvious in under a second, under
pressure, in glare, to someone new to software. Every screen answers "what
needs me now?".

**World.** Each screen is a guide map. One flat field of clinic green — the
**land** — leads the screen and holds its one key fact; its edge is a softly
swelling **coastline**, never a straight card edge. Everything else sits on
the **water**, a pale cool ground. No gradients, grain or shadows doing the
work; text never crosses a coastline.

**Colour.** Committed on lead screens (the land owns roughly a third of the
first viewport), restrained on dense ones (the land shrinks to a slim coast
band). Roles: land (leaf green), ink (near-black green), ground (pale
sage-white), surface (white), **coral for attention only** — overdue, to bill,
allergies, irreversible actions. No yellow, no gold, no blue or lilac. Dark:
deep green-black water, a lifted deep-leaf land, pale ink, lighter coral.
Exact values are set at R2.2 against WCAG AA (ink on land ≥ 4.5:1) in both
themes.

**Type.** **Figtree** (D64), two weights, ₹ and tabular figures; display
numerals (tokens, rupees, counts) big and tight (≈ 0.95 leading); body 17 px.

**Controls.** Capsules. A round chip rides the capsule's trailing edge and
crosses to the leading edge when the thing is live, so a patient's capsule
shows progress (waiting → with the doctor). Primary: green capsule, ink chip;
secondary: ink outline capsule. Colour never carries state alone — chip
position and label carry it too.

**Signature moments.**

- **The lake:** the land opens in its middle and the patient now with the
  doctor sits in the opening (ground showing through), with **Done** and
  **Next patient** beside them.
- **The pin:** a coral capsule pinned on the coastline carries the one thing
  not to miss — "Allergy: Penicillin", "3 to bill", "Plan ends 12 Nov".

**Motion.** One duration and one curve, no overshoot. The coastline reshapes
once between screens (View Transitions) and flattens into a slim band as you
scroll. Reduced motion: instant.

**Refuses.** The category's white-cards-and-pastel-icon-tiles grid (the
references' look) and cold grey ERP.

**Shell.** Phone: a bottom bar on the ground — Home · Queue · **＋** ·
Patients · More; the ＋ is a large round land-green chip raised above the bar
(the user's choice, PRODUCT.md). Tapping it raises a land lobe from the bottom with a
coastline top edge holding capsule actions: Walk-in, Appointment, Patient,
Payment, Expense (permission-filtered). Tablet: icon rail. Desktop: sidebar on
the ground; the land swells behind the page header. On both, the lobe drops
from the rail's ＋ or the sidebar's **Add**, beside it, its lower edge the
coastline (D76). Menus — Settings, My account, More — are one list on the
ground parted by hairlines, icons bare (D75).

**Account screens (D70).** The land leads: on a phone it holds the wordmark
and the app's line over a coastline, the form on the ground below; from
1024 px the land fills the left half, its right edge a coastline, and the
form stands on the right.

**The five shaped screens** (everything else inherits the world):

- **Queue (phone):** the land owns the top ~40% — clinic, session, a doctor
  capsule switcher; the lake holds "#07 Rohan Mehta · 34 M · 6 min" with
  **Done** (and **Next patient** for the doctor); a coral pin "3 to bill".
  On the ground: Waiting rows (big token numeral, name, Walk-in or booked
  time, wait, **Send in**), then Still to come, To bill, Done collapsed.
  Desktop: the queue persists as the left panel per doctor; the patient or
  visit opens beside it.
- **Home:** greeting and today's two key numbers in display size on the land
  (waiting, seen); Collected and Outstanding on the ground for those allowed;
  then the queue in miniature, To bill, follow-ups due. A new clinic sees a
  getting-started list.
- **Patient profile:** initials chip, name in display, age · gender ·
  P-number, Call and WhatsApp capsules on the land; any allergy pinned in
  coral on the coastline. Below: next appointment, open treatments, balance,
  timeline. Desktop: two columns.
- **Visit:** a slim land band with patient, token, alert pin and **Next
  patient**. Sections on the ground, each optional, each saving alone: vitals
  (big numerals), complaint / diagnosis / notes, treatments, prescription
  (repeat last, templates), follow-up chips.
- **Checkout:** the To-bill list (coral capsules); **Bill** opens the composer
  pre-filled; the total in display size on a land band with **Issue and
  collect**.

**States and ranges.** 0 – 80 tokens per doctor per session, 1 – 6 doctors,
names 3 – 40 characters, ₹0 – ₹10,00,000, thousands of patients (paged).
Empty: a small lobe, a warm line, one action. Loading: the land draws first,
content skeletons sized to it. Error: a notice on the ground. Offline: a slim
coral coast band at the top. Read-only: the plan banner, a slim coral band
on top (D73), and disabled capsules that say why. Sections without permission are absent.

**Assets.** Coastlines are a few authored SVG paths per screen type — static,
never generated per render. No photographs or illustrations; people are
initials.

**Build.** Code-led (no image generation this session). At R2.2, before any
code, the direction contract (THESIS, OWN-WORLD, STORY, FIRST VIEWPORT, FORM
with seed key `d61c6e96`, FINISH) is written to the surface brief from this
section; the build ends with the Impeccable finish review and `DESIGN.md`.

### 32.2 Rules

These hold whatever the direction:

- **Mobile first:** designed at 360, 390 and 414 px; every screen also ships at
  tablet (768–1024) and desktop (1280–1440) widths, in the same change.
- **Calm and clinical:** high legibility, tabular numerals for money and
  times, restrained colour; colour carries status (appointment, treatment,
  bill, plan state) and danger (allergies), with text and icon too — never
  colour alone.
- **Tokens only:** colours, type, spacing, radii and shadows are tokens in
  `src/app/globals.css`; a screen never picks a colour. **Two themes, light
  and dark** (D36): dark follows the device unless the person picks one in My
  account; no flash of the wrong theme on load; `theme-color` per theme;
  every screen is checked in both. PDFs are always light.
- **The shared kit** (`src/components/ui`): button, icon-button, link-button,
  text-field, textarea, select, phone-field, money-field, date-field,
  time-field, segmented-control, choice-chips, checkbox-group, search-field,
  sheet, dialog, response card, confirm card, list-screen, page-header,
  section-heading, row, stat-tile, status-pill, alert-chip, avatar (initials),
  capsule (with its travelling chip), coast header, lake, pin, Quick Actions
  lobe,
  empty-state, skeleton, screen-notice, tabs, date-strip, calendar grid, chart
  kit (bar, donut). A screen does not restyle any of them. Pickers are the
  app's own (D65); the calendar grid and the charts come with their screens
  (D66).
- **One way to report an outcome:** a **response card** (`useResponse()`);
  field errors inline; a screen that cannot load shows `ScreenNotice` with
  Retry; an error card shows the API's message and its `requestId`. **An action
  that cannot be undone asks first** (confirm card): cancel appointment, void
  bill or payment, archive, deactivate, delete clinic, sign out, extend plan,
  save platform settings.
- **Read-only mode:** disabled controls say why ("Your clinic is view-only —
  renew to make changes").
- **Device:** safe-area insets through `--safe-*`; heights in `dvh`, never
  `vh`; inputs at 16 px so iOS does not zoom; touch targets ≥ 44 px; the
  keyboard never covers the focused field.
- **Accessibility is a release requirement:** semantic HTML, a label on every
  control, keyboard navigation, visible focus, focus trapped in sheets and
  returned after, contrast AA in every theme, errors announced, reduced motion
  respected.
- **Avatars are initials** (no profile pictures — Q13).

## 33. Documents (PDF)

`src/features/documents` builds the **bill** and the **prescription** with
pdfkit and bundled fonts (with ₹), on a shared letterhead (`src/lib/pdf`), in
**A4 or A5** by the clinic's paper size (D28) — one layout that scales, tested
at both sizes, with the small ClinicDesk footer (D30). A
PDF is built per request by its route, streamed with `no-store`, and never
written anywhere. The same data renders an on-screen preview. Sharing uses the
Web Share API with the file where available, else download; printing opens the
PDF.

## 34. Testing and coverage

As Brio (AGENTS.md §31), with coverage enforced (D16).

### 34.1 Layers

| Layer | Where | Runs | Covers |
|---|---|---|---|
| Unit | `tests/unit/` mirroring `src/` | `npm test` (jsdom) | constants, validation, money, dates, totals, transitions, subscription state, permission rules, hooks, components, client services, route contracts with mocked features. |
| Route contracts | `tests/contract/` | `npm test` | envelope, status codes, guards, cookies. |
| DB contracts | `tests/db/*-migration.test.ts` | `npm test` | each migration's SQL as text: constraints, policies, `CHECK` ↔ constants equality, platform-setting defaults ↔ `platform.ts`. |
| Integration | `tests/db/integration/` | `npm run test:integration` (local Supabase only) | feature functions and RPCs against the real database: tenant isolation, the permission matrix, the doctor scope, read-only refusal, exclusion constraint, tokens under concurrency, idempotency, balances, purges, cascade on delete. |
| E2E | `tests/e2e/` | `npm run build && npm run test:e2e` | journeys on the built app at **phone (390×844) and desktop (1440×900)**, with an axe check on every screen visited. |

### 34.2 Coverage, enforced

- `npm run test:coverage` runs the **unit and integration projects together**
  (Vitest projects) and fails below **100%** lines, branches, functions and
  statements over `src/**/*.{ts,tsx}`.
- Excluded, and nothing else: `src/app/**/layout.tsx` and `src/app/**/page.tsx`
  (composition only — covered by E2E; a page that holds logic is a review
  failure), `src/instrumentation.ts`.
- `/* v8 ignore */` only with a written reason on the same line, reviewed.
- CI's `app` job runs `test:coverage` (it has the database).

### 34.3 Rules

- One test file, one subject; `scripts/check-test-paths.mjs` runs before every
  `npm test` and fails on an orphan or a test inside `src/`.
- Imports and mocks use `@/` and `@tests/` paths.
- Components are queried by role and accessible name, never by class or test
  id; mock the client service layer (`api.client.ts`).
- Integration and E2E refuse a hosted Supabase; they create their own clinics
  through the app's registration and delete them after.
- **Every new clinic-owned table** adds a row to the tenant-isolation test and
  the clinic-deletion test.
- **Every permission** has a row in the permission-matrix test (allowed and
  refused, through the route and through RLS).

### 34.4 The V1 critical journey (E2E)

```text
Sign up a clinic (mobile sign-in) → confirm email → sign in
→ set the consultation price → invite a receptionist, an assistant and a doctor
  (doctor's own fee) → each accepts
→ owner imports patients from an Excel sheet (errors listed, duplicates skipped)
→ receptionist adds a patient (mobile-match hint) → books with the doctor
→ a second booking in the same slot is refused → Remind opens WhatsApp with the
  message → adds a walk-in (token)
→ marks the booked patient Arrived (token)
→ receptionist sends the walk-in in → marks Done with nothing recorded → To bill
→ the doctor taps Next patient → the booked patient is in
→ assistant records vitals and an allergy; doctor writes diagnosis;
  assistant types the prescription (allergy warning) → prescription PDF (A5)
→ the doctor saves it as a template → follow-up in 7 days → the doctor taps
  Next patient (no one waiting: visit closes)
→ receptionist bills both from To bill (doctor's fee pre-filled; no discount
  without payments.discount), collects part → bill PDF → Outstanding shows the rest
→ records the rest → balance zero → Home and Daily report agree; the day-end
  summary shows each receptionist's collections; Monthly by doctor agrees
→ at the follow-up visit, Repeat last prescription fills it in
→ the connection drops mid-bill: the banner shows, the bill is kept and issued
  once when it returns
→ switch to a fee-at-arrival clinic setting: Arrived collects the fee; Done goes
  straight to Done
→ the doctor cannot see a patient booked only with another doctor
→ a second clinic cannot see any of it
→ DEV extends the plan; the owner downloads the receipt; with the plan expired
  past grace, writes are refused
→ owner exports CSV, requests deletion, cancels it
```

## 35. CI/CD, environments and release

As Brio (D17):

- **`ci.yml`** on every push to `main` and every PR. `checks`: install → lint →
  format check → typecheck → unit tests. `app`: local Supabase (pinned CLI,
  every migration) → `test:coverage` (unit + integration, 100%) → build →
  Playwright install → E2E (phone + desktop) → artifacts on failure.
- **`release.yml`** on a published GitHub release `vX.Y.Z` equal to
  `package.json`'s version: check the tag → call `ci.yml` on it → `supabase db
  push` to the hosted project → build on GitHub → `check-deploy-output.mjs`
  (no source, source maps or env files) → `vercel deploy --prebuilt --prod`.
  **Vercel is never connected to the repository.** A push deploys nothing.
- **Environments:** local (Docker Supabase + Mailpit) and production. No
  staging. `.env.example` lists every variable, validated at start by
  `src/lib/env`; `.env.local` holds local values; production values live in
  Vercel and GitHub secrets.
- **Branching:** work on a branch, PR to `main`, CI green before merge.
  Commit after every completed change with a short conventional message
  (`feat(patients): …`), as AGENTS.md says.
- **Backups:** Supabase daily backups; before every release a manual
  `pg_dump` kept off-platform (docs/RELEASE.md); a restore rehearsed once
  before v1.0.0.

## 36. Observability

- **Structured logs** (`src/lib/logger.ts`): JSON lines with level, message,
  `requestId`, and redacted context (§27.6).
- **Request ids:** every API answer carries `x-request-id`; error cards show
  it; the error log is searchable by it.
- **Error log:** `withApiHandler` sends 5xx failures; `instrumentation.ts`
  sends server render failures; side work that fails without failing the
  request calls `captureError`. 4xx refusals are not logged there. Kept
  `error_log_keep_days`.
- **Audit:** `logActionSafe(tenant, entry)` from the server only (service
  role), never failing the request it belongs to. Kept `audit_keep_days`.
- **Purges:** `clean_up_logs()` hourly by pg_cron, reading the retention
  settings.
- Third-party monitoring (Sentry/BugSnag) is later (§42).

## 37. Performance and accessibility budgets

- **Phones:** LCP < 2.5 s and INP < 200 ms on a mid-range Android over 4G for
  Home, Queue and Patients; first-load JS for a signed-in screen ≤ 200 KB gzip.
- **Database:** every list is paged; search is indexed (trigram, digits);
  every policy helper is evaluated once per statement; the seeded load test
  (a clinic with 50 000 patients, 200 000 appointments, 100 000 bills) keeps
  every list and search under 300 ms at the API (R13.5).
- **Screens:** server-drawn with their first data (AppScreen), no layout shift
  from loading states (skeletons sized to content).
- **Accessibility:** zero axe violations on every E2E-visited screen; a manual
  keyboard and screen-reader pass before release (R13.4).

---

# Part IV — Delivery

## 38. Phases

Each phase ends **shippable** (§40). Phases run in order; a phase may start only
when the one it depends on is DONE.

| Phase | Goal | Depends on | Done when |
|---|---|---|---|
| **0 — Groundwork** | The repository, tooling, CI, and the core library ported from Brio. No product. | — | CI green on a placeholder app; the core library at 100% coverage; `npm run db:start && npm run dev` works from the README. |
| **1 — Identity, tenancy and security** | The database's security model, platform settings, subscription state, logs, registration and sessions — API first, no screens. | 0 | Two clinics registered through the API cannot see each other; a missing permission is refused by the route and by RLS; a READ_ONLY clinic's write is refused by the database; settings changes take effect. |
| **2 — Design system, shell and account screens** | The Clinic Map world (§32.1): the direction contract, brand, tokens in both themes, the UI kit, the shell with the centre ＋ and Quick Actions, the response card, auth screens, the plan banner; DESIGN.md from the built world. | 1 | An owner signs up, confirms, signs in and lands on Home inside the shell at 360–1440 px in both themes with no axe violations; the Impeccable finish review passes. |
| **3 — Clinic setup and team** | Clinic profile, logo, paper size and fee timing; price list, appointment types, expense categories; holidays and leave; invites, permissions, doctor fees, deactivation. | 2 | An owner invites a receptionist and a doctor; each signs in and sees only what their permissions allow. |
| **4 — Patients** | Patients with numbers, search, profile, alerts, archive; the doctor scope. | 3 | Reception finds a patient by name, mobile or number in under a second; a doctor sees only their own. |
| **5 — Appointments and the queue** | Booking, calendar, statuses, no double-booking, closures, walk-ins, tokens, today's queue run by staff. | 4 | The same slot cannot be booked twice even by two people at once; walk-ins and arrivals get tokens; the queue is right per doctor. |
| **6 — Visits, vitals and prescriptions** | Visits opened and closed by the queue (Send in, Done, Next patient), the visit workspace, vitals, alerts in view, prescriptions typed by the doctor or for them, and the PDF. | 5 | Reception runs a session through the queue with the doctor recording nothing; a doctor runs one with Next patient alone; an assistant types a prescription that prints in the doctor's name, A4 and A5. |
| **7 — Treatments and follow-ups** | Treatments across visits, follow-up dates, the follow-ups screen with call outcomes. | 6 | Every open treatment and follow-up date appears on the right tab on the right day. |
| **8 — Billing and payments** | Checkout (To bill, No charge), the fee at arrival, price-list bills with financial-year numbers, discounts by permission, payments, refunds, voids, balance, outstanding, bill PDF. | 6 | No finished visit leaves without being billed or marked No charge; a double-tapped bill makes one bill; balances reconcile to the paisa across part payments, refunds and voids. |
| **9 — Expenses** | Expenses with categories and monthly totals. | 3 | An expense added, edited and archived shows correctly in the month's totals. |
| **10 — Home and reports** | The operational Home and the daily/monthly reports. | 7, 8, 9 | Home and the reports agree with the underlying records for a seeded month. |
| **11 — Subscription operations and the developer console** | The owner's Plan screen, the console (clinics, settings, extend, accounts, logs), expiry emails, the owner's activity log. | 10 | The admin extends a clinic and changes a setting from the console; expiry emails go out once each; DEV sees no clinic data. |
| **12 — Landing, legal and PWA** | Landing with live pricing, privacy, terms, installable app, security headers, CSV export, deletion requests and the admin's delete. | 11 | Installable on Android Chrome and iOS Safari; opens offline to the offline page; an export holds every row; a deleted clinic leaves no rows but its trial claim. |
| **13 — Hardening and release v1.0.0** | Security, accessibility and performance passes; the full journey; release workflow; production setup. | 12 | §34.4 passes at both widths in CI; the release checklist is complete; v1.0.0 is live. |

## 39. Tracker

**Status** is one of **TODO**, **DOING**, **DONE (date · commit)**, **BLOCKED
(reason)**, or **LATER (date)**. *Source* is the plan section. *Waits on* names
the open question (§41) whose answer the row needs; without an answer it is
built on that question's default. Rows are never deleted. Every row includes its
tests (§34) and its changelog entry.

### Phase 0 — Groundwork

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R0.1 | This plan; AGENTS.md; CLAUDE.md; changelog.md; README | §2, D21 | — | DONE (2026-10-02 · 71e6f2e, 8692459) |
| R0.2 | Next.js 16 app: TypeScript strict, Tailwind 4, React Compiler, ESLint, Prettier (120), Node 22 (`.nvmrc`, `engines`), `@/` and `@tests/` paths, `.gitignore`, npm scripts as Brio | §24 | — | DONE (2026-10-02 · b8b2f8e) |
| R0.3 | Test harness: Vitest unit (jsdom, setup) and integration (local-only guard) projects; coverage at 100% (§34.2); Playwright (phone + desktop, local-only guard, axe); `check-test-paths.mjs`; `tests/support` skeleton | §34 | — | DONE (2026-10-02 · 56cbcd5) |
| R0.4 | Local Supabase: `config.toml`, empty `seed.sql`, db scripts; `.env.example`; env validation (`src/lib/env`) | §35 | — | DONE (2026-10-02 · 2e88604; env validation with R0.6) |
| R0.5 | CI workflow (`checks` + `app`), Supabase CLI pinned | §35 | — | DONE (2026-10-02 · dc78ad6; first run waits for the GitHub remote) |
| R0.6 | Core library ported from Brio: `AppError` + kinds + `fromSupabaseError`; logger with redaction; `lib/api` (handler, responses, client, pagination, params, idempotency); `lib/query` hooks and keys | §25, §36 | — | DONE (2026-10-02 · 06a440b) |
| R0.7 | Constants skeleton (`messages`, `routes`, `limits`); validation primitives and text hygiene; `money`; `phone` (+91); `format` (currency, date, age); `dates` (clinic timezone) | §26 | — | DONE (2026-10-02 · 7f6d9f2) |

### Phase 1 — Identity, tenancy and security

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R1.1 | `0001_foundation`: extensions, `updated_at` trigger, text hygiene | §29 | — | DONE (2026-10-02 · 33b0c4f) |
| R1.2 | `0002_identity`, `0003_clinics_and_members`: profiles, clinics, members, doctors; roles and the permission catalogue in TS with the DB `CHECK` kept equal | §3, §8.1, §28.1 | — | DONE (2026-10-02 · 33b0c4f) |
| R1.3 | RLS helpers (§27.2) and the policy pattern; `anon` locked out | §27 | — | DONE (2026-10-02 · 33b0c4f) |
| R1.4 | `0004_platform_settings`: the row with §6 defaults and bounds; `PLATFORM_SETTING_DEFAULTS`/`BOUNDS` kept equal; `getPlatformSettings()`; `update_platform_settings` | §6, D22 | — | DONE (2026-10-02 · f017f2f) |
| R1.5 | `0005_subscriptions`: subscription tables, `subscription_state()` = `subscriptionState()`, `clinic_can_write()`, `extend_clinic_subscription` | §7 | — | DONE (2026-10-02 · 37d58d3) |
| R1.6 | `0006_logs`: audit and error logs, `logActionSafe`, `captureError`, `clean_up_logs()` reading the retention settings | §19, §36 | — | DONE (2026-10-02 · ac41049) |
| R1.7 | Mail abstraction (nodemailer, Mailpit), the layout, the confirmation template | §22 | — | DONE (2026-10-02 · f97badd) |
| R1.8 | Registration: `0007_clinic_catalogues`, `0008_register_clinic` (seeds from `seeds.ts`, the trial claim, no trial for a used mobile), compensation, confirmation, resend | §5.1, §7.6 | Q17 | DONE (2026-10-02 · 24e89c0) |
| R1.9 | Sessions: cookies, sign-in by email or mobile, login/logout/refresh/session, `proxy.ts`, renewal, `withClinicRoute`/`withDevRoute`, the `Tenant` | §5.2, §5.5, §27.1 | — | DONE (2026-10-02 · f8a759c) |
| R1.10 | Password reset by link; change password; profile update | §5.3, §5.4 | Q18 | DONE (2026-10-02 · 7609a83) |
| R1.11 | Integration: tenant isolation, permission matrix (so far), read-only refusal through REST, DEV sees no clinic rows, settings take effect | §34 | — | DONE (2026-10-02 · 5e18708) |

### Phase 2 — Design system, shell and account screens

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R2.1 | `/impeccable init` → PRODUCT.md; `/impeccable shape` → the direction (§32.1); the wordmark on the working name, text only (D61) | §32.1 | — | DONE (2026-10-02 · 96f6345) |
| R2.2 | The direction contract in the surface brief; the face chosen from a sample page (D60) and the green / ink / coral values checked for AA in both themes; light and dark tokens in `globals.css`, no theme flash, `theme-color`; safe areas; `dvh`; the coastline paths | §32.1 | — | DONE (2026-10-02 · f89322a) |
| R2.3 | The UI kit (§32.2 list, plus the capsule with its travelling chip, the coast header, the lake, the pin and the Quick Actions lobe) with 100% coverage; own-look pickers (D65); the calendar grid and charts later (D66); screenshots checked by the user before R2.4 | §32.1, §32.2 | — | DONE (2026-10-02 · a6cc5d5) |
| R2.4 | Response card and confirm card (`useResponse`) | §32 | — | DONE (2026-10-02 · eb1b32c) |
| R2.5 | AppShell: bottom bar + quick add (phone), rail (tablet), sidebar (desktop); permission-filtered navigation; AppScreen + ServerData | §31.1 | — | DONE (2026-10-03 · 2145a1a) |
| R2.6 | System screens: error, global error, not found, loading skeletons | §31.2 | — | DONE (2026-10-03 · fb4cba5) |
| R2.7 | Account screens: register (two steps), sign in, confirm email, forgot and reset password | §5 | — | DONE (2026-10-03 · fc40357) |
| R2.8 | Settings index and My account (with the theme switch) | §5.4 | — | DONE (2026-10-03 · 6c90d1b) |
| R2.9 | Plan banner and read-only mode in the shell | §7.2 | — | DONE (2026-10-03 · ad8e932) |
| R2.10 | E2E: sign up → confirm → sign in → Home, phone and desktop, axe clean | §34 | — | DONE (2026-10-03 · 394e3b5) |
| R2.11 | Online-only, nothing lost: the offline banner; saves wait and retry with their key; forms keep their content in memory | §21, D55 | — | DONE (2026-10-03 · 4136bd0) |
| R2.12 | The Impeccable finish review (D75, D76) and `DESIGN.md` from the built world | §32.1 | — | DONE (2026-10-03 · d35eb89) |

### Phase 3 — Clinic setup and team

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R3.1 | `0009_clinic_profile`: clinic details, paper size, fee timing, the logo upload (D77–D79) | §9 | — | DONE (2026-10-03 · 0de6f85) |
| R3.2 | `0010_catalogue_rules`; price list, appointment types and expense categories screens (tables from `0007`; D80–D83) | §9 | — | DONE (2026-10-03 · f7b0669) |
| R3.3 | `0011_closures`: holidays and leave (D84–D87); `GET /api/doctors` for its picker | §9, §30 | — | DONE (2026-10-03 · 528bedf) |
| R3.4 | `0012_team`: invite with its own token (D63; presets, dependencies, doctor details and fee), invite email, resend, revoke, expiry, and the accept function R3.5 calls (D88–D90) | §8.3, §8.4 | — | DONE (2026-10-03 · 0b7cf09) |
| R3.5 | Accept invite screen (D91, D92) | §8.5 | — | DONE (2026-10-03 · c0c1076) |
| R3.6 | `0013_members`; team list and member detail: permissions, job title, doctor details, deactivate/reactivate; escalation and last-owner guards (D93–D95) | §8.2, §8.6 | — | DONE (2026-10-03 · 0c8b5e2) |
| R3.7 | `0014_owner_doctor`: the owner's own doctor profile (D96, D97) | §3.1 | — | DONE (2026-10-03 · 02fa6cf) |
| R3.8 | Integration + E2E: invite a receptionist and a doctor; each sees only what they may | §34 | — | DONE (2026-10-03 · 9a2f1b2) |

### Phase 4 — Patients

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R4.1 | `0015_patients`: counter, `patient_doctors` + triggers, `can_see_patient`, alerts, search indexes; `create_patient`, `search_patients`, `import_patients` (D98 – D104) | §10, §27.3 | — | TODO |
| R4.2 | Patient sheet: DOB or age, gender, phones, emergency contact, assigned doctor; mobile-match hint | §10.1 | — | TODO |
| R4.3 | Patients list: search (name, mobile digits, number), tabs, paging; the last visit and Owing come with their phases (D101) | §10.2 | — | TODO |
| R4.4 | Patient profile: header and details, sections by permission; the next appointment, open treatments, balance and history come with their phases (D101) | §10.3 | — | TODO |
| R4.5 | Alerts: allergies, conditions, medications | §10.4 | — | TODO |
| R4.6 | Archive and restore | §10.1 | — | TODO |
| R4.7 | Integration: the doctor scope; staff without `patients.view`; isolation rows | §34 | — | TODO |
| R4.8 | Patient import: parse CSV/Excel in the browser, map, preview (errors, duplicates), batches, summary, refused rows as CSV | §10.5 | — | TODO |

### Phase 5 — Appointments and the queue

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R5.1 | `0016_appointments`: table (clinic's appointment types), exclusion, transitions, closures check, the appointments on a closure being added listed (D87), nothing booked for an archived patient (D103), tokens, functions | §11, §28.4 | — | TODO |
| R5.2 | Booking sheet: patient search/quick add, doctor, date, time, type → duration; clash card | §11.1 | — | TODO |
| R5.3 | Calendar: day (list / columns per doctor), week, doctor filter, closures shaded; the kit's calendar grid (D66) | §11.5 | — | TODO |
| R5.4 | Appointment detail: confirm, reschedule, cancel (reason), no-show; the profile's next appointment and its appointments in the history (D101) | §11.2, §10.3 | — | TODO |
| R5.5 | Walk-ins, arrival tokens, today's queue (Waiting, With doctor, Still to come, Done) with 15 s refresh | §11.3, §11.4 | — | TODO |
| R5.6 | Integration (concurrent bookings, concurrent tokens) + E2E | §34 | — | TODO |
| R5.7 | WhatsApp click-to-send: the link and share helpers; appointment reminders and `reminded_at` | §22.1 | — | TODO |

### Phase 6 — Visits, vitals and prescriptions

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R6.1 | `0017_visits`: visits (billing state), vitals, `send_in`, `mark_done`, `next_patient`; Send in, Done and Next patient in the queue and the workspace | §11.4, §12.1, §28.5 | — | TODO |
| R6.2 | Visit workspace: alerts, vitals, complaint/diagnosis/notes, follow-up, per-section saves | §12.2 | — | TODO |
| R6.3 | `0018_prescriptions`: items, advice, medicine suggestions, allergy warning; the doctor's own, or typed with `prescriptions.write` (`entered_by`) | §13, §8.2 | — | TODO |
| R6.4 | `lib/pdf` letterhead (A4 and A5, footer) and the prescription PDF; share, download, print | §13, §33 | — | TODO |
| R6.5 | Patient timeline with visits and prescriptions; the patients list's last visit (D101) | §10.3, §10.2 | — | TODO |
| R6.6 | Integration + E2E: queue → visit → prescription PDF | §34 | — | TODO |
| R6.7 | Repeat last prescription; prescription templates (save, apply, edit, archive) | §13 | — | TODO |
| R6.8 | Send prescription on WhatsApp | §22.1 | — | TODO |

### Phase 7 — Treatments and follow-ups

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R7.1 | `0019_treatments`: treatments, sessions, transitions | §14.1 | — | TODO |
| R7.2 | Treatments in the visit workspace and on the profile | §14.1 | — | TODO |
| R7.3 | `0020_follow_ups`: `follow_up_items`, contacts | §14.2 | — | TODO |
| R7.4 | Follow-ups screen: tabs with counts, Call, WhatsApp, Book, Mark contacted | §14.3 | — | TODO |
| R7.5 | Integration: each tab on the right day in the clinic's timezone; lapsed follows the setting | §34 | — | TODO |
| R7.6 | Follow-up reminders on WhatsApp, recorded as a contact | §14.3, §22.1 | — | TODO |

### Phase 8 — Billing and payments

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R8.1 | `0021_bills`: bills, items, financial-year counters, `create_bill` (idempotent, price check without `payments.discount`), `void_bill`, `mark_no_charge`, the fee at arrival in `mark_arrived` | §15.2, §15.6, §11.3 | — | TODO |
| R8.2 | `billing/totals.ts`, the one formula; discount by amount or % | §15.1 | — | TODO |
| R8.3 | New bill screen: from To bill, a visit or a patient; the doctor's fee; discount and price change with `payments.discount`; collect now. Collect fee at arrival | §15.2, §11.3 | — | TODO |
| R8.4 | `0022_payments`: record, refund, void; `patient_balances`, `bill_settlement`, `patient_stats` | §15.3, §15.4 | — | TODO |
| R8.5 | Bill PDF; share, download, print | §15.5, §33 | — | TODO |
| R8.6 | Checkout: the queue's To-bill column, Billing's tabs (To bill, bills, payments, outstanding), No charge; the profile's balance section, its bills and payments in the history, and the patients list's Owing tab and balance chip (D101) | §15.4, §15.6, §10.2, §10.3 | — | TODO |
| R8.7 | Integration: double submit → one bill/payment; balances to the paisa; read-only refuses | §34 | — | TODO |
| R8.8 | A bill's doctor (from the visit, or picked); send bill on WhatsApp | §18, §22.1 | — | TODO |

### Phase 9 — Expenses

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R9.1 | `0023_expenses` and the expenses screen (the clinic's categories): add, edit, archive, month totals, by category | §16 | — | TODO |
| R9.2 | Integration + E2E | §34 | — | TODO |

### Phase 10 — Home and reports

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R10.1 | `0024_dashboard_and_reports`: `dashboard_summary`, `report_daily`, `report_monthly` | §17, §18 | — | TODO |
| R10.2 | Home: sections by permission; getting-started for a new clinic | §17 | — | TODO |
| R10.3 | Reports: daily and monthly, the two charts; the kit's chart kit, bar and donut (D66) | §18 | — | TODO |
| R10.4 | Integration: a seeded month's figures equal hand-computed ones | §34 | — | TODO |
| R10.5 | Day-end collection summary (by method, by receiver), printable | §18 | — | TODO |
| R10.6 | Monthly by doctor: seen, visits, billed, paid to date | §18 | — | TODO |

### Phase 11 — Subscription operations and the developer console

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R11.1 | Owner's Plan screen | §7.5 | Q2 | TODO |
| R11.2 | Console: overview, clinics (No trial and Deletion flags), clinic detail, accounts, error log, platform audit | §20 | — | TODO |
| R11.3 | Extend plan (Monthly, Yearly, Set date); the owner's confirmation email | §7.4 | — | TODO |
| R11.4 | Platform settings screen | §6, §20.4 | — | TODO |
| R11.5 | `0025_subscription_notices`: daily notices, each once per period | §22 | — | TODO |
| R11.6 | Owner's activity log | §19 | — | TODO |
| R11.7 | Integration + E2E: extend, change a setting, notices once, DEV sees no clinic data | §34 | — | TODO |
| R11.8 | Plan receipts: receipt numbers, the receipt PDF, the business details settings | §7.5, §6 | Q2 | TODO |

### Phase 12 — Landing, legal and PWA

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R12.1 | Landing with live pricing and renewal contact; screenshots script | §21 | Q1, Q2 | TODO |
| R12.2 | Privacy and terms | §21 | Q22 | TODO |
| R12.3 | Manifest, icons, service worker, offline page, Install app | §21 | — | TODO |
| R12.4 | Security headers; `noindex` on app routes; share-preview image | §21 | — | TODO |
| R12.5 | `0026_clinic_deletion`: the owner's request and cancel (banner, emails), the admin's delete after the cooling-off | §9.1, §20 | — | TODO |
| R12.6 | CSV export, one file per area, audited | §9 | — | TODO |

### Phase 13 — Hardening and release v1.0.0

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R13.1 | Rate limits: Supabase Auth settings, Vercel firewall on `/api/auth/*` | §27.6 | — | TODO |
| R13.2 | Security review: every table's policies, every service-role call, headers, session settings, redaction | §27 | — | TODO |
| R13.3 | Patient-data review: logs, error log, audit, PDFs, cache headers, service worker | §27.6 | — | TODO |
| R13.4 | Accessibility pass: axe on every screen; manual keyboard and screen reader | §37 | — | TODO |
| R13.5 | Performance: budgets measured; load-seeded EXPLAINs; indexes adjusted | §37 | — | TODO |
| R13.6 | The full critical journey (§34.4) at both widths in CI | §34.4 | — | TODO |
| R13.7 | `release.yml`, `check-deploy-output.mjs`, `docs/RELEASE.md` (accounts, setup, each release, backups, rollback) | §35 | — | TODO |
| R13.8 | Production: Supabase (ap-south-1), Vercel (bom1), domain, Gmail SMTP, Vault and env secrets (`CRON_SECRET`, `TRIAL_CLAIM_SECRET`), the DEV account, renewal contact set, the final product name; restore rehearsed; v1.0.0 | §35 | Q1, Q3, Q22 | TODO |

## 40. Definition of shippable

A phase is DONE when:

- typecheck, lint, format check, unit, integration (with 100% coverage) and
  E2E are green in CI;
- every screen it touched is checked at 360, 390, 414, 768, 1024 and 1440 px,
  in every theme, with no axe violations;
- no hard-coded strings (all words in `messages.ts`), no business rule in code
  that §6 says is a setting;
- `changelog.md` has the phase's entries and its tracker rows read DONE with
  their commits;
- open blockers are recorded.

## 41. Open questions

Answered questions keep their row, with the decision that settled them. An open
one has a **default** that is built if no answer arrives before its tracker row
starts.

| ID | Question | Status |
|---|---|---|
| Q1 | The product's final name and brand. | **Partly answered (D35):** "ClinicDesk" is a working name, used only through `UI_TEXT.appName` and the brand constants. The final name is needed before Phase 12. |
| Q2 | The renewal contact to show clinics (name, phone/WhatsApp, email, UPI id), and the business name and address for plan receipts. | **Open.** Set by the DEV in platform settings (§6); hidden until set; required before release. |
| Q3 | The production domain. | **Open.** Required before R13.8. |
| Q4 | One clinic per person in V1? | **Answered: yes (D23).** |
| Q5 | Exactly one owner? | **Answered: yes; no transfer in V1 (D24).** |
| Q6 | Who writes prescriptions? | **Answered (D45):** the visit's doctor, or staff with `prescriptions.write`, always in the doctor's name. |
| Q7 | Is a patient's mobile unique? | **Default kept:** no — families share one; a matching-number hint, never a refusal. The mobile is required (D33). |
| Q8 | Age instead of date of birth? | **Answered: either one is required (D33).** |
| Q9 | Appointment types? | **Answered: per clinic (D32).** |
| Q10 | Expense categories? | **Answered: per clinic (D40).** |
| Q11 | Changing a line's price at billing? | **Answered: only with `payments.discount` (D29).** |
| Q12 | Themes? | **Answered: light and dark (D36).** |
| Q13 | Profile pictures? | **Default:** none — initials. The logo stays the only upload. |
| Q14 | Deleting a clinic? | **Answered: the owner requests, the admin deletes after a cooling-off (D37).** |
| Q15 | Commit author? | **Answered: `jaFFa <jafakash.14@gmail.com>` (D38).** |
| Q16 | The ClinicDesk footer on documents? | **Answered: yes, small (D30).** |
| Q17 | Email confirmed before first use? | **Default:** yes. |
| Q18 | Password reset by link? | **Default:** yes, a link (not Brio's temporary password). |
| Q19 | Does the Receptionist preset take payments? | **Answered (D88):** yes (`payments.view`, `payments.create`; no discount). |
| Q20 | Queue refresh? | **Answered: every 15 s and on focus (D34).** |
| Q21 | Temperature unit? | **Answered: °F (D31).** |
| Q22 | Who writes the privacy policy and terms? | **Open.** Drafted in R12.2 from what the app keeps; the user reviews before release. |
| Q23 | How does an invite link last `invite_valid_days` (§8.4), when Supabase Auth's links last at most a day? | **Answered: the app's own invite token (D63).** |
| Q24 | What paper size and fee timing does a new clinic start with (§9)? | **Default:** A4, and the fee collected after the consultation (`DEFAULT_CLINIC_SETTINGS`); each clinic changes both in Settings. |
| Q25 | Which saves wait for the connection (§21, D55)? | **Default (R2.11):** a save that carries an idempotency key (§26) waits while the device is offline and goes when the connection returns, and is tried again after 1, 2 and 4 s if the server cannot be reached while online — the key makes it land once. Any other save is refused at once with the reason (`NETWORK_OFFLINE`, `NETWORK_UNREACHABLE`), what was typed kept in its sheet, and the person saves again. Reads are refused at once. |

## 42. Later (unscheduled)

Kept in the roadmap, in no phase. Each needs the user to bring it into a phase,
with its own section here first.

- **Dental module** (D6): teeth, tooth conditions, dental chart, per-tooth
  procedures, treatment plans — an optional module on by clinic type, adding
  tables, never changing the core ones.
- **Inventory** (draft §18): `inventory_items` + `inventory_transactions` as a
  ledger (purchase, dispensed to a patient, adjustment, wastage),
  concurrency-safe, low-stock alerts; `inventory.view`/`inventory.manage`.
- **Payroll** (draft §19): employees, salary, attendance, deductions, bonuses,
  payroll records — separate from team access.
- **File attachments** (X-rays, reports): private storage per clinic and
  patient, size/type checked server-side.
- **Doctor working hours** and a free-slot picker.
- **Automated reminders and notifications:** appointment and follow-up
  reminders sent without a person (WhatsApp Business API, SMS, email); this is
  when a scheduler or queue is reconsidered. V1 has click-to-send (D48).
- **Waiting-room token display** ("Now serving #7" on a TV) (D47).
- **Patient self-booking** — a public request link per clinic (D50).
- **Two-factor authentication** (TOTP) (D57); an **idle lock** for shared
  desk computers (D56).
- **Online payment of the subscription** (e.g. Razorpay) instead of offline.
- **Multi-clinic membership** and a clinic switcher; **ownership transfer**.
- **GST billing**; **pre-printed-pad printing** and **80 mm thermal
  receipts** (D28); **Google / phone-OTP sign-in**; **changing the sign-in
  email**; **realtime queue**; **OpenAPI**; **Sentry/BugSnag**; **multiple
  languages**; **prescription templates**; **a per-clinic temperature unit**.

## 43. Changes from the initial draft

What this plan changed in `docs/planning/2026-10-02-initial-draft.md`, and why.

| Draft | Now | Why |
|---|---|---|
| Payments only; "₹2,000 pending" with nothing to compute it from | Price list, bills, bill items; payments against the patient; balances and outstanding (§15) | D4 — an amount owed needs an amount charged. |
| `payments.payment_status`, `payments.appointment_id` | `kind` (payment/refund), `status` (recorded/void); against the patient | A transaction has no "pending" state; refunds and mistakes need their own record. |
| `staff` table | `clinic_members.job_title` + `permissions` | It duplicated the membership's status and clinic. |
| `doctors.user_id`, `license_number` | `doctors.member_id`, `registration_number`, `qualifications` | A doctor is a member; the prescription prints the medical council registration and degrees. |
| `profiles.avatar_url` | Initials | The logo is the only upload (Q13). |
| Treatment statuses with both `IN_PROGRESS` and `PENDING` | `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` + a transition table; "pending" is a view (§14) | The two overlapped; a treatment spans visits through `treatment_sessions`. |
| `appointments.duration` | `duration_minutes`, `source`, `token_number`, an exclusion constraint | D7 — no double-booking, walk-ins, tokens. |
| Patients: one `emergency_contact`, no archive | Name + phone, DOB or age, assigned doctor, alerts, archive | D3, D5; production needs. |
| Roles + permissions, unspecified enforcement | A catalogue, dependencies, presets, no-escalation, `has_permission()` in RLS, the doctor scope (§8, §27) | D2, D3 — enforced by the database, not only the UI. |
| — | Subscription, trial, grace, read-only, developer console, platform settings (§6, §7, §20) | D10 – D13, D22. |
| Audit log, retention unstated | Audit and error logs, purged by settings; `*_by` columns on clinical and financial rows | D14 — who did what outlives the audit window. |
| "Server Actions/API" | REST API routes + SWR, as Brio | One contract, testable, Brio's pattern. |
| `src/types/`, `src/utils/` | Types in each feature; helpers in `src/lib` | Brio's structure. |
| Phases: Foundation → Core → Finance → Operations → Inventory → Payroll | Phases 0 – 13 to a production v1.0.0; inventory, payroll and dental in Later | The draft's own V1 scope; D6. |
| Analytics "Revenue" | "Collected" and "Billed", defined (§18) | With bills, revenue has two meanings. |
| Hosting unstated | Vercel `bom1` + Supabase `ap-south-1` | D9 — close to users, data in India. |
| One price per service | The clinic's price list, and each doctor's own consultation fee | D26 |
| The doctor starts, completes and bills each visit | Staff run the queue (Send in, Done) and the doctor has one Next patient button; visits open and close with it, may close empty, and wait in **To bill** until billed or marked No charge; the fee may be taken at arrival | D43 – D46 — a busy doctor only sees patients |
| Fixed appointment types and expense categories | Per clinic, seeded | D32, D40 |
| Sign-in by email | Email or mobile | D39 |
