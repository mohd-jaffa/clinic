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
| D105 | **The patient sheet: what every patient needs first, the rest folded** (the user): name, mobile, date of birth or age, gender and the doctor show at once; alternate phone, email, address, emergency contact and notes wait under **More details**, which opens for an edit when any of them holds a value, and for a refusal inside. | 2026-10-04 |
| D106 | **"Already here?" lists the patients on a mobile as it is typed** (the user): once ten digits are in, the patients already on that number — name, age, gender, number, the archived marked — each with Open; nothing is refused, so a family shares a number and a sibling is added. | 2026-10-04 |
| D107 | **An added patient's profile opens** (the user), with a card naming them and their number ("Rohan Mehta added — P-1012"); the add form leaves the history, so Back leads to where they came from. | 2026-10-04 |
| D108 | **The assigned doctor starts as the adding doctor, or the clinic's only doctor** (the user); otherwise as **No doctor yet**. It can always be changed. | 2026-10-04 |
| D109 | **A date jumps by month and year** (the user): the calendar's heading opens its year's months, then a page of twelve years — the kit's date picker, for every date field — so a date of birth decades back is a few taps away. | 2026-10-04 |
| D110 | *(Replaced by D121.)* **Each row of the patients list carries Call** (the user): a round call button beside the row, which opens the profile. On a phone the row's line is age · gender · number and leaves the mobile to the button; from a tablet's width the mobile joins the line. | 2026-10-04 |
| D111 | **The patients list is rows on a desktop too** (the user): the same rows as on a phone, in a column of reading width — no table. | 2026-10-04 |
| D112 | **A search that finds no one offers to add them** (the user): "No patient matches …" with **Add patient**, for those who may add, on the All tab; the sheet opens with what was typed — a mobile's digits as the mobile, words as the name. | 2026-10-04 |
| D113 | **A patient's details are a card of what is filled** (the user): below the header, a **Details** card lists only the details that hold a value — mobile, date of birth (when given as a date, not an age), alternate phone, email, address, emergency contact, notes — with one **Edit** opening the patient sheet. The header holds the name, age · gender · number, their doctor, and **Call** and **WhatsApp** under them. | 2026-10-04 |
| D114 | **The profile is one column until history arrives** (the user): on a desktop, a single column at reading width in Phase 4; the history column on the right comes with the first visits in Phase 6. | 2026-10-04 |
| D115 | **The profile's WhatsApp opens a chat with nothing typed** (the user): `wa.me` on the patient's number, no message — §22.1 has none for the profile, and the desk writes what it needs. | 2026-10-04 |
| D116 | **A patient's notes show to everyone who may see them** (the user): desk notes, not clinical, so `patients.view` reads them on the profile with the other details. | 2026-10-04 |
| D117 | **Alerts show as chips in the profile header and are managed in a sheet** (the user): allergies first, in the danger tone, then conditions and medications; **Alerts** beside them opens a sheet listing each with its note — **Add alert**, **Edit** and **Turn off** for `visits.edit`, read only for `visits.view`. | 2026-10-04 |
| D118 | **Turning an alert off asks first** (the user): a confirm card says it stops showing on the profile, at visits and on prescriptions, so a stray tap never hides an allergy. | 2026-10-04 |
| D119 | **An alert's label and note can be changed; its kind cannot** (the user): the add sheet opens on it, so a note is added later or a spelling fixed, and an allergy never quietly becomes a note. | 2026-10-04 |
| D120 | **Turned-off alerts are folded in the alerts sheet** (the user): "Show turned off (2)" at its foot, read only; nothing clinical is deleted, and the label may be added again. | 2026-10-04 |
| D121 | **No Call on the patients list** (the user, asking for what is production grade; replaces D110): the list is for finding a patient, and Call and WhatsApp are on the profile a tap away, with the patient's name and alerts in view. A call button on every row invited a dialled mis-tap. Each row gives age · gender · number, and the mobile too from 640 px; on a phone it would only be cut short. | 2026-10-04 |
| D122 | **Archive patient sits at the foot of their edit sheet** (the user): under a hairline, as on a catalogue entry's sheet (D80), so a rare act stays off the profile until someone is editing; it asks first — they leave the list and search, their records are kept, and Archived brings them back. | 2026-10-04 |
| D123 | **An archived profile says so in its header** (the user): a notice — "Archived on 4 Oct 2026 by Asha Rao" (by whom while their profile lasts) and that the profile is read-only until restored — with **Restore** for `patients.edit` while the clinic may write. Edit and changing alerts are not offered meanwhile (D103). | 2026-10-04 |
| D124 | **Archiving leaves the person on the profile** (the user): the sheet closes, "Meena Iyer archived" is said, and the notice with Restore is there at once if it was a mistake. | 2026-10-04 |
| D125 | **Restore asks nothing** (the user): it only brings a patient back and is undone by archiving again, as a catalogue entry's Restore (D80). | 2026-10-04 |
| D126 | **The header's Alerts button always carries an icon** (the user): a pencil when the alerts may be changed, an eye when they may only be read — an archived patient, a view-only clinic, or `visits.view` alone — so it never reads as a bare chip, and never promises an edit that would be refused. | 2026-10-04 |
| D127 | **An import reads CSV and Excel (.xlsx) in the browser, with read-excel-file and Papa Parse** (the user): small, MIT, maintained, fetched only on the import screen; the old .xls is refused with how to save it as .xlsx or CSV. | 2026-10-05 |
| D128 | **How many rows an import may hold is a platform setting** (the user): `max_import_rows`, 10,000 to start, 100 – 50,000, changed by the DEV in the console; the batch size (`IMPORT_BATCH_SIZE`, 200) stays a constant, being technical. The cap is checked when the file is read; each batch is bounded on the server. | 2026-10-05 |
| D129 | **A possible duplicate is imported anyway one row at a time** (the user): the preview lists each with what it matched — a patient already here ("Same mobile and name as P-1012 Rohan Mehta") or an earlier row — skipped unless ticked. Names are similar when every word of the shorter is in the longer, so a family on one mobile is not flagged. | 2026-10-05 |
| D130 | **Dates in a file are read day first** (the user): 03/04/1990 is 3 April 1990, as India writes it; ISO dates, "3 Apr 1990" and Excel's own date cells are read as they are; a date read no way is named in the row's problem. | 2026-10-05 |
| D131 | **The import is four steps, one at a time** (the user): File → Columns → Check → Import, with a step indicator and Back; nothing leaves the device until the last step's Import. Once sending starts there is no way back, so no row is sent under a new key. | 2026-10-05 |
| D132 | **An import starts from Settings, and from an empty patients list** (the user): the owner of a clinic with no patients yet gets **Import from a file** in the list's empty state, where someone moving from a spreadsheet looks first. | 2026-10-05 |
| D133 | **The summary counts, gives back the rows not imported, and leads on** (the user): imported, skipped as duplicates, not imported; **Download rows not imported** — the file's own columns and a Problem column, to fix and import again; **Open patients**; **Import another file**. A batch sent again after a stop adds no one twice: each row carries its own key (`0016_patient_import`). Migrations from appointments on move up one: `0017_appointments`, … | 2026-10-05 |
| D134 | **A speed phase before release** (the user, after Brio's live app lagged): **Phase 13 — Speed** measures every screen, read and save. It puts the session in one database round trip, indexes what is read, cuts round trips made one after another, and puts the server beside the database (§37, §39). Hardening and release become **Phase 14**; each old R13.n is now R14.n. | 2026-10-05 |
| D135 | **Speed is part of every row** (the user): from R5.1 on, each row indexes the queries it adds, makes no database call it does not need, keeps its screens and saves within the round-trip budget, and says in its changelog how many round trips they wait on (§37.1). | 2026-10-05 |
| D136 | **Docs travel with their change** (the user): a row's code, tests, plan, DESIGN.md, changelog and tracker row go in **one commit**; docs are never committed on their own. The tracker reads **DONE (date)**, and the row's commit is the one that set it (`git log -G "R5.1 .*DONE"`). Rows done before keep their hashes. | 2026-10-05 |
| D137 | **The appointments on a closure's days show in its sheet, as the days are picked** (the user, answers D87's how): under the fields, before Save — how many, the first 20 by time with the patient, day, time and doctor, and "And n more"; saving leaves them booked, to be moved or cancelled from the calendar. A patient is named only to someone who may see them (`appointments.view`, within the doctor scope); anyone else reads "A patient". `closure_appointments` in `0017`, `GET /api/closures/appointments`. | 2026-10-11 |
| D138 | **An arrived patient who leaves before being seen is a no-show** (the user): the status table gains Arrived → No-show, so the queue's Waiting column offers it (§11.4); they keep their token, and No-show → Arrived brings them back. | 2026-10-11 |
| D139 | **A walk-in is refused on a closed day, like a booking** (the user): a clinic holiday, or the doctor's leave (`APPOINTMENT_ON_CLOSED_DAY`, naming the closure's reason). If the clinic opens after all, today's closure is removed first. A patient booked before the closure was added may still be marked Arrived. | 2026-10-11 |
| D140 | **A patient with appointments to come is not archived until they are cancelled or moved** (the user): one still to come today or later, or under way, refuses the archive (`PATIENT_HAS_APPOINTMENTS`), and the card names its day ("Rohan Mehta has an appointment on 12 Oct"). One left unmarked on a past day does not count. | 2026-10-11 |
| D141 | **A patient keeps their token for the day** (the user): going back from Arrived — to Scheduled (a wrong tap) or No-show (they left) — keeps it, and arriving again that day gives the same number. Moving the appointment to another day or doctor gives it back. The counter never goes back, so no two share one. | 2026-10-11 |
| D142 | **A confirmed appointment moved is scheduled again** (the user): moving it to another time, or another doctor, sets it back to Scheduled for the patient's yes; a change of notes, length or type alone keeps it confirmed. | 2026-10-11 |
| D143 | **A patient arrives only on the appointment's own day** (the user): one booked for another day is moved to today, or the patient is added as a walk-in (`APPOINTMENT_NOT_TODAY`). A token belongs to today's queue. | 2026-10-11 |
| D144 | **The booking sheet finds its patient by a search in the sheet** (the user): name, mobile or number typed at the top, the best six matches under it to choose from, and once chosen the patient with **Change**. Archived patients are not found (D103). | 2026-10-11 |
| D145 | **A new patient is added inline, saved with the booking** (the user): **New patient** (with `patients.create`) opens name, mobile, date of birth or age and gender in the sheet, filled from what was searched (D112), with "Already here?" on the mobile to choose one already there. One **Book** adds the patient, under their own key, and books them; if the booking is refused, the patient stays added, the refusal names them and the sheet goes on with them found — so a booking sent again adds no one twice. | 2026-10-11 |
| D146 | **A time is picked as its hour, then its minutes** (the user): two short lists side by side — 12 AM to 11 PM, and :00 to :55 on the clinic's 5-minute steps — the kit's `ClockField`. The hour list opens on the hour it is now for today, on 9 AM for another day; every hour can be booked (D7). | 2026-10-11 |
| D147 | **The sheet shows what the doctor already has that day** (the user): under the time, "Maya Rao that day: 10:00 AM – 10:30 AM, 11:00 AM – 11:15 AM", or that nothing is booked yet — times only, never patients, for whoever books (`doctor_booked_times` in `0017`, `GET /api/appointments/booked`). | 2026-10-11 |
| D148 | **A time taken is named on the card, and the sheet keeps everything** (the user): "Maya Rao is booked 10:00 – 10:30 AM" on the card and at the time; a closed day names its closure ("The clinic is closed that day: Diwali"). Booking again sends the same key. | 2026-10-11 |
| D149 | **The sheet starts on today, the doctor and the clinic's first type** (the user): the date today; the doctor the one booking, or the clinic's only doctor, otherwise none (as D108); the type the clinic's first active one with its length; the time empty. | 2026-10-11 |
| D150 | **Booked, the sheet closes with a card** (the user): "Booked Rohan Mehta · 13 Oct, 10:30 AM with Maya Rao". The calendar behind it (R5.3) shows the day. | 2026-10-11 |
| D151 | **The length is chips, plus Other** (the user): 10, 15, 20, 30, 45 and 60 minutes, the type's own length chosen; **Other** opens a minutes field (5 – 480) starting from the length it leaves. Choosing a type sets its length again. | 2026-10-11 |
| D152 | **The calendar's grid runs 8 AM to 8 PM, stretching to fit** (the user): on a tablet or a desktop the day and the week show 8 AM – 8 PM, reaching to the hour before the earliest appointment and after the latest when they fall outside (`CALENDAR_HOURS`). Every hour can still be booked (D7). | 2026-10-11 |
| D153 | **Cancelled appointments and no-shows are folded away, counted** (the user): the calendar shows what is still happening; "Cancelled and no-shows (n)" at the foot opens them, quiet, with their status. On the grid they are left off, so their time looks free — it is. | 2026-10-11 |
| D154 | **Walk-ins show in the calendar at the time they arrived** (the user), marked Walk-in with their token; on the grid, which they hold no slot of, they share the column beside the bookings, on the soft green. | 2026-10-11 |
| D155 | **The calendar opens on today, every doctor's for the front desk, a doctor their own** (the user): a member with the Doctor role starts on their own; the owner and staff on All doctors. Anyone may switch. The page's first read is keyed the same way. | 2026-10-11 |
| D156 | **The grid is in quarter hours; a tap on an empty quarter books there** (the user): it opens the booking sheet with that doctor, day and time (10:15), which can still be set to any 5 minutes. Not on a closed column, nor before now. | 2026-10-11 |
| D157 | **The phone's date strip reaches a week back and four weeks ahead** (the user), today in view; any other day through the calendar button beside it (the kit's date picker), the strip then reaching around that day. | 2026-10-11 |
| D158 | **The week view is Monday to Sunday, one doctor** (the user): the week holding the chosen day, a column a day, for the doctor chosen — the first doctor when All doctors was on — with previous and next week. | 2026-10-11 |
| D159 | **An appointment does not open until R5.4** (the user): the calendar shows appointments; their detail, with confirm, reschedule and cancel, comes with R5.4. | 2026-10-11 |
| D160 | **An appointment opens as a sheet over the screen** (the user): tapped on the calendar — the grid, the day's list, the cancelled — or on a patient's profile, its detail comes up from below on a phone and from the side on a desktop: who, when, with whom, what kind and where it stands, its notes, who booked it and when, who cancelled it, when and why, and **Open profile** (not on the profile itself). It opens on what the calendar holds and fills in. Under it, the actions its status allows the one looking. `GET /api/appointments/[id]`. | 2026-10-11 |
| D161 | **Reschedule reopens the booking sheet, the patient staying** (the user): its doctor, day, time, type, length and notes where it is now, under every rule a booking keeps; a time kept where it is is not refused as passed, and the doctor's taken times leave its own out. One that can no longer move — arrived, a walk-in, done or cancelled — offers **Edit notes** alone, since notes change at any time. Moved, it closes with a card. `PATCH /api/appointments/[id]` takes the notes alone, or the move. | 2026-10-11 |
| D162 | **A cancellation takes a quick reason, or one typed, then asks first** (the user): Patient asked, Doctor unavailable, Clinic closed, Booked by mistake, or **Other** (a line, at most 200 characters); the coral card then asks, naming when, with whom and why. The reason is saved as its words and audited by name alone. | 2026-10-11 |
| D163 | **No-show is offered once its time has passed, asking first** (the user): not before the appointment's start; the card says it cannot go back to scheduled, and that a patient who comes later that day can still be marked arrived (D138). | 2026-10-11 |
| D164 | **Arrived comes with the queue** (the user): R5.5 brings arrivals, tokens and the fee step (D44) together; the detail gains **Arrived** then. | 2026-10-11 |
| D165 | **Done, the detail closes with a card** (the user): "Confirmed Rohan Mehta · 13 Oct, 10:30 AM" — and the same for a no-show, a cancellation, a move and notes saved — as booking does (D150); the calendar behind shows the new status. | 2026-10-11 |
| D166 | **The profile names the next appointment, or books one there** (the user): the soonest still to come — its day, time, doctor and kind, opening its detail — or "No appointment to come" with **Book**, which opens the booking sheet on the profile for them (no search, the doctor first to fill); booked, the section shows it. For `appointments.view`; Book for `appointments.create`, not for an archived patient. `GET /api/patients/[id]/summary`, each part only with its permission. | 2026-10-11 |
| D167 | **The profile's history lists every appointment, newest first** (the user): those still to come, then the past, cancelled ones and no-shows quiet with their reason, 20 at a time, each opening its detail — in the one column (D114) until visits arrive in Phase 6. `GET /api/patients/[id]/timeline`, each part only with its permission. | 2026-10-11 |
| D168 | **On a phone the queue is stacked, as shaped** (the user, choosing §32.1 over §11.4's tabs): the patients with a doctor in the lake on the land — "The room is free" when no one is in — then Waiting by token, Still to come, and Done folded with its count. | 2026-10-12 |
| D169 | **From a tablet up the queue's sections sit side by side** (the user): Waiting · With doctor · Still to come · Done — two to a row on a tablet, four on a desktop — a tapped patient opening in the side sheet. The left panel with the visit beside it (§32.1) can come with the visit workspace (R6.2). | 2026-10-12 |
| D170 | **The queue opens on every doctor's for the desk, a doctor's own for a doctor; anyone may switch** (the user), as the calendar does (D155): capsules on the land, All doctors and one per doctor, shown when there is more than one. | 2026-10-12 |
| D171 | **The walk-in sheet asks for the patient, the doctor and the type** (the user): the patient found by the search or added there (name, mobile, date of birth or age, gender, with "Already here?"); they arrive now with the doctor's next token. Notes are added later from the detail. `POST /api/appointments/walk-in`. | 2026-10-12 |
| D172 | **A queue row carries its main action; the rest are in its detail** (the user): Still to come shows **Arrived** on the row, Waiting will show **Send in** (R6.1); No-show and Cancel are in the appointment's detail, a tap away. | 2026-10-12 |
| D173 | **A patient joining the queue is told their token first** (the user): adding a walk-in, or marking a booking Arrived — on the row or in the detail — closes with "Rohan Mehta is #7 with Maya Rao". `add_walk_in` hands back the token with the appointment. | 2026-10-12 |
| D174 | **A patient past their time is marked late, and stays** (the user): "10:30 AM · Late 25 min" in coral words, in Still to come until marked Arrived or a no-show. | 2026-10-12 |
| D175 | **The walk-in sheet starts on the queue's doctor** (the user): the doctor whose queue is showing; on All doctors, the one adding it if they are a doctor, else the clinic's only doctor; otherwise none, to be chosen (as D149). | 2026-10-12 |
| D176 | **The race tests prove bookings, moves, tokens and repeated keys** (the user): ten desks booking one doctor's time at once book one and are told the rest is taken; overlapping times booked at once leave none overlapping, each refusal naming one that stands; two moves into one time move one; ten arrivals and walk-ins for one doctor at once take tokens 1 to 10, another doctor's apart; the same booking, walk-in or arrival sent twice at once makes one. Against the real database, each request its own transaction (`appointment-races.test.ts`). | 2026-10-12 |
| D177 | **Phase 5's journey runs as the plan's, its members joining by invite** (the user): the owner invites a receptionist and a doctor, each joins by their link with the real presets; the receptionist adds a patient (mobile-match hint), books, has a booking into that time refused, adds a walk-in and arrives the booked patient, each with a token; the doctor cannot open a patient booked only with another doctor; a second clinic reaches none of it (`front-desk-journey.spec.ts`). | 2026-10-12 |
| D178 | **The journey proves the queue refreshes on its own** (the user): the doctor keeps their queue open on their own device, and the walk-in the desk adds shows there within the 15-second refresh, without a reload. | 2026-10-12 |
| D179 | **Remind sits in the detail and on the lists' rows** (the user): "Remind on WhatsApp" in an appointment's detail; a round WhatsApp icon on the queue's Still to come rows, beside Arrived, and on the calendar's day list for today and the days to come — §22.1's "tomorrow's list". | 2026-10-12 |
| D180 | **A reminder is noted when Remind is tapped** (the user): WhatsApp opens with the message and "Reminded" is noted at once — the app cannot see whether Send was pressed — again each time it is tapped. The detail says when; the rows say "Reminded". `POST /api/appointments/[id]/reminded` (`mark_reminded`). | 2026-10-12 |
| D181 | **In a view-only clinic Remind still opens WhatsApp, and nothing is noted** (the user): sharing what is there still works (§7.2); nothing new is written. The detail offers the reminder alone. | 2026-10-12 |
| D182 | **Reminders are for those who may change appointments** (the user): `appointments.edit`, the front desk that confirms and arrives. | 2026-10-12 |
| D183 | **The share helper comes with its first PDF** (the user): handing a PDF to WhatsApp through the share sheet, or downloading it on a desktop, is built in R6.8 with the prescription, the first PDF sent — not in R5.7 with nothing to share. R5.7 keeps the link helper and reminders. | 2026-10-12 |
| D184 | **Remind is offered for a booking still to come, today or later** (the user): scheduled or confirmed — a late patient today too — never a walk-in, nor anyone arrived, done, cancelled or a no-show. | 2026-10-12 |
| D185 | **Speed, security and smoke tests are set up in Phase 13, and gate what follows** (the user): "make sure in phase 13 all these 3 tests will be setup and only after all the tests up and come back and passed, then we will move to deployment or next phase". Phase 13 adds speed checks (R13.7), security checks (R13.8) and a smoke test (R13.9), each run by CI. Phase 13 is DONE only when all three are set up and pass, and Phase 14 starts only then. From then on, a release deploys only when they pass (§35). | 2026-10-12 |
| D186 | **The smoke test runs before users see a release** (the user): the release deploys the new version to its own address without the domain (`vercel deploy --prebuilt --prod --skip-domain`), runs the smoke test there, and moves the domain to it (`vercel promote`) only when it passes. A failure leaves the live version untouched. | 2026-10-12 |
| D187 | **The smoke test signs in to nothing** (the user): no password is kept in GitHub; the DEV account, which extends plans and deletes clinics, is never a CI secret. It proves the database through the landing page's live price and Supabase Auth through a wrong password refused as the app refuses it. | 2026-10-12 |
| D188 | **The dependency audit fails on high and critical advisories in shipped code** (the user): `npm audit --omit=dev --audit-level=high`, on every PR and weekly. Build and test tools are reported, not gated. The advisories open today in shipped code (`next` 16.2.x critical; `sharp` and `source-map-js` high) are fixed in R13.8. | 2026-10-12 |
| D189 | **Every test passes locally before CI and before a release** (the user): "make sure these tests pass locally first before the deployment and CI run". `npm run verify` runs, on this machine and in CI's order, everything CI runs: lint, format, types, coverage, the security checks, the build, E2E, the speed checks and the smoke test. A git pre-push hook runs it and refuses the push when anything fails; a push is never sent with `--no-verify`. A release also needs `npm run test:speed` passed locally on the load seed before it is tagged. CI and the release workflow then run the same again. | 2026-10-12 |
| D190 | **A screen opened again shows what its page was just read with, and is not read twice** (the user, "go ahead and fix it"): the data a page arrives with replaces what the browser kept from the last visit, so nothing older flashes first and the browser does not ask the API for it again. A list starts again from its first page. A page brought back by Back or Forward is the one read when it was first opened, so it changes nothing: the screen shows what the browser has and asks again. | 2026-10-13 |
| D191 | **A list's tab or filter shows its own rows, never the last one's** (the user, chosen over fixing Brio as well): while what is searched changes within one tab or filter, the last rows stay on screen until the new ones arrive; another tab or filter shows its own rows if they have been read, and loading rows while they come. Brio showed the last tab's rows under the new tab's name until the answer came. | 2026-10-13 |
| D192 | **Sending in while a doctor has someone in asks, and may keep both** (the user, for a dentist working two chairs): "Rahul Mehta is still with Maya Rao" offers **Mark done and send in** (everyone with that doctor marked done, one transaction) or **Keep both in**. A doctor may have more than one patient in; each sits in the lake. Sent without a choice while someone is in, `send_in` refuses (`DOCTOR_ROOM_TAKEN`), so a second desk cannot slip past the question. | 2026-10-13 |
| D193 | **Anyone with `appointments.edit` may press Next patient** (the user: "in cases where staffs are there, can the staff click next patient as doctors can be busy?"): beside each patient in the lake and the With doctor column, on a doctor's queue and on All doctors, and in the visit screen. Done and Send in stay, for when the desk wants someone else next. | 2026-10-13 |
| D194 | **Next patient leaves you where you pressed it** (the user): from the visit screen, the next patient's visit opens; from the queue, the queue stays and the lake shows them. With no one waiting the visit closes, a card says so, and the visit screen goes back to the queue. | 2026-10-13 |
| D195 | **R6.1's visit screen is its header and controls** (the user): `/visits/[id]` with the patient (name, age and sex, number), token, doctor, alerts, Open or Done, and **Done** and **Next patient**; opened from the patient's name in the lake, a With doctor row, or **Open visit** in the appointment's detail (`visits.view`). R6.2 adds its sections. | 2026-10-13 |
| D196 | **With two in, Next patient finishes only the patient it is for** (the user): the visit on screen, or the lake patient it sits beside; the other chair's patient stays in. Then the doctor's lowest waiting token is sent in. Pressed twice for the same patient, it sends in one. With the room free it sends in the lowest token, once. | 2026-10-13 |
| D197 | **Back to waiting removes an empty visit, and keeps one with anything recorded** (the user): with nothing recorded (from R6.2: vitals, notes, a prescription), the visit Send in opened is removed, so the booking can still be cancelled or marked a no-show. With anything recorded it stays open and continues when they are sent in again; that appointment then ends only with Done (`APPOINTMENT_HAS_VISIT`). | 2026-10-13 |
| D198 | **A waiting patient may be marked Stepped out** (the user: "in some case the patient in the queue wont be present there so someone else is sent in and later that guy is sent in"): from the appointment's detail (`appointments.edit`), they keep their token and place in Waiting, shown "Stepped out", and Next patient skips them; **Send in** still works on them, and **Back** clears it. `appointments.stepped_out_at`, cleared when they are sent in or their appointment changes status. | 2026-10-13 |
| D199 | **Push straight to `main` until the first release** (the user: "until i release a version no need of creating pr and merging to main, can directly push to main, later we can do the formalities"): the code lives at github.com/mohd-jaffa/clinic, public by the user's choice. Each commit goes on `main` and is pushed once the whole suite has passed locally; CI runs on every push. Branches and PRs with CI green start with the first release. | 2026-10-13 |
| D200 | **The user pushes; the agent only commits** (the user: "no need of you to push, just commit to main until release, i will push when needed"): until the first release, each finished change is committed on `main` after the whole suite passed locally, and is not pushed. The user pushes when they choose, and CI runs then. This narrows D199, which had the agent push each commit. | 2026-10-13 |
| D201 | **A waiting patient may be marked Urgent; it is a tag, nothing more** (the user: "staffs or anyone with edit person can make someone as urgent, but next patient wont take them first, they will have a label or tag as urgent, thats all"): with `appointments.edit`, from the appointment's detail (the user's choice). Marked only while waiting; it stays through the visit, shown on the queue row, in the lake, on the appointment and at the top of the visit, so the doctor sees it (the user's choices). **Next patient still goes by token**; Send in already takes anyone (§11.4). **Not urgent** takes it off while waiting or in; leaving the queue another way drops it. `appointments.urgent_at`, `mark_urgent` (0019), audited. | 2026-10-13 |
| D202 | **The visit's sections are fields on the screen, each with its own Save** (the user): vitals, complaint/diagnosis/notes and follow-up each a card with its fields open; **Save** shows once something is typed and saves that section alone (plan §12.2: "saving is per section"). Whoever may only read sees read-outs, the vitals in big numerals (§32.1). | 2026-10-13 |
| D203 | **Vitals may be taken while the patient waits** (the user): the waiting patient's detail offers **Vitals** (`visits.create`). The first reading opens their visit, not yet started (`started_at` empty); Send in then continues it and starts it, as it continues one kept by Back to waiting (D197). A visit is opened only with a reading, so an empty one never blocks a cancel or a no-show. | 2026-10-13 |
| D204 | **New visit from a patient's profile, in R6.2** (the user): `visits.create` (and `visits.view` to open it), while the clinic can write and the patient is not archived. A doctor starts their own at once; anyone else chooses the doctor (their own, or the only one, chosen first). A patient already in with that doctor has that visit opened instead. Its **Done** closes it as To bill (`finish_visit`); a visit from the queue is done there. | 2026-10-13 |
| D205 | **Follow-up chips: 3 days, 1 week, 2 weeks, 1 month** (the user), after the visit's day, beside a date picker for any later day; **Book next appointment** opens the booking with the patient, the doctor and that day filled in, for `appointments.create`. | 2026-10-13 |
| D206 | **A save made from an older copy is refused** (the user): each section's save carries the section as the screen last read it; the database refuses it when someone saved it meanwhile (`VISIT_CHANGED`). The section shows theirs under what is typed — kept — with **Use theirs**; saving again keeps yours, knowingly. Untouched, a section follows what others save. | 2026-10-13 |
| D207 | **Alerts can be changed from the visit** (the user): the same **Alerts** button and sheet as the profile in the visit's header — pencil for `visits.edit`, eye otherwise — so an allergy found mid-visit is added there, and the visit shows it. | 2026-10-13 |
| D208 | **After Done, any change is a correction, and needs `visits.edit`** (the user): vitals included. While the visit is open, vitals need `visits.create` and notes and follow-up `visits.edit` (§8.1). | 2026-10-13 |
| D209 | **Two columns on a wider screen** (the user): from a tablet, vitals, follow-up and the visit's details on the left, complaint/diagnosis/notes on the right (the prescription joins it in R6.3); a phone stacks vitals, notes, follow-up. | 2026-10-13 |
| D210 | **A prescription's medicines are fields on the visit screen, saved together** (the user): each medicine a block of its fields in the Prescription card, with **Add medicine**, and Move up, Move down and Remove on each; one **Save prescription** for the medicines, the advice and the diagnosis tick, shown once something is typed, and refused from an older copy as every section is (D206). | 2026-10-14 |
| D211 | **A suggested medicine fills its whole line** (the user): the suggestions are this clinic's medicines beginning with what is typed, one for each medicine and strength ("Paracetamol 500 mg", "Paracetamol 650 mg"); taking one fills the dose, frequency, timing, days and instructions as this doctor last wrote them, or as anyone in the clinic did if they never have. Everything stays editable. | 2026-10-14 |
| D212 | **An allergy is warned on its line and asked about at Save** (the user): a medicine whose name contains one of the patient's active allergies shows "Allergy: Penicillin" on its line as it is typed, and **Save** asks once, on a confirm card naming each match. A match of words, never a refusal. | 2026-10-14 |
| D213 | **No prescription until the doctor has a registration number** (the user): the Prescription card says the number is missing and is added in Team (with **Open Team** for whoever manages it); the database refuses the save (`PRESCRIPTION_NEEDS_REGISTRATION`). | 2026-10-14 |
| D214 | **Frequency and timing are chips** (the user): frequency 1-0-0, 0-1-0, 0-0-1, 1-0-1, 1-1-0, 0-1-1, 1-1-1, 1-1-1-1 and SOS, and **Other** to type anything ("Once a week"); timing Before food, After food, With food, Empty stomach, Bedtime. A chip tapped again is none. | 2026-10-14 |
| D215 | **A prescription is changed after Done as before it** (the user): by the visit's doctor, or by `prescriptions.write` typing for them; D208's `visits.edit` is for the visit's own sections. `entered_by` and `updated_by` record who. | 2026-10-14 |
| D216 | **Print the diagnosis is off until the doctor ticks it** (the user), so a diagnosis is printed only by choice (§13). | 2026-10-14 |
| D217 | **A medicine's duration is typed in days** (the user): 1 to 365; a suggestion fills it. | 2026-10-14 |
| D218 | **The printed prescription: the clinic on top, the doctor under it** (the user): the letterhead across the top (logo, name, address, phone); under a rule, the doctor's name with their qualifications, specialization and registration number on the left, the date on the right; then the patient, the vitals and the diagnosis when it prints. The signature line stands at the foot of the last page; a later page carries the patient's name and the date at its top. | 2026-10-14 |
| D219 | **Medicines print as a numbered list** (the user), as on the screen: the name and strength in bold, how it is taken under it, then its instructions — no table, so long names never squeeze at A5. | 2026-10-14 |
| D220 | **Black and grey only** (the user): the same on any printer, black-and-white included, and photocopied; the logo keeps its own colours. | 2026-10-14 |
| D221 | **Print opens the PDF itself** (the user), in the browser's or phone's own viewer — the file as it will print, with its own print button; **Download** saves it. No preview sheet in the app: §33's on-screen preview is the viewer. | 2026-10-14 |
| D222 | **Print and Download once saved** (the user): on the Prescription card once it is saved with a medicine on it — for anyone who reads the visit, a view-only clinic included; while there are unsaved changes, Save takes their place, so a printout never misses what is on the screen. | 2026-10-14 |
| D223 | **The file is "{patient} - {date} - Prescription.pdf"** (the user): "Rohan Mehta - 14 Oct 2026 - Prescription.pdf", easy to find in Downloads or a chat. | 2026-10-14 |
| D224 | **The PDF prints English letters now; Indian scripts later** (the user): its font (Figtree) covers Latin, accents and ₹; a name typed in another script prints as blank boxes, so clinics type names in English. Noto fonts for the Indian scripts are in §42. | 2026-10-14 |
| D225 | **A patient's history is one list, a visit standing for its appointment** (the user): their visits and the appointments that have none — still to come, cancelled, missed — newest first, 20 at a time; an appointment that became a visit shows once, as the visit, and a visit started from the profile shows too. Each part only with its permission: visits with `visits.view`, appointments with `appointments.view`; someone who sees no visits sees every appointment, as D167 did. `GET /api/patients/[id]/timeline` reads a page of each at once, and its cursor counts how many of each are shown. | 2026-10-15 |
| D226 | **A visit's row says what it found and what was prescribed** (the user): its day and "Visit", its doctor, the diagnosis — or the complaint when there is none — "Rx Paracetamol, Amoxicillin +1" (two named, the rest counted) on a line under it, and where it stands (Open, Done). A visit that holds nothing at all says "Nothing recorded" (`visit_recorded`, the same test as Back to waiting's, D197). | 2026-10-15 |
| D227 | **A visit in the history opens its screen** (the user): the whole record — vitals, notes, follow-up, the prescription with Print and Download — and editing for whoever may. | 2026-10-15 |
| D228 | **The patients list's last visit shows to everyone who sees the patient** (the user): the day alone, not what was done — "today" for today's — and nothing for a patient never seen. Worked out in the list's own query (`last_visit_on`), past the visits' policy but only for a patient the caller may see; the list waits on no more round trips. | 2026-10-15 |
| D229 | **The last visit is a line of its own on the row** (the user): under age · gender · number, so a phone never cuts it short; Phase 8's balance chip takes the row's end. | 2026-10-15 |
| D230 | **A visit opened from the profile leads back to it** (the user): opened from the history or New visit, the visit's back arrow returns to the patient's profile (`?from=patient`); opened from the queue, it still goes to the queue. | 2026-10-15 |
| D231 | **On a desktop the profile is two columns** (the user; D114): the next appointment and the details on the left — open treatments and the balance join them in their phases — and the history on the right; a phone stacks them in that order. | 2026-10-15 |
| D232 | **The race tests prove the visit's moves and saves at once** (the user): the desk and the doctor pressing Next patient together send one patient in — the lowest token — with the room free or after the patient in, both told who is in, no one skipped; Send in, Done and New visit pressed twice at once make one visit, closed once, audited once; the doctor and the assistant saving the vitals (a waiting patient's too, opening one visit), the notes or the prescription from the same copy at once keep one and tell the other it changed (D206); the prescription saved as the desk marks the patient done keeps both. Against the real database, each request its own transaction (`visit-races.test.ts`). | 2026-10-15 |
| D233 | **Phase 6's journey continues Phase 5's** (the user): the same clinic, its members joined by invite, an assistant among them; the desk sends the walk-in in and marks him done with nothing recorded (To bill); the doctor's Next patient sends the booked patient in; the assistant takes vitals and adds an allergy; the doctor writes the diagnosis; the assistant types the prescription, warned of the allergy at its line and at Save; it prints on the clinic's A5; a review in a week; Next patient with no one waiting closes the visit (`front-desk-journey.spec.ts`). Templates (R6.7) and billing (Phase 8) join it in their rows. | 2026-10-15 |
| D234 | **The journey proves the doctor's open visit follows the assistant's** (the user): the vitals and the allergy the assistant saves show on the doctor's visit, open on their own device, within its 15-second refresh, without a reload. | 2026-10-15 |
| D235 | **The journey checks the prescription PDF's paper, name and title** (the user): A5 from the clinic's paper size, "Anita Rao - {day} - Prescription.pdf", its title naming her, opened in a tab of its own and downloaded; what it prints line by line stays with the unit tests. | 2026-10-15 |
| D236 | **Repeat last shows its date and doctor** (the user): the button reads "Repeat 12 Oct · Dr. Maya Rao" — the patient's latest prescription with a medicine on it, from their visits before this one, by any doctor — and is hidden when there is none. It is read with the visit (`previous_prescription`, 0023), so the tap fills the form with no wait; the planned `GET /api/patients/[id]/last-prescription` is not needed. | 2026-10-15 |
| D237 | **Repeat last and a template add after what is typed** (the user): their medicines join the end of the list, as a template's do (§13), so nothing typed is lost; a duplicate line is removed by hand. Past 30 medicines nothing is added, and the card says why. | 2026-10-15 |
| D238 | **Their advice fills the box if it is empty, else joins it on a new line** (the user) — unless the same words are already there. | 2026-10-15 |
| D239 | **The buttons are in view** (the user): **Repeat** and **Templates** above the medicines; **Save as template** beside Add medicine once there is a medicine, for the doctor (D240). | 2026-10-15 |
| D240 | **Only the doctor saves, edits and archives a template** (the user): templates are theirs; whoever types for them (`prescriptions.write`) applies them and changes none. | 2026-10-15 |
| D241 | **A template is picked from a sheet** (the user): **Templates** opens the visit doctor's templates by name, each with its medicines under it ("Paracetamol, Amoxicillin +1"); one tap applies it and closes the sheet. | 2026-10-15 |
| D242 | **My account holds the doctor's templates** (the user): a **Prescription templates** row, for a member who is a doctor, opens their screen: **New template** starts one from scratch; each opens a screen of its own to change its name, medicines and advice; **Archive** asks first, and **Show archived** brings one back with **Restore**, as the price list does (D80). A template holds a medicine or advice, or both. | 2026-10-15 |
| D243 | **A template saved under a name in use asks to replace it** (the user): from a visit or as a new template, "Replace your template 'Viral fever'?" — yes takes its medicines and advice. Renaming one to a name in use, or restoring one whose name is taken, is refused (`TEMPLATE_NAME_TAKEN`). | 2026-10-15 |
| D244 | **Send on WhatsApp sits beside Print and Download** (the user): **WhatsApp** on the Prescription card's foot once it is saved with a medicine, for anyone who reads the visit — a view-only clinic too, sharing what is there (§7.2) — and, as Print, not while there are unsaved changes (D222). | 2026-10-15 |
| D245 | **On a phone, the share sheet takes the PDF and the message** (the user): "Your prescription from Dr. Maya Rao, Smile Care, 15 Oct." with the file; the person picks WhatsApp and the chat. Some apps drop the message when a file goes with it; the PDF always goes. Should the phone ask for a fresh tap once the PDF is fetched, a card offers **Send**. | 2026-10-15 |
| D246 | **On a desktop, WhatsApp Web with the message, and the PDF downloaded** (the user): a device without a share sheet for files — any but a touch-first one — opens the patient's chat in a new tab with the message typed, and downloads the PDF; the card says to attach it (§22.1). | 2026-10-15 |
| D247 | **A prescription sent is not recorded** (the user): as Print and Download, sending writes nothing — the app cannot see whether Send was pressed in WhatsApp. | 2026-10-15 |
| D248 | **A session starts a planned or on-hold treatment** (the user): the first session recorded on a planned treatment puts it in progress, started on that visit's day; one on an on-hold treatment resumes it. Nobody sets the status by hand for it. | 2026-10-15 |
| D249 | **Any of the patient's visits may record a session** (the user): a root canal Dr. Rao started can be continued in Dr. Iyer's visit; the session carries its visit's doctor, and the treatment stays Dr. Rao's. | 2026-10-15 |
| D250 | **A cancellation may say why** (the user): the confirm card has a short reason box ("Patient declined") that may be left empty; the reason shows on the treatment (`cancel_reason`, with `cancelled_at` and `cancelled_by`). | 2026-10-15 |
| D251 | **A treatment changed from an older copy is refused** (the user), as a visit's sections are (D206): its details and its status are saved from what the screen last read, and a change made meanwhile refuses the save (`TREATMENT_CHANGED`), showing theirs beside what was typed. A session's note is part of its visit (`VISIT_CHANGED`). | 2026-10-15 |
| D252 | **A treatment's doctor may change while it is open** (the user): started in a visit, it is that visit's doctor's; started from the profile, a doctor is picked. While it is open it can be handed to another doctor, who then sees the patient (§27.3). Once completed or cancelled it keeps its doctor and has no next due day. | 2026-10-15 |
| D253 | **The estimated cost shows to whoever sees the treatment** (the user): `visits.view`, as the rest of it — information for the talk with the patient, not a bill. | 2026-10-15 |
| D254 | **A session recorded by mistake is removed while its visit is open** (the user), by `visits.edit`; once the visit is done it stays and only its note is corrected (`TREATMENT_SESSION_KEPT`). A treatment the session started stays started. | 2026-10-15 |
| D255 | **A patient with an open treatment is not archived until it is completed or cancelled** (the user), as one with an appointment to come (D140): a planned, in-progress or on-hold treatment refuses the archive (`PATIENT_HAS_TREATMENTS`), and the card names the first of them to whoever reads treatments ("Rohan Mehta has an open treatment: Root canal") — to anyone else, only that there is one — so archived patients never fill the follow-ups. | 2026-10-15 |
| D256 | **A visit's treatments are rows, each opening a sheet** (the user): the Treatments card lists the patient's open treatments, and any started or worked on in this visit (`visit_treatments`, 0025); a row says what this visit did for it ("This visit: Canal cleaned", "Started this visit"). Its sheet holds this visit's note, saved with **Save session**, and the status actions; **Add treatment** starts one. | 2026-10-15 |
| D257 | **The last sitting completes it in one save** (the user): the sheet's **This completes it** tick saves the session and completes the treatment together, or neither (`record_treatment_session`'s `p_complete`, 0025). | 2026-10-15 |
| D258 | **A treatment started in a visit begins today, its estimate from the price list** (the user): the sheet starts on **Start today** (this visit its first session, with what was done) — **Plan it** is a tap away; picking one of the price list's procedures fills its name and its price as the estimate, both still editable. From the profile it starts planned, for the doctor chosen: the caller if a doctor, else the patient's own. | 2026-10-15 |
| D259 | **A treatment's next sitting is its own date, with chips** (the user): in its sheet, 3 days, 1 week, 2 weeks or 1 month from today, or any day from today on, saved alone (**Save next sitting**) — separate from the visit's follow-up, as §14.2 counts them apart. | 2026-10-15 |
| D260 | **The profile lists the open treatments, then Show closed** (the user): name, status, doctor, when next due ("Due in 3 days", "Overdue by 4 days") and the estimate; completed and cancelled ones behind **Show closed (2)**, the latest closed first. | 2026-10-15 |
| D261 | **A treatment's whole story is in its sheet** (the user), from the visit or the profile: its details, its status actions, **Edit** (name, description, estimate, and its doctor while open), its next sitting, and its sessions visit by visit, each opening its visit. No screen of its own. | 2026-10-15 |
| D262 | **A visit's row in the history names its treatments** (the user): under the Rx line, "Tx Root canal, Crown +1" — those worked on or started in it, two named and the rest counted. | 2026-10-15 |
| D263 | **On a desktop the Treatments card stands between the notes and the prescription** (the user), in the right column, the plan's order (§12.2); a phone stacks the sections in that order. | 2026-10-15 |
| D264 | **Next.js 16.3.8** (the user): from 16.3.5, whose four critical advisories it fixes (remote code execution in `next/og`'s ImageResponse, which the app does not use; cache poisoning of self-hosted pages; a draft-mode leak; the dev server's MCP endpoint) — the same minor line, its own commit; `eslint-config-next` with it, and `source-map-js` (high, build-time only) to 1.2.2. One finding stays: a chain inside the lint tooling (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`), never shipped, whose only fix npm offers is going back to `eslint-config-next` 14; R13.8's audit (`--omit=dev`) leaves development tools out, and the chain is updated once `eslint-config-next` ships a fix. | 2026-10-15 |
| D265 | **A test that compares a database time with the test's clock allows 2 seconds of drift** (the user): the database runs in Docker, whose clock can run a few milliseconds ahead of the Mac's; `appointment-detail.test.ts` once failed on 46 ms. It still checks the booking was made just now. | 2026-10-15 |
| D266 | **The vital-sign limits stay as they are** (the user): blood pressure 50 – 260 over 30 – 160 mmHg, pulse 20 – 250, temperature 90 – 110 °F, SpO₂ 50 – 100 %, breathing 5 – 70 a minute, weight 0.5 – 350 kg, height 20 – 250 cm — a newborn's to an adult's, so a slip ("1200") is caught and a real reading never refused. They protect their columns, so they stay constants (`VITAL_LIMITS`), the vitals table's CHECKs kept equal by tests/db (AGENTS.md §10). | 2026-10-15 |
| D267 | **The front desk works the follow-ups too** (the user): anyone who sees appointments or visits (`appointments.view` or `visits.view`) lists them — the patient, what is due (a treatment's name, or "Follow-up"), its doctor and day, and the last contact; nothing more of the record — and `appointments.edit` or `visits.edit` notes a call. A doctor sees only their own patients' (D3). The plan had `visits.view` and `visits.edit` alone, so a receptionist could not make reminder calls without clinical access. | 2026-10-15 |
| D268 | **A follow-up closes when the patient is coming back** (the user): an appointment for a later day than the one it was set on, with any doctor, still to come or kept — not one cancelled, missed, or left unmarked on a day gone by, and its cancelling reopens the follow-up; or a visit opened after it was set, with any doctor; or, for a treatment, its closing or losing its next due day. A treatment keeps when its next due day was set (`next_due_set_at`); a visit's is set with the visit. | 2026-10-15 |
| D269 | **An on-hold treatment's next due day is a follow-up** (the user): a date on a paused treatment is a deliberate reminder ("resume in a month"); one with no date shows nothing. | 2026-10-15 |
| D270 | **Upcoming and Completed look 30 days, fixed in code** (the user): `FOLLOW_UP_WINDOW_DAYS`, how far a list looks rather than a rule a clinic lives by; when an overdue one lapses stays the DEV's setting (`follow_up_lapsed_days`, §6). | 2026-10-15 |
| D271 | **A follow-up snoozed with "remind me on" leaves the lists and the counts until that day** (the user), then returns to whichever tab its due day puts it in; Home's follow-ups agree. | 2026-10-15 |
| D272 | **A follow-up's row carries Call; everything else is in its sheet** (the user): the row names the patient, what is due and with whom, when, and the last contact, with a round **Call** at its end — calling is what the desk does most. Tapping the row opens its sheet: what it is for, its doctor and day, the last contact, then **Call**, **Remind on WhatsApp**, **Book**, **Open profile**, and the **Mark contacted** form in place. | 2026-10-15 |
| D273 | **Remind on WhatsApp comes with the screen, noted as *Reminder sent*** (the user; R7.6 built with R7.4): WhatsApp opens with "Dr. Maya Rao at Smile Care asked to see you again around 14 Oct. Reply or call 0484 234 5678 to book." — the clinic's phone, when it has one — and the reminder is noted as a contact as it opens, as an appointment's is (D180), by whoever notes contacts. In a view-only clinic, or for one who only reads, it still opens, unnoted. | 2026-10-15 |
| D274 | **"Remind me on" has chips and a date** (the user): Tomorrow, 3 days, 1 week, 2 weeks from today, or any later day; left empty, the follow-up stays in its list. | 2026-10-15 |
| D275 | **A follow-up's sheet shows its last contact only** (the user), as the row does, with who made it — how it went, the day, by whom, and the note — read with the list, with no read of its own (`0027_follow_up_callers` hands back the caller's name). | 2026-10-15 |
| D276 | **Book from a follow-up fills the booking, and the row leaves on its own** (the user): the patient, the follow-up's doctor and its day — today for one overdue. Booked for a later day, the follow-up is done (D268) and leaves its list; nothing more is noted. | 2026-10-15 |
| D277 | **A treatment on Completed offers Call and the profile only** (the user): nothing is due, so there is no Remind, Book or Mark contacted; its sheet tells the treatment, the day it was completed and its doctor. | 2026-10-15 |
| D278 | **One list for the clinic, a phone's and a desktop's alike** (the user): no doctor filter — each row names its doctor, and a doctor sees only their own patients (D3); on a desktop, the tabs and one column of rows, like Patients, with the same sheet as on a phone. | 2026-10-15 |
| D279 | **The tabs are proven on the clinic's day at every edge, with no test clock in the app** (the user): the database's clock cannot be moved, so each edge is tested from the clinic's today — Today against yesterday, the last day of Overdue against the first of Lapsed, the 30th day ahead against the 31st, completed 30 days ago against 31, a snooze's own day — and the clinic's midnight where it can be fixed in time: a follow-up set at 1:30 AM in India, still the day before in UTC, is set on India's day, so an appointment kept that same India day does not close it and one the next day does. | 2026-10-16 |
| D280 | **That Lapsed follows the DEV's setting is tested by changing it and putting it back** (the user): as the DEV, 7 days, then 60, each moving a follow-up between Overdue and Lapsed with the counts, then the old value restored — integration files run one at a time, so no other test sees it. | 2026-10-16 |
| D281 | **R7.5 is database tests only** (the user): the tabs are worked out only in the database; the screen's words and counts were tested in R7.4's journeys. | 2026-10-16 |
| D282 | **Bills first, payments with R8.4** (the user): R8.1 issues bills only; the optional payment — **Collect now**, **Issue and collect** at arrival — joins `create_bill`'s transaction with the payments table in 0029, so the rows keep their order. | 2026-10-16 |
| D283 | **The fee at arrival is two steps: the token, then the fee bill** (the user): **Arrived** and **Add walk-in** give the token at once, as before; **Collect fee** follows, issuing a consultation bill for that appointment (`create_bill` with its `appointment_id`, while the patient is arrived or in) — **Skip** leaves it for checkout. A bill that fails never takes back the token; `mark_arrived` and `add_walk_in` are unchanged. | 2026-10-16 |
| D284 | **A typed line needs `payments.discount`** (the user): a line typed with its own price is a price change, so whoever bills without it bills from the price list and the doctor's fee only (D29, D88). | 2026-10-16 |
| D285 | **A treatment is billed through a price-list line naming it** (the user): the line is a price-list entry (Root canal ₹6,000), held to its price like any other, that also names the patient's treatment it is for; the new bill suggests the procedure of the treatment's name. A typed line names none. | 2026-10-16 |
| D286 | **A visit may take more than one bill** (the user): the arrival's fee and checkout's, or a line forgotten — the visit stays Billed; voiding one returns it to To bill only once nothing billed remains for it. | 2026-10-16 |
| D287 | **A visit marked No charge by mistake is simply billed** (the user): a bill issued for it makes it Billed and drops the reason; there is no separate undo. | 2026-10-16 |
| D288 | **A patient with a visit in To bill is not archived until it is billed or marked No charge** (the user), as one with an appointment to come (D140) or an open treatment (D255): the archive is refused (`PATIENT_HAS_VISITS_TO_BILL`), and the card names the first one's day ("Rohan Mehta has a visit to bill from 12 Oct"). | 2026-10-16 |
| D289 | **A Consultation line may be at its own price or the doctor's fee** (the user): without `payments.discount`, a price-list line in the Consultation category is accepted at its price-list price or at the bill's doctor's own fee (D26), so a clinic keeps a cheaper Review beside its Consultation. | 2026-10-16 |
| D290 | **A percentage discount is rounded to the nearest rupee** (the user): half a rupee rounds up — 15% off ₹333 is ₹50 off — so whole-rupee prices keep whole-rupee totals; worked out in integers, and never past the subtotal, so 100% is the whole of it. | 2026-10-16 |
| D291 | **A percentage is a whole number, 1 to 100** (the user): 100% makes a bill that comes to nothing, still issued and numbered (`DISCOUNT_PERCENT`). | 2026-10-16 |
| D292 | **A bill shows its discount as the amount only** (the user): "Discount −₹50"; the percentage only works the amount out, and nothing more is stored. | 2026-10-16 |
| D293 | **A discount larger than the bill is refused at its field** (the user): "A discount can't be more than the bill", under the field, and nothing is issued until it is fixed — never capped. The database refuses it too. | 2026-10-16 |
| D294 | **Payments before the new bill screen** (the user): R8.4 (payments and balances in the database) is built before R8.3, so the new bill screen comes whole — Collect now, Issue and collect at arrival, the balance after — with no second pass. | 2026-10-16 |
| D295 | **Each patient's balance is kept up to date by the money functions** (the user): `patient_balances` is a row per patient — billed, paid, refunded and the balance — changed in the same transaction as each bill, void, payment and refund, so the Owing tab and Outstanding read it from an index; a test proves it always equals the sums. | 2026-10-16 |
| D296 | **No `patient_stats`** (the user): nothing would read it — the profile's summary serves the next appointment and open treatments (D166, D260), and the list reads the balances. | 2026-10-16 |
| D297 | **A refund is no more than the advance held** (the user): only money paid beyond what is owed (after a void, or an overpayment) is handed back, so a refund never makes a patient owe; a discount after the fact is a void and a new bill. | 2026-10-16 |
| D298 | **Payments settle bills oldest first, as planned** (the user): one rule for every payment, Collect now included — a payment is never tied to a bill (D4); a bill shows the patient's overall balance. | 2026-10-16 |
| D299 | **A payment is paid any time up to now** (the user): "when paid" defaults to now and may be set earlier, never later; it counts on that day in the clinic's timezone. | 2026-10-16 |
| D300 | **A patient who owes, or holds an advance, may be archived** (the user): the balance stays and counts; to take a payment or a refund, they are restored first (D103). | 2026-10-16 |
| D301 | **A payment with a refund standing on it is voided after the refund** (the user): a void that would leave more refunded than paid is refused (`PAYMENT_HAS_REFUNDS`), the card saying to void the refund first. | 2026-10-16 |
| D302 | **Once a bill is issued, the screen goes back where it came from, with the card** (the user): the visit, the profile, the queue or Billing — "Bill 2026-27/0042 issued · ₹500 collected". A visit to bill offered on a profile goes back to the profile, never to a visit reception may not open. | 2026-10-18 |
| D303 | **Lines are added from a sheet** (the user): a search over the price list, grouped by category; **Add typed line** there for `payments.discount`. | 2026-10-18 |
| D304 | **Collect now starts on, filled with the total, in Cash** (the user): the amount follows the total until one is typed; it is off when the bill comes to nothing. | 2026-10-18 |
| D305 | **The fee at arrival is a small Collect fee sheet after the token** (the user): the token first, then the doctor's fee (a field for `payments.discount`, its read-out otherwise), the method and a reference; **Issue and collect**, or **Skip** for checkout. A bill that fails never takes the token back. | 2026-10-18 |
| D306 | **The queue says Fee paid** (the user): a tag on the patient's row once a bill for the arrival is issued, and **Collect fee** in the appointment's detail while they are arrived or in, until it is paid. | 2026-10-18 |
| D307 | **Bill now is at the foot of the visit** (the user), for `payments.create`. | 2026-10-18 |
| D308 | **A treatment with no price-list entry of its name is a reminder line** (the user): "Crown: pick its price-list entry", with **Pick entry**; the bill is not issued until an entry is picked for it or the line is removed. | 2026-10-18 |
| D309 | **A line's price is a field for `payments.discount`, its read-out otherwise** (the user). | 2026-10-18 |
| D310 | **On a desktop the lines are on the left, the totals, Collect now and Issue on the right, kept in view** (the user); on a phone they stack, and **Issue bill** sits on a bar fixed to the foot. | 2026-10-18 |
| D311 | **New bill is in the profile's header, beside New visit** (the user); Record payment goes to the balance section with R8.6. | 2026-10-18 |
| D312 | **Issue bill does not ask first** (the user): the preview is the check. | 2026-10-18 |
| D313 | **A new bill for no one starts with a patient search** (the user); a patient with a visit to bill is offered **Bill that visit**. A visit's or an arrival's bill leaves out what is billed already: its consultation, and its treatments on an issued bill. | 2026-10-18 |
| D314 | **A bill's page — `/bills/[id]` — offers Print, Download, Void, Record payment, Re-issue and the profile** (the user): **Void** for `payments.edit` (asks first, a reason); **Record payment** while the bill is Unpaid or Part paid, filled with what is still due on it; **Re-issue** on a void bill, opening a new bill filled with its lines; a quiet link to the patient's profile. | 2026-10-18 |
| D315 | **A void bill's PDF prints with VOID across it** (the user): still printed and downloaded for the records, with a large grey VOID and its reason, so it never passes for a live bill. | 2026-10-18 |
| D316 | **The bill PDF ends with a signature line** (the user): "Authorised signatory" under the clinic's name, as the prescription's signed foot, above the small footer. | 2026-10-18 |
| D317 | **The issued card offers Print and View bill** (the user): once the PDF exists, "Bill 2026-27/0042 issued" stays up with **Print** (the PDF) and **View bill** (its page) instead of closing itself. | 2026-10-18 |
| D318 | **The queue's To bill section follows With doctor** (the user): Waiting, With doctor, To bill, Still to come, Done; with `payments.view`; each row the patient, the doctor, the token and what was done, with **Bill**. | 2026-10-18 |
| D319 | **No charge is in the To-bill row's sheet and on the visit** (the user): the row keeps one **Bill**; tapped, it opens a small sheet with **Bill** and **No charge** (Review, Courtesy, Other + note); a done visit has **No charge** beside **Bill now**. | 2026-10-18 |
| D320 | **Billing's Bills and Payments pick dates by chips and a range** (the user): Today, 7 days, This month, or From – To; Bills also by state — All, Paid, Part paid, Unpaid, Void. | 2026-10-18 |
| D321 | **Outstanding's WhatsApp opens with a dues reminder** (the user): "Hello Rohan, a balance of ₹1,200 is due at Smile Dental. Reply or call 0484 234 5678." — from `WHATSAPP_TEXT`, the clinic's phone when it has one; a person presses send. | 2026-10-18 |
| D322 | **Refund is on the profile's balance, only while an advance is held** (the user): a sheet filled with the advance, the method and a reference, for `payments.edit`. | 2026-10-18 |
| D323 | **The ＋'s Record payment starts on a patient search** (the user): it opens Billing with the Record payment sheet, which searches first; the patient picked shows their balance and fills the amount. | 2026-10-18 |
| D324 | **Record payment's amount starts as what is owed** (the user): filled with the balance due, changeable — more becomes an advance; empty when nothing is due. | 2026-10-18 |
| D325 | **Bills and payments are rows of their own in the history** (the user): among the visits and appointments, newest first, with `payments.view` — "Bill 2026-27/0042 · ₹1,500 · Part paid" opening the bill, "Paid ₹500 · UPI". | 2026-10-18 |
| D326 | **A bill not from a visit or an arrival may name no doctor** (the user): its doctor picker starts on the patient's assigned doctor and may be cleared — a bill for medicines or a test has none; a doctor picked lets a Consultation line be at their fee (D289). | 2026-10-18 |
| D327 | **Send bill on WhatsApp is on the bill's page and the issued card** (the user): as the prescription's — the share sheet with the PDF on a phone, WhatsApp Web and a download on a desktop (D245, D246). | 2026-10-18 |
| D328 | **An expense is dated today or earlier** (the user): today unless changed; a late entry goes on its own day; never a day to come, as payments (D299). | 2026-10-18 |
| D329 | **An expense's description is optional** (the user): the category says enough for Rent; a line may say more ("AC repair, room 2"). | 2026-10-18 |
| D330 | **Expenses: the month, its totals, then the list** (the user): a month with ‹ ›, its total, each category's total — tapped, it filters the list — then the expenses; on a desktop the totals on the left, the list on the right. | 2026-10-18 |
| D331 | **An archived expense leaves the totals** (the user): **Show archived** lists it, with **Restore** for `expenses.edit`. | 2026-10-18 |
| D332 | **Expenses are grouped by day, newest first** (the user): "Today", "14 Oct" headings; each row its category, description, method and amount. | 2026-10-18 |
| D333 | **Any expense, of any month, may be corrected** (the user): with `expenses.edit`, edited or archived, every change audited. | 2026-10-18 |
| D334 | **Record payment's "Paid on" is a day, today by default** (the user): a day field, never after today; today's payment is stamped when recorded, an earlier day's at noon of that day in the clinic's timezone, so it counts on that day. | 2026-10-19 |
| D335 | **Billing's Bills and Payments open on Today** (the user): the chips then pick 7 days, This month or From – To (D320); each tab keeps its days while another is looked at. | 2026-10-19 |
| D336 | **A payment is voided from its sheet** (the user): a payment's row — in Billing's Payments, and in the history — opens its sheet: how much, how, when, its reference and note, who took it; **Void payment** for `payments.edit` asks a reason, then the coral card. | 2026-10-19 |
| D337 | **The Queue item counts To bill, and the queue's land carries the pin** (the user): for `payments.view`, a small coral count of the visits waiting in To bill on the Queue item — bottom bar, rail and sidebar — read beside the screen and again every 15 s, as the queue; the queue's land pins "3 to bill" on its coastline. | 2026-10-19 |
| D338 | **On a desktop the queue is four columns, the last stacked** (the user): Waiting · With doctor · To bill · Still to come, with Done under Still to come — D318's order, each column wide enough for its buttons. | 2026-10-19 |
| D339 | **A patient done waits in To bill, then reaches Done** (the user): beside To bill, the queue's Done lists those billed or marked No charge, so no one is listed twice; whoever does not read bills sees no To bill, and Done lists everyone finished. | 2026-10-24 |
| D340 | **The queue's pin jumps to its To bill** (the user): tapping "3 to bill" scrolls to the queue's own To bill section — below Waiting on a phone — counting the doctor whose queue is shown, or every doctor's. | 2026-10-24 |
| D341 | **Send bill on WhatsApp says its number, day, total and what is due** (the user): "Your bill 2026-27/0042 from Smile Care, 15 Oct: ₹1,500." — and "₹1,000 is due." only while something is still due on it — with the PDF; a void bill is not offered for sending. | 2026-10-24 |
| D342 | **A patient's bill names its doctor by chips** (the user): under "Doctor", No doctor and each active doctor, starting on the patient's assigned doctor (else No doctor); picking one prices a Consultation line at their fee. A visit's or an arrival's bill keeps the visit's doctor, named and not changed. | 2026-10-24 |

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

### 4.1 V1 (Phases 0 – 14)

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
password (current + new), sign out (asks first), and for a doctor their
**prescription templates** (`/settings/account/templates`, D242). Changing the
sign-in email is **later**. Name, mobile and the password each open a sheet of their own; the
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
| `max_import_rows` | 10 000 | 100 – 50 000 | How many rows one patient import may hold (§10.5, D128). |
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
  checklist (R14.8) requires them set before v1.0.0.

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
| `appointments.view` | See the calendar, today's queue and the follow-ups to call (D267). |
| `appointments.create` | Book appointments; add walk-ins. |
| `appointments.edit` | Reschedule; confirm; mark arrived and no-show; note a follow-up call (D267). |
| `appointments.cancel` | Cancel appointments. |
| `visits.view` | See clinical records: visits, vitals, alerts, prescriptions, treatments, follow-ups. |
| `visits.create` | Start visits; record vitals. |
| `visits.edit` | Write and correct clinical notes, alerts and treatments; note a follow-up call. |
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
   a registration number — until it does, none is written in their name
   (D213). The doctor writes it (no permission needed for their own visits),
   or a staff member with `prescriptions.write` types it for them (D45), while
   the visit is open or after it is done (D215); `entered_by` records who
   typed it, and the printout carries the doctor's name for the doctor to
   sign. No one else writes one.
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
  days. Adding a closure over existing appointments lists them in its sheet as
  the days are picked (it does not cancel them; R5.1, D87, D137). A closure starts today
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
  restored. Until then they are read-only (D103). **Archive** is at the foot
  of the patient's edit sheet and asks first (D122); the profile stays and
  says when and by whom, with **Restore** (D123, D124), which asks nothing
  (D125). Both need `patients.edit` and are audited (ARCHIVE, RESTORE). A
  patient with an appointment still to come is not archived until it is
  cancelled or moved; the card names its day (D140). Nor is one with an open
  treatment, until it is completed or cancelled; the card names it to whoever
  reads treatments (D255). Nor is one with a visit waiting in To bill, until
  it is billed or marked No charge; the card names its day (D288).

### 10.2 Patients list — `/patients`

Search by name (fuzzy, trigram), mobile (on its digits however typed), or
patient number — sent in the request's body, never its address (D98); the
best match first, and newest first with nothing typed (D104). Each row: name,
age and gender, mobile, patient number, last
visit ("Last visit: 28 Sep", on a line of its own, D229 — for everyone who
sees the patient, D228), and a balance chip when they owe; the mobile
joins the line from 640 px, and Call is on the profile (D121). Rows on every
width (D111). Paged (**Show more**, `PAGE_SIZE`). Tabs: All · Owing
(`payments.view`) · Archived (`patients.edit`). A doctor sees only their own
patients, without a filter to choose. A search that finds no one offers
**Add patient** with what was typed (D112). The last visit came with Phase
6 (R6.5); the Owing tab and the balance chip come with Phase 8 (D101).

### 10.3 Patient profile — `/patients/[id]`

One screen that tells the patient's current state without opening others:

1. **Header:** name, age · gender, mobile (Call, WhatsApp), patient number,
   assigned doctor; whether they are archived, with **Restore** (D123);
   **alerts** (allergies in the danger tone first, then conditions and
   medications).
2. **Next appointment** (date, time, doctor) or **Book**, the booking sheet
   opening on the profile for them (D166).
3. **Open treatments:** name, status, doctor, next due ("Overdue by 4 days")
   and the estimate; **Show closed** for the completed and cancelled; each
   opens its sheet (D260, D261), and **Add treatment** starts one (D258).
4. **Balance** (`payments.view`): due or advance; **Record payment** (R8.6).
   **New bill** sits in the header, beside New visit, for `payments.create`
   (R8.3, D311).
5. **History:** a timeline of visits (date, doctor, diagnosis, treatments
   worked on, prescription), appointments (cancelled and no-show included),
   bills and payments — each part shown only with its permission. Phase 5
   lists the appointments, newest first, a page at a time (D167); Phase 6
   adds the visits, each standing for the appointment it was opened for
   (D225), saying what it found and its medicines (D226), and opening its
   screen (D227), whose back arrow returns here (D230).

Desktop lays these out in two columns (state on the left, history on the
right, D231); a phone stacks them in that order. Phase 4 builds the header, the
alerts and the details; each later phase adds its part as its records arrive
(D101).

As built (R8.6): **Balance**, for `payments.view`, after the treatments —
"₹1,200 due" in coral, "₹300 advance", or "Nothing due" — with **Record
payment** (`payments.create`), filled with what is owed (D324), and
**Refund** (`payments.edit`) while an advance is held, filled with it
(D322); neither for an archived patient (D300) or in a view-only clinic.
Read with the profile's summary (`patient_balances`). The history takes the
bills and payments, for `payments.view` (D325), among the visits and
appointments by when each happened: a bill "Bill 2026-27/0042", its day and
total and where it stands, opening its page, which leads back here; a
payment "Paid ₹500 · UPI" (or "Refunded …"), its day and who took it,
opening its sheet with **Void payment** (D336). Its cursor counts the four
parts ("12.8.3.5"); a patient's bills are read beside their settlement, at
once.

### 10.4 Alerts — allergies, conditions, current medications

`patient_alerts`: kind (Allergy, Condition, Medication), a label ("Penicillin"),
an optional note, active or not. Read with `visits.view`, changed with
`visits.edit`. Shown on the profile header, at the top of every visit, and
above the prescription editor. In the header, **Alerts** opens them, with a
pencil when they may be changed and an eye when they may only be read (D126).

### 10.5 Importing patients — `/settings/import` (D51)

For a clinic moving from Excel or other software. Owner only. Four steps, one
at a time, with a step indicator and Back (D131); it starts from Settings, and
from an empty patients list for the owner (D132).

1. **File** — CSV or Excel (`.xlsx`, its first sheet; the old `.xls` is
   refused with how to save it again) (D127). It is **parsed in the
   browser**; the file itself never leaves the device and is never stored.
   Its first filled row is the header; each row keeps its number in the
   file. One with more rows than `max_import_rows` (a platform setting,
   D128) is refused.
2. **Columns** — each patient field (name, mobile, date of birth, age,
   gender, alternate phone, email, address, emergency contact and phone,
   notes) takes one of the file's columns, guessed from the headers and
   shown with the first row's value. A name, a mobile, a gender and a date of
   birth or an age are needed.
3. **Check** — every row checked with the same schema as the patient form
   (§10.1), dates read day first (D130): ready, possible duplicates, and
   problems, counted. Problems are listed with the reason, in words for
   fixing a file, and left out. Possible duplicates — the same mobile and a
   similar name as a patient already in the clinic (asked about in batches,
   in the body, `POST /api/patients/import/matches`) or as an earlier row —
   are listed with what each matched and skipped unless ticked (D129).
4. **Import** — the rows going, in batches of `IMPORT_BATCH_SIZE`
   (`POST /api/patients/import`), each row under its own key so a batch
   sent again adds no one twice (`0016`), validated again on the server,
   numbered from the clinic's counter, without an assigned doctor, and
   audited once per batch by count and numbers. Progress is shown; leaving
   the page asks first; a stop carries on from the batch that stopped. A
   summary counts what was imported, skipped and not imported; the rows not
   imported can be downloaded as a CSV — the file's columns and a Problem
   column — to fix and try again; **Open patients** leads on (D133).

Patients only: visits, bills and balances stay in the old system.

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
  time; the sheet keeps what was typed. Writes into one doctor's time — a
  booking, a move, an arrival back from a no-show — take a lock on the doctor
  first (`hold_doctor`), so two at once wait their turn rather than deadlock
  at the constraint; the constraint still decides (R5.6).
- **Not on a closed day:** a clinic holiday, or the doctor's leave
  (`APPOINTMENT_ON_CLOSED_DAY`, naming the closure's reason) — a walk-in
  neither (D139).
- **Not in the past** when booked: no earlier than the 5-minute step it is
  made in (`APPOINTMENT_IN_PAST`; a walk-in is "now").
- **The doctor must be active** and in the same clinic; the type one of the
  clinic's active types.
- **Not for an archived patient** (D103): nothing is booked, moved or arrived
  for them until they are restored.
- **Moving** (Reschedule): only a booking not yet arrived, under every rule
  above (`APPOINTMENT_NOT_MOVABLE`); a confirmed one moved to another time or
  doctor is scheduled again (D142). Notes change at any time.

**The booking sheet** (R5.2, D144 – D151) opens from the calendar's **Book
appointment** and the ＋'s Appointment (D67). The patient is searched for in
the sheet, or added with the booking (name, mobile, date of birth or age,
gender, with "Already here?"); then the doctor, the date, the time as its
hour and minutes with the doctor's booked times that day under it, the type,
which sets the length (chips, or Other), and notes. It starts on today, the
doctor booking or the clinic's only doctor, and the clinic's first type. A
taken time or a closed day is named on the card and the sheet keeps
everything; booked, it closes with a card naming who, when and with whom.

### 11.2 Statuses

`SCHEDULED`, `CONFIRMED`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`,
`NO_SHOW`. Moves follow one table (`APPOINTMENT_STATUS_TRANSITIONS`, mirrored by
`appointment_status_next()` in SQL, kept equal by a test):

| From | May go to |
|---|---|
| SCHEDULED | CONFIRMED, ARRIVED, CANCELLED, NO_SHOW |
| CONFIRMED | ARRIVED, SCHEDULED, CANCELLED, NO_SHOW |
| ARRIVED | IN_PROGRESS, SCHEDULED, CANCELLED, NO_SHOW (left before being seen, D138) |
| IN_PROGRESS | COMPLETED, ARRIVED |
| NO_SHOW | ARRIVED (came late) |
| COMPLETED | — |
| CANCELLED | — |

`IN_PROGRESS` and `COMPLETED` are reached only through the queue — **Send in**,
**Done**, **Next patient** (§11.4) — which open and close the visit with them
(§12.1). Arrived is reached only through **Arrived** or a walk-in, which
give the token (§11.3); a walk-in never goes back to Scheduled. Cancelling
asks first, needs `appointments.cancel` and takes a reason.

**The appointment's detail** (R5.4, D160 – D165) is a sheet over the
calendar or the profile: who, when, with whom, what kind and where it
stands, its notes, who booked it, and who cancelled it and why. Under it,
what its status allows (`appointments.edit`, cancel with
`appointments.cancel`): **Confirm** a booking still scheduled; **Reschedule**
(the booking sheet, the patient staying) a booking not yet arrived, or
**Edit notes** for one that cannot move; **No-show** once its time has
passed, asking first; **Cancel appointment** with a quick reason or one
typed, asking first on the coral card. Done, it closes with a card. An
archived patient's appointment offers nothing (D103); **Arrived** joins with
the queue (R5.5, D164).

### 11.3 Arrivals, walk-ins and tokens

- **Add walk-in** (`appointments.create`): patient (search, or quick-add with
  name, mobile, age, gender), doctor, type. Creates an appointment with
  `source = 'WALK_IN'`, status `ARRIVED`, at now. A walk-in does not hold a
  slot, so it never clashes.
- **Arrived** (`appointments.edit`): a booked patient is at the desk.
- **Tokens:** every patient who arrives — walk-in, or booked and marked
  **Arrived** — takes the next token for that doctor that day (`#7`), from a
  per-doctor-per-day counter taken under a row lock. Tokens restart each day
  in the clinic's timezone. A patient keeps theirs for the day: going back and
  arriving again gives the same number; moving the appointment to another day
  or doctor gives it back (D141). **Arrived** only on the appointment's own
  day (D143). Marked arrived twice — a double tap, two desks at once — the
  second changes nothing and gives the same token (R5.6).
- **Fee at arrival (D44, D283):** in a clinic that collects the consultation
  fee at arrival, arriving (or adding a walk-in) gives the token, then
  continues to **Collect fee**: the doctor's consultation fee (D26)
  pre-filled, the method, **Issue and collect** — one transaction that issues
  the consultation bill (linked to the appointment, while the patient is
  arrived or in) and records its payment (the payment joins with 0029, D282).
  **Skip** leaves it for checkout. The step is offered only with
  `payments.create`; a bill that fails never takes back the token.
  **Collect fee** is a small sheet (D305): the token first, then the fee —
  a field for `payments.discount`, its read-out otherwise — the method and a
  reference. The queue tags the patient **Fee paid** once a bill for the
  arrival is issued, and their detail offers **Collect fee** while they are
  arrived or in, until it is paid (D306).

### 11.4 Today's queue — `/queue`

**Run by the front desk (D43).** Reception sees a tab per doctor (or all
doctors); a doctor sees their own.

| Column | Holds | Actions |
|---|---|---|
| **Waiting** | Arrived, by token: name, token, booked time or "Walk-in", fee paid or not, wait so far; "Stepped out" for one away (D198); the Urgent tag (D201). | **Send in** · Stepped out / Back · Urgent / Not urgent · Vitals · No-show · Cancel |
| **With doctor** | The patients in the room — more than one for a doctor working two chairs (D192); the Urgent tag, kept (D201). | **Done** · **Next patient** · Back to waiting · Not urgent |
| **Still to come** | Booked for later today. | Arrived · No-show |
| **To bill** (`payments.view`) | Finished visits waiting for checkout, from any day (§15.6). | **Bill** · No charge |
| **Done** | Finished today and settled (billed or no charge). | — |

- **Send in** (`appointments.edit`): the appointment goes `IN_PROGRESS` and its
  visit opens by itself (§12.1). Any waiting patient may be sent in, not only
  the lowest token.
- **Done** (`appointments.edit`): the appointment goes `COMPLETED` and its visit
  closes — whatever was or was not recorded — and the patient moves to **To
  bill**, or straight to **Done** when there is nothing to bill (§15.6).
- **Next patient** — beside each patient with the doctor, on the queue and in
  the visit screen, for anyone with `appointments.edit` (D193): marks that
  patient Done — only that one, with two in (D196) — and sends in the
  doctor's lowest waiting token not stepped out, in one transaction
  (`next_patient`). With the room free it sends in the lowest token. From the
  visit screen the next patient's visit opens; from the queue the queue stays
  (D194). A doctor can run a session with this button alone — or never touch
  the app.
- Sending in a patient while another is still with that doctor asks first
  ("Rahul Mehta is still with Maya Rao"): **Mark done and send in**, or **Keep
  both in** for a second chair (D192).
- **Back to waiting** (the detail): the patient waits again with their token;
  the visit Send in opened is removed while nothing is recorded on it, and
  kept to continue once something is (D197).
- **Stepped out** (the detail, D198): a waiting patient away for a moment
  keeps their token and place; Next patient skips them until **Back**. Send in
  still works on them.
- **Urgent** (the detail, `appointments.edit`, D201): a waiting patient is
  tagged Urgent, in coral with a siren, on their queue row, in the lake,
  on their appointment and at the top of their visit, so the doctor sees it
  too. It is a tag only: Next patient still goes by token, and the desk
  sends them in with **Send in**. It stays through the visit and on the
  record once they are done; **Not urgent** takes it off while they wait or
  are in. Leaving the queue another way (back to booked, a no-show,
  cancelled) drops it.
- **Vitals** (the detail, `visits.create`, D203): an assistant takes a
  waiting patient's vitals before they go in; the first reading opens their
  visit, which Send in continues.
- A patient still "With doctor" when the day ends heads the next day's queue,
  to be marked done.
- Phone: stacked, as the shaped screen (§32.1, D168) — the patients with a
  doctor in the lake, then Waiting, Still to come, and Done folded. Tablet and
  desktop: the sections side by side (D169).
- It opens on every doctor's for the desk and a doctor's own for a doctor;
  anyone may switch (D170). A row carries its main action — **Arrived**,
  later **Send in** — and the rest are in the appointment's detail (D172). A
  patient past their time is marked late (D174).

**R5.5** builds the queue's Waiting, With doctor, Still to come and Done,
**Add walk-in** (D171, D175) and **Arrived**, each giving the token on its
card (D173). **Send in**, **Done**, **Back to waiting**, **Stepped out** and
**Next patient** come with the visit (R6.1, D192 – D198), **Urgent** after it
(R6.9, D201); To bill and the fee at arrival with billing (R8.1, R8.6).

As built (R8.6): for `payments.view`, **To bill** follows With doctor —
Waiting, With doctor, To bill, Still to come, Done (D318) — on a phone
below Waiting, the lake above; on a desktop four columns, Still to come with
Done under it (D338). It lists the shown doctor's visits waiting to be
billed, or every doctor's, from any day, oldest first, a page at a time,
read again with the queue; each row's **Bill** opens its sheet, whose new
bill leads back to the queue. A patient done reaches Done once billed or
marked No charge (D339; `billing_status`, 0031's computed column, read with
each row). The land pins "3 to bill" on its coastline, jumping to To bill
(D340), and the Queue item counts the same (D337).

Refreshes every `QUEUE_REFRESH_MS` (15 s) and on focus; realtime is later
(D34).

### 11.5 Calendar — `/appointments`

- **Phone:** one day as a list by time, a doctor filter, a date strip (a week
  back to four weeks ahead, any other day through its calendar, D157); **＋**
  books.
- **Tablet/desktop:** day view with a column per doctor; week view for one
  doctor, Monday to Sunday (D158); 8 AM – 8 PM, stretching to fit (D152), in
  quarter hours; closures shaded; tap an empty quarter to book there with its
  doctor, day and time (D156).
- It opens on today: every doctor's for the front desk, a doctor their own
  (D155). Cancelled appointments and no-shows wait, counted, at the foot
  (D153); walk-ins show at the time they arrived (D154). Holidays and leave
  are said above the day.
- Each appointment: time, patient, type, status pill. Opening one shows its
  detail with the actions its status allows; **Reschedule** reopens the
  booking sheet (same rules).

## 12. Visits and clinical records

### 12.1 The visit

A visit is one consultation: patient, doctor, optional appointment (one visit
per appointment), visit date, complaint, diagnosis, notes, follow-up date,
status `OPEN` → `COMPLETED`, and a **billing state** (§15.6).

- **Opens by itself** when the patient is sent in (§11.4) — empty, ready for
  whatever the doctor or an assistant records — or earlier, with the first
  vitals taken while they wait, not yet started until Send in (D203). A
  doctor may also start one from a patient's profile (**New visit**) when
  there is no appointment; its **Done** closes it (D204).
- **Closes by itself** with **Done** or **Next patient**. A visit may close
  with nothing recorded: the app never makes a doctor fill anything in to
  finish a consultation (D43). It closes as **To bill** (§15.6).
- **Back to waiting** removes a visit with nothing recorded on it, and keeps
  one with anything recorded, to continue when the patient is sent in again;
  that appointment then ends only with Done (D197).
- **Who records:** the doctor, or an assistant typing for them — vitals and
  notes with `visits.create`/`visits.edit`, the prescription with
  `prescriptions.write` (D45) — during the visit or after it closes.
- **Corrections:** a completed visit can still be corrected by a member with
  `visits.edit` — vitals included (D208); `updated_by` and `updated_at`
  record who and when (the audit trail adds what changed, for
  `audit_keep_days`).

### 12.2 The visit workspace — `/visits/[id]`

Built for the doctor — and for an assistant typing for them — on a phone or at
a desk. **Every section is optional:**

1. Patient header with **alerts** (always visible, and **Alerts** to change
   them, D207), the token, and **Next patient** (the doctor).
2. **Vitals:** BP (systolic/diastolic), pulse, temperature, SpO₂, respiratory
   rate, weight, height; BMI computed for display. Each field checked against
   `VITAL_LIMITS`. Temperature in °F (D31). Often taken by an assistant before
   the patient goes in.
3. **Complaint, diagnosis, notes.**
4. **Treatments:** start a new one, or record progress on an open one (§14).
5. **Prescription** (§13).
6. **Follow-up:** a date — chips for 3 days, 1 week, 2 weeks and 1 month
   after the visit, or any later day (D205) — and **Book next appointment**
   pre-filled.
7. **Bill now** (`payments.create`): for a clinic that bills in the room;
   otherwise the front desk bills at checkout (§15.6).

Saving is per section, so a long visit is never lost to one failed request
(D202): each section is its fields on the screen with its own **Save**,
shown once something is typed, and a save made from an older copy of the
section is refused, showing theirs beside what is typed (D206). Whoever may
only read sees read-outs. From a tablet, two columns (D209). Its back arrow
leads to the queue — or, opened from the patient's profile, back to it
(D230).

**R6.2** builds the vitals, complaint/diagnosis/notes and follow-up sections,
**Alerts** in the header, **Vitals** for a patient still waiting (D203), and
**New visit** with its **Done** (D204). **R6.3** adds the prescription (§13),
under the notes — beside the vitals from a tablet (D209). **R7.2** adds the
treatments between the notes and the prescription (D256 – D259, D263).
**R8.3** adds **Bill now** at the visit's foot, for `payments.create` (D307).

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
- **On the visit screen (D210):** each medicine a block of its fields in the
  Prescription card — Add medicine, and Move up, Move down and Remove on
  each — and one **Save prescription** for the whole, shown once something
  is typed, refused from an older copy (D206). The patient's allergies stand
  above it. The frequency and the timing are chips, with **Other** to type a
  frequency (D214); the days are typed (D217). A suggestion is one medicine
  and strength, and taking it fills the whole line as this doctor last wrote
  it, or the clinic did (D211). **Print the diagnosis** is off until ticked
  (D216). Whoever typed it for the doctor is named under it (D45). Whoever
  may only read sees it read out.
- **Who, and when:** the visit's doctor, or `prescriptions.write` typing for
  them, while the visit is open or after it is done (D215) — and only once
  the doctor has a registration number; until then the card says so and
  where it is added (D213).
- **Repeat last prescription (D54):** one tap copies this patient's most
  recent prescription — from any doctor the current doctor may see — into
  this visit, to edit before saving. The button names its day and doctor
  ("Repeat 12 Oct · Dr. Maya Rao") and is hidden when there is none; it is
  the latest with a medicine on it, from the visits before this one, read
  with the visit (D236).
- **Templates (D54):** a doctor saves the current items and advice as a named
  template ("Post-extraction", "Viral fever") and applies one in a tap; a
  template adds its items to what is already there. Templates belong to the
  doctor (`prescription_templates`), are edited or archived in My account,
  and are offered to whoever types for that doctor. Only the doctor saves,
  edits or archives one (D240); **Templates** opens a sheet of them, each
  with its medicines (D241); a name in use asks to replace it (D243).
- **Adding to what is typed (D237, D238):** Repeat and a template add their
  medicines after those typed, up to 30, and their advice fills an empty box
  or joins it on a new line. **Repeat** and **Templates** stand above the
  medicines, **Save as template** beside Add medicine (D239).
- **Allergy check:** if a medicine's name contains an active allergy's label,
  the line shows a warning before saving (a text match, not a clinical
  database), and **Save** asks once, naming each match (D212).
- **The PDF** (§33), A4 or A5 by the clinic's paper size (D28): the clinic's
  letterhead (logo, name, address, phone), the doctor's name, qualifications
  and registration number, the patient's name,
  age/gender and number, the date, the vitals recorded, the diagnosis (if the
  doctor chooses to print it), the items, the advice and the follow-up date,
  and a signature line. **Generated on demand, never stored.** Laid out as
  D218 – D220 say; **Print** opens it in the viewer and **Download** saves it
  (D221 – D223), on the Prescription card once saved. **WhatsApp** beside them
  sends it (D244 – D247): the share sheet with the PDF and the message on a
  phone, WhatsApp Web and the PDF downloaded on a desktop (§22.1; the share
  helper, D183); nothing is recorded.

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

- **Starting one:** planned, or in progress at once. Started in a visit, it
  is that visit's doctor's, and begun at once that visit is its first
  session; from the profile a doctor is picked (D252). It is started on the
  day it goes in progress; completing it stamps the day.
- **Sessions:** one per treatment and visit, from any of the patient's
  visits (D249). The first on a planned or on-hold treatment puts it in
  progress, started on the visit's day (D248); a completed or cancelled one
  takes none (`TREATMENT_CLOSED`). One recorded by mistake is removed while
  its visit is open; after that only its note is corrected (D254).
- **Changing one:** its name, description and estimated cost, from the copy
  the screen read (D251). While it is open, its next due day (today or
  later) and its doctor too (D252); once completed or cancelled it keeps its
  doctor and has no next due day. A cancellation may carry a reason (D250).
- **Who:** read with `visits.view`, within the doctor scope, the estimated
  cost included (D253); written with `visits.edit`, through 0024's
  functions only. A patient with an open treatment is not archived (D255).
- **On a visit** (D256 – D259, D263): the Treatments card, between the notes
  and the prescription, lists the patient's open treatments and any started
  or worked on in the visit; each opens its sheet, where this visit's note
  is saved and **This completes it** completes it with the same save.
  **Add treatment** begins one today — a price-list procedure filling its
  name and estimate — or plans it. Its next sitting has chips of its own.
- **On the profile** (D260, D261): the open treatments, then **Show
  closed**; the same sheet tells each one's story, sessions visit by visit.
  A visit's row in the history names the treatments it worked on (D262).

### 14.2 Follow-ups

A follow-up is either an **open treatment's next due date** — on hold too
(D269) — or a **visit's follow-up date**, for a patient not archived. A
follow-up is **done** when the patient is coming back (D268): an appointment
for a later day than the one it was set on, with any doctor, still to come or
kept (not one cancelled, missed, or left unmarked on a day gone by — a
cancelling reopens it); or a visit opened after it was set; or, for a
treatment, its closing or losing its next due day.

### 14.3 The follow-ups screen — `/follow-ups`

Tabs (with counts), computed by the database in the clinic's timezone
(`follow_up_items`, `follow_up_counts`, 0026), for whoever sees appointments or
visits — the front desk makes the calls (D267) — a doctor only their own
patients':

| Tab | Holds |
|---|---|
| **Today** | Due today. |
| **Overdue** | Due before today, up to `follow_up_lapsed_days` (§6) ago. |
| **Upcoming** | Due in the next 30 days (`FOLLOW_UP_WINDOW_DAYS`, D270). |
| **Lapsed** | Overdue by more than `follow_up_lapsed_days` — "patients who haven't returned". |
| **Completed** | Treatments completed in the last 30 days. |

Each row: patient, treatment or "Follow-up", doctor, due label ("Due
tomorrow", "Overdue by 4 days"), last contact, and a round **Call** (`tel:`)
at its end (D272). The row opens its sheet: what it is for, its doctor, its
day, and the last contact — how it went, when, by whom, its note (D275) —
then **Call**; **Remind on WhatsApp** (§22.1), noted as *Reminder sent* as
it opens (D273); **Book**, the booking filled with the patient, the doctor
and the day due — today for one overdue — after which the follow-up is done
and leaves its list (D276); **Open profile**; and **Mark contacted** —
outcome (Reached, No answer, Booked, Declined, Reminder sent), a note, and
an optional "remind me on" day, by chips (Tomorrow, 3 days, 1 week, 2 weeks)
or any later day (D274), that hides the row, and leaves it out of the
counts, until then (`follow_up_contacts`, D271), for `appointments.edit` or
`visits.edit` (D267). A treatment on **Completed** offers Call and the
profile only (D277). No doctor filter; a desktop shows the same one list
and sheet (D278). The screen waits on 2 round trips (the session, then the
tab, the counts, the clinic, the doctors and the appointment types at
once); noting a contact on 3.

## 15. Billing and payments

### 15.1 Money rules

Integer paise everywhere; `src/lib/money.ts` is the only place that converts;
screens show money through `formatPaise`; a bill's totals come from one formula
(`src/features/billing/totals.ts`) used by the screen's preview and by the
server, and the database recomputes and checks them (AGENTS.md §16): the
lines' quantity times price added up, less the discount — an amount as
typed, or a whole percentage of the subtotal rounded to the nearest rupee,
half up, never past the subtotal (D290, D291). A discount past the subtotal
is refused, never capped (D293).

### 15.2 Bills

- **New bill — `/billing/new`** (`payments.create`): from the **To bill** list
  or a visit (pre-filled: the consultation at the visit doctor's fee — D26 —
  unless it was already billed at arrival, and the treatments worked on, each
  as the price-list procedure of its name, D285), from **Collect fee** at
  arrival (§11.3), or from a patient. Lines come from the price list — a
  line may also name the patient's treatment it is for (D285) — or, with
  `payments.discount`, are typed as a custom line (description + price,
  D284); quantity; notes. **With `payments.discount`** (D29): a changed unit
  price, and a discount as an amount or a whole percentage, 1 – 100 (stored
  as paise, and shown on the bill as the amount only — D290 – D292);
  without it, prices are the price list's — a Consultation line's may be the
  bill's doctor's fee instead (D289) — and there is no discount. A live
  preview shows subtotal, discount, total and the patient's balance after.
  - **Where it starts** (D307, D311, D313): **Bill now** at the foot of a
    visit; **New bill** in a profile's header, beside New visit; for no one
    yet, a patient search first, and a patient with a visit to bill is
    offered **Bill that visit**. A visit's or an arrival's bill leaves out
    what is billed already — its consultation, and its treatments on an
    issued bill. `bill_start` (0030) reads all of it for whoever may issue a
    bill, reception included, who may not open a visit.
  - **Lines** (D303, D308, D309): added from a sheet — a search over the
    price list, grouped by category, and **Add typed line** for
    `payments.discount`. A treatment with no entry of its name is a reminder
    line, "Crown: pick its price-list entry", with **Pick entry**; nothing
    is issued until an entry is picked or the line removed. A line's price
    is a field for `payments.discount`, its read-out otherwise.
  - **Layout** (D310): on a desktop the lines on the left, the totals,
    Collect now and Issue on the right, kept in view; on a phone they
    stack, and **Issue bill** sits on a bar fixed to the foot.
- **Collect now:** an optional payment (amount, method, reference) recorded in
  the same transaction. It starts on, filled with the total, in Cash; the
  amount follows the total until one is typed, and it is off when the bill
  comes to nothing (D304).
- **Issue:** `create_bill` — one transaction, an idempotency key (a double tap
  makes one bill), the next number of the clinic's **financial year**
  (`2026-27/0001`, April – March in the clinic's timezone — D27) from its
  counter, the totals recomputed, the prices checked against the price list
  and the doctor's fee unless the issuer holds `payments.discount`, and the
  visit marked Billed — from No charge too (D287); a Billed visit may take
  another bill (D286). A bill is issued final. **Issue bill** does not ask
  first — the preview is the check (D312); once issued, the screen goes
  back where it came from with the card, "Bill 2026-27/0042 issued · ₹500
  collected" (D302), a visit to bill offered on a profile going back to the
  profile.
- **Issued bills are never edited.** A mistake is **voided** (`payments.edit`,
  asks first, a reason) and a new bill issued. A void bill stays visible,
  marked Void, and leaves the balance.
- **A bill's page — `/bills/[id]`** (`payments.view`; D314): the number, the
  patient, the day and doctor, and where it stands — Paid, Part paid, Unpaid
  or Void; **Print** and **Download** (§15.5); **Void bill** for
  `payments.edit` — a reason in a sheet, then the coral card asks first;
  **Re-issue** on a void bill, opening a new bill for its visit, arrival or
  patient filled with its lines, discount and notes; a quiet **Open
  profile**. Then its lines, notes and figures — paid and due on it, and
  the patient's balance — and, once void, when, by whom and why. Its back
  arrow leads to Billing, or to the profile it was opened from (D325).
  **Record payment** (R8.6), for `payments.create` while it is Unpaid or
  Part paid, opens the sheet for its patient filled with what is still due
  on it, and the page is read again once recorded. **WhatsApp** (R8.8,
  D327, D341) sends a live bill with its number, day, total and what is due
  — the share sheet with the PDF on a phone, WhatsApp Web and a download on
  a desktop, as the prescription is (§22.1). The issued card stays up with
  **Print**, **WhatsApp** (what is due on the newest bill: the balance, no
  more than its total) and **View bill** for whoever reads bills (D317,
  D327).
- **A bill's doctor** (§18; R8.8, D326, D342): a visit's or an arrival's
  bill is the visit's doctor's. A bill from a patient names its doctor by
  chips — No doctor or each active doctor, starting on the patient's
  assigned doctor while they practise — and a doctor picked prices a
  Consultation line at their own fee (D289), a line still at the last
  doctor's price moving with the pick. `bill_start` (0032) lists the
  doctors and their fees; `create_bill` checks the one picked is active.
- **Paid state of a bill** (Paid / Part paid / Unpaid) is computed: the
  patient's net payments settle their issued bills oldest first
  (`bill_settlement` view). The patient's balance is the truth; the bill's
  state is a reading of it.

### 15.3 Payments

- **Record payment** (`payments.create`): patient, amount, method (Cash, UPI,
  Card, Bank transfer, Other), reference (UPI ref, cheque no.), when paid
  (defaults to now; any time up to now, never later, D299), note. Recorded
  against the patient; an amount beyond what is owed becomes an **advance**
  (negative balance), used by later bills.
  - **As built (R8.6):** the sheet opens from Billing and the ＋ on a patient
    search (D323); the patient picked shows their balance and fills the
    amount with what they owe — empty when nothing is (D324). **Paid on** is
    a day, today unless changed, never after it: today's payment is stamped
    when recorded, an earlier day's at noon of that day, so it counts on that
    day (D334). Opened for a patient — Outstanding's row — it names them.
    `POST /api/payments` (once per Idempotency-Key); the card says "₹500
    received from Anita Rao" and the balance now.
- **Refund** (D322), as built: on the profile's balance while an advance is
  held, the same sheet titled Refund — the amount filled with the advance,
  the method and a reference; "₹700 refunded to Anita Rao".
- **A payment's sheet** (D336): Billing's Payments rows, and the history's, open it — how much,
  how, when, its reference and note, who took it; once void, when, by whom
  and why — with **Void payment** (or **Void refund**) for `payments.edit`.
- **Refund** (`payments.edit`): money returned — no more than the advance
  held, so a refund never makes a patient owe (D297).
- **Void** (`payments.edit`, asks first, a reason): a payment entered by
  mistake. Voided payments stay visible and leave the balance. A payment with
  a refund standing on it is voided after the refund (D301).
- Every payment records who received it (`received_by`) and is idempotent.

### 15.4 Balance and outstanding

`patient_balances`: billed (issued bills) − paid + refunded, a row per
patient kept up to date by the money functions in each one's transaction
(D295). Positive is **due**, negative is **advance**. A patient who owes, or
holds an advance, may be archived; the balance stays and counts (D300).

**Billing — `/billing`** (`payments.view`) has tabs: **To bill** (§15.6),
**Bills** (number, patient, date, total, state; filters by date and state),
**Payments** (date, patient, amount, method, received by), **Outstanding**
(patients who owe, most first, with Call / WhatsApp / Record payment).

As built (R8.6): **To bill** carries how many wait, and every doctor's
visits, oldest first; **Bills** and **Payments** open on Today (D335) and pick
7 days, This month or From – To (D320, at most 366 days), Bills also All,
Paid, Part paid, Unpaid or Void; each tab keeps its days while another is
looked at. **New bill** and **Record payment** sit in the header for
`payments.create`. **Outstanding**'s WhatsApp opens the dues reminder from
the clinic (D321); its archived patients' balances still count, with no
Record payment until restored. The patients list's **Owing** tab lists those
who owe, most first, and every row a coral "₹1,200 due" chip (D101).

### 15.5 The bill PDF

A4 or A5 by the clinic's paper size (D28). Letterhead (logo, name, address,
phone, GSTIN if set), bill number and date, patient name, number and mobile,
the lines, subtotal, discount, total, paid against this bill, due on this bill,
the patient's overall balance, and a small "Generated with ClinicDesk" footer
(D30). On demand, never stored; share, download, print.

As built (R8.5): "Bill" with its day on the right and "No. 2026-27/0042"
under it; the patient with their age on the bill's day, sex and number, then
their mobile and the doctor; the lines as a table — description, quantity,
rate, amount; the figures at the right; the balance and the notes. The foot
of the last page is signed by the clinic as its **Authorised signatory**
(D316). A void bill prints with a large, faint VOID across every page and
"Void: {reason}" under its number, and no payment or balance (D315).
Saved as "{patient} - Bill 2026-27-0042.pdf". `GET /api/bills/{id}/bill.pdf`
(`payments.view`; `?download=1` to save); view-only clinics print too.

### 15.6 Checkout — the To-bill list (D46)

Every completed visit has a **billing state**, so no finished consultation
leaves unbilled by accident:

| State | Meaning | Set by |
|---|---|---|
| `TO_BILL` | Finished, nothing billed yet. | The visit closing — unless the rule below says Billed. |
| `BILLED` | A bill was issued for it. | `create_bill` linked to the visit or its appointment. |
| `NO_CHARGE` | Deliberately free — a review, a courtesy visit. | **No charge** (`payments.create`), with a reason from `NO_CHARGE_REASONS` (Review, Courtesy, Other + note). |

When a visit closes it is `BILLED` at once if a bill of its own was issued
while it was open (**Bill now**, §12.2), or if its consultation was billed at
arrival (§11.3) **and** no treatment was worked on during it (no session
recorded in it); otherwise `TO_BILL`. A procedure done after an arrival-paid
consultation therefore still reaches checkout.

The **To bill** column of the queue (and a tab of Billing) lists `TO_BILL`
visits, oldest first, from any day: patient, doctor, token, what was done.
**Bill** opens the new bill pre-filled (§15.2): the consultation (if not paid
at arrival) and the treatments; staff add anything else, collect and issue —
one tap when nothing changes. **No charge** settles it without a bill; a bill
issued for it afterwards makes it `BILLED` (D287). Voiding a bill returns its
visit to `TO_BILL` once nothing billed remains for it, by the rule above
(D286).

As built (R8.6, Billing's tab): each row the patient, the doctor, the token,
the day when not today and what was done — the consultation unless paid at
arrival (**Fee paid**), and the treatments worked on. Its one **Bill** opens
a small sheet with **Bill** (the new bill, leading back to Billing) and **No
charge** — Review, Courtesy, or Other with a note (D319). `to_bill_visits`
(0031) reads it for `payments.view`, reception included. The queue's To bill
is the same rows and sheet, its bill leading back to the queue (§11.4); a
done visit waiting in To bill has **No charge** beside **Bill now** (D319).

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
| Follow-ups | `appointments.view` or `visits.view` (D267) | Counts for Today / Overdue / Lapsed, the first five due; **View all**. |
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
| Remind | Follow-ups (§14.3) | "Dr. Maya Rao at Smile Care asked to see you again around 14 Oct. Reply or call 0484 234 5678 to book." — the clinic's phone, when it has one (D273) |
| Send bill | A bill's page; the issued card (D327) | "Your bill 2026-27/0042 from Smile Dental, 15 Oct: ₹1,500." — and "₹1,000 is due." while something is (D341) — + the PDF; never a void bill |
| Send prescription | Visit, prescription | "Your prescription from Dr. Maya, Smile Dental, 12 Oct." + the PDF |

- **The PDF:** on a phone, the share sheet (Web Share API with the file) hands
  it to WhatsApp with the text; on a desktop, WhatsApp Web opens with the text
  and the PDF is downloaded to attach (`src/lib/share.ts`, R6.8, D245, D246).
  A touch-first device that can share files takes the share sheet; any other
  is a desktop.
- Every reminder sent is recorded where it was sent from (an appointment's
  "Reminded at", a follow-up contact with outcome *Reminder sent*), so the
  desk knows who has been told. An appointment's is noted when Remind is
  tapped, by those who may change appointments, for a booking still to come
  (R5.7, D179 – D184); in a view-only clinic the message still opens, unnoted.
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
│   └── RELEASE.md                         # Phase 14
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
  1 hour, refresh rotation on (Supabase defaults reviewed in R14.2).
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
                      · appointment_type_id · scheduled_at (a booking on 5-minute steps)
                      · duration_minutes (5–480)
                      · local_date (set by trigger, clinic timezone) · status
                      · token_number · arrived_at · started_at · completed_at
                      · notes · cancel_reason · cancelled_at · cancelled_by · reminded_at
                      · stepped_out_at (only while arrived, D198)
                      · urgent_at (marked while arrived, kept in progress and completed;
                        dropped with any other status, D201)
                      · idempotency_key · created_by · updated_by
                      EXCLUDE USING gist (doctor_id WITH =, appointment_slot(scheduled_at,
                        duration_minutes) WITH &&)
                        WHERE source = 'BOOKED' AND status NOT IN ('CANCELLED','NO_SHOW')
                      unique (doctor_id, local_date, token_number), (clinic_id, idempotency_key)
                      indexes: (clinic_id, local_date, scheduled_at),
                      (clinic_id, doctor_id, local_date, scheduled_at),
                      (clinic_id, patient_id, scheduled_at desc), and every foreign key
daily_tokens          clinic_id · doctor_id · day · last_token   PK (doctor_id, day)
```

### 28.5 Clinical

```text
visits                id · clinic_id · patient_id · doctor_id · appointment_id (unique, null)
                      · status (OPEN|COMPLETED) · visit_date · started_at (empty until the
                        patient goes in, for one opened by their vitals, D203) · completed_at
                      · complaint · diagnosis · notes · follow_up_on
                      · billing_status (TO_BILL|BILLED|NO_CHARGE, set on completion)
                      · no_charge_reason · no_charge_note · created_by · updated_by
vitals                id · clinic_id · patient_id · visit_id (unique) · systolic · diastolic
                      · pulse · temperature_f numeric(4,1) · spo2 · respiratory_rate
                      · weight_kg numeric(5,2) · height_cm numeric(5,1)
                      · recorded_by · updated_by          each CHECKed against VITAL_LIMITS
prescriptions         id · clinic_id · patient_id · visit_id (unique) · doctor_id (= the
                      visit's) · advice · print_diagnosis bool (false, D216)
                      · entered_by (who typed it as it stands) · created_by · updated_by
prescription_items    id · clinic_id · prescription_id (cascade) · position (1 – 30) · medicine
                      · strength · dose · frequency · timing (PRESCRIPTION_TIMINGS)
                      · duration_days (1 – 365) · instructions · created_at (when the
                      line was written as it is: what a suggestion fills, D211)
prescription_templates id · clinic_id · doctor_id · name · advice · active · created_by
                      · updated_by   unique (clinic_id, doctor_id, lower(name)) where active
                      (D243)
prescription_template_items  id · clinic_id · template_id (cascade) · position
                      · the same item columns as prescription_items
treatments            id · clinic_id · patient_id · doctor_id · name · description · status
                      · estimated_cost_paise · started_on · completed_on · next_due_on
                      (open only) · next_due_set_at (D268) · cancel_reason · cancelled_at
                      · cancelled_by (D250)
                      · started_visit_id · created_by · updated_by
treatment_sessions    id · clinic_id · treatment_id · visit_id · note · created_by
                      · updated_by   unique (treatment_id, visit_id)
follow_up_contacts    id · clinic_id · patient_id · treatment_id · visit_id (one of the
                      two) · outcome · note · snooze_until · contacted_by · contacted_at
                      — never changed
```

### 28.6 Money

```text
bills                 id · clinic_id · patient_id · visit_id · appointment_id (fee at arrival;
                        one or the other, D283)
                      · doctor_id (the visit's or the appointment's, or picked; null = "No
                        doctor" — §18)
                      · issued_at · issued_on (its day in the clinic's timezone)
                      · financial_year ('2026-27') · bill_number ('2026-27/0001')
                      unique (clinic_id, bill_number)
                      · subtotal_paise · discount_paise · total_paise (each ≤ MAX_AMOUNT_PAISE)
                      · status (ISSUED|VOID) · notes · void_reason · voided_by · voided_at
                      · idempotency_key (unique per clinic) · created_by
                      check (discount ≤ subtotal, total = subtotal − discount); only ever
                      voided, once (check_bill)
bill_counters         clinic_id · financial_year · last_number   PK (clinic_id, financial_year)
bill_items            id · clinic_id · bill_id (cascade) · position (1 – BILL_MAX_ITEMS)
                      · service_id (its name copied) · treatment_id (only with a service, D285)
                      · description · quantity (1–999) · unit_price_paise · amount_paise
                      check (amount = quantity × unit_price)
payments              id · clinic_id · patient_id · kind (PAYMENT|REFUND) · amount_paise > 0
                      · method · reference · paid_at (never later than recorded, D299)
                      · paid_on (its day in the clinic's timezone) · note
                      · status (RECORDED|VOID) · void_reason · voided_by · voided_at
                      · received_by · idempotency_key (unique per clinic); only ever voided,
                      once (check_payment)
patient_balances      patient_id (PK) · clinic_id · billed_paise · paid_paise · refunded_paise
                      · balance_paise (billed − paid + refunded, generated)   kept by the
                      money functions (D295); refunded ≤ paid
expenses              id · clinic_id · category_id · description · amount_paise · expense_date
                      · payment_method · archived_at · archived_by · created_by · updated_by
```

### 28.7 Views and functions

| Name | Purpose |
|---|---|
| `patient_balances` (a table, D295) | billed, paid, refunded, balance per patient, kept by the money functions (`add_to_balance`). |
| `bill_settlement` (a view, as the caller) | each issued bill's paid, due and state (Paid, Part paid, Unpaid), the patient's net payments settling their bills oldest first (D298); read for a patient. |
| `bill_start(visit, appointment, patient)` (0030) | where a new bill starts, read for `payments.create` — reception included, who may not open a visit: the patient, the visit or the arrival and its token, the doctor and their fee, whether the consultation is billed, the treatments worked on not yet on an issued bill, the balance, and a patient's oldest visit to bill (D285, D286, D313); within the doctor scope and the clinic. |
| `last_visit_on(patient)` (0022) | the day of a patient's latest visit, read with the patients list for everyone who sees the patient (D228). |
| `visit_recorded(visit)` (0022) | whether a visit holds anything: its row in the history (D226), and Back to waiting through `visit_is_empty` (D197). |
| `follow_up_items(tab)`, `follow_up_counts()`, `record_follow_up_contact` (0026, 0027) | the follow-ups in their tabs, a page at a time, and how many each holds, for whoever sees appointments or visits (§14.3, D267 – D271); a call noted; the last contact with who made it (D275). |
| `subscription_state(clinic)` | §7.2. |
| `dashboard_summary()`, `report_daily(date)` (with the day-end collection summary), `report_monthly(month)` (with by doctor) | §17, §18. |
| `register_clinic`, `invite_member`, `accept_invite`, `update_member`, `set_member_active` | accounts and team. |
| `create_appointment`, `update_appointment`, `change_appointment_status`, `add_walk_in`, `mark_arrived` (token; the fee bill follows through `create_bill`, D283) | appointments. |
| `send_in`, `mark_done`, `next_patient`, `back_to_waiting` (each opens, closes or removes the visit with the appointment), `mark_stepped_out`, `mark_urgent` (0019) | the queue (§11.4; D192 – D198, D201). |
| `start_visit` (from a profile) and `finish_visit` (its Done), `save_vitals` (a visit's, or a waiting patient's, opening their visit), `update_visit` (notes or follow-up) — each section's save refused from an older copy (0020; D202 – D208); `save_prescription` (the whole, by the doctor or `prescriptions.write`, D210 – D215) and `medicine_suggestions` (D211) (0021); `save_prescription_template` (a doctor's own, new or changed, asking before it replaces one of the same name, D240 – D243) and `previous_prescription(visit)` (Repeat's, D236) (0023) | visits. |
| `create_treatment` (in a visit, the visit's doctor's and, begun at once, its first session; or from the profile), `update_treatment` (its details, from the copy read, D251), `change_treatment_status` (as `treatment_status_next()` allows, a reason with a cancellation, D250), `record_treatment_session` (from any of the patient's visits, starting a planned or on-hold one, D248, D249 — and completing it in the same save, D257, 0025), `remove_treatment_session` (by its treatment and visit, while the visit is open, D254, 0025) (0024); `visit_treatments(visit)` (a visit's card: the open ones and those touched in it, D256) (0025) | treatments (§14.1). |
| `import_patients(rows)` | one import batch (§10.5): validated, numbered, audited. |
| `create_bill` (for a visit, an arrival or a patient; prices held without `payments.discount`, D284, D289), `void_bill`, `mark_no_charge`, `visit_billed(visit)` (whether its bills settle it, as a visit closes and a bill is voided, §15.6) (0028); `record_payment` (a payment, or a refund of no more than the advance, D297), `void_payment` (a payment after its refund, D301), and `create_bill` with what is collected with it (D282) (0029) | money. |
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
0016_patient_import             max_import_rows (D128); import_patients safe to send again,
                                each row under its own key (D133)
0017_appointments               appointments, exclusion, transitions, daily_tokens,
                                create/update/status/walk-in/arrived functions, the archive
                                refused with appointments to come (D140), closure_appointments
                                (D137), doctor_booked_times (D147)
0018_visits                     visits (with billing state), vitals, send_in, mark_done,
                                next_patient, back_to_waiting, mark_stepped_out
0019_urgent                     appointments.urgent_at, mark_urgent; dropped with the status
                                that leaves the queue (D201)
0020_visit_records              save_vitals, update_visit (each from the copy read, D206),
                                start_visit, finish_visit (D204); a visit opened by its
                                vitals before Send in (D203)
0021_prescriptions              prescriptions, prescription_items, save_prescription (D210 –
                                D215), medicine_suggestions (D211); a prescription counts as
                                something recorded (D197)
0022_patient_timeline           a patient's visits in the history's order (D225);
                                visit_recorded (D226), which visit_is_empty now denies;
                                last_visit_on for the patients list (D228)
0023_prescription_templates     prescription_templates (+ items), save_prescription_template
                                (D240 – D243); previous_prescription for Repeat (D236)
0024_treatments                 treatments, treatment_sessions, transitions, their
                                functions (D248 – D254); a visit with a treatment started or
                                worked on in it holds something (D197); a patient with an open
                                treatment is not archived (D255)
0025_treatment_screens          the last session completing its treatment (D257), a session
                                removed by its treatment and visit (D254), visit_treatments
                                for a visit's card (D256)
0026_follow_ups                 follow_up_contacts, next_due_set_at, follow_up_items,
                                follow_up_counts, record_follow_up_contact (D267 – D271)
0027_follow_up_callers          who made a follow-up's last contact, with it (D275)
0028_bills                      bills, bill_items, financial-year bill_counters, create_bill
                                (the fee at arrival a bill for the arrived appointment, D283),
                                void_bill, mark_no_charge; a visit closing Billed by its own
                                bill or its arrival's (§15.6); no archive with a visit to bill
                                (D288)
0029_payments                   payments, record_payment, void_payment, the payment with a
                                bill in create_bill (D282), patient_balances kept by the
                                money functions (D295), bill_settlement (D298); no
                                patient_stats (D296)
0030_bill_start                 bill_start: where a new bill starts — a visit's, an arrival's or
                                a patient's — for payments.create, reception included (D313)
0031_checkout                   to_bill_visits and to_bill_count for reception, who may not open a
                                visit (D318, D337); list_bills with each bill's state (D320);
                                search_patients' Owing tab (D101); billing_status of an
                                arrival for the queue's Done (D339)
0032_bill_doctor                bill_start with a patient's assigned doctor, the doctors to
                                pick and their fees (D326, D342), and the patient's mobile
                                for Send bill on WhatsApp (D341)
0033_expenses                   expenses
0034_dashboard_and_reports      dashboard_summary, report_daily, report_monthly
0035_subscription_notices       the daily pg_cron → pg_net call (address and secret in Vault)
0036_clinic_deletion            request_clinic_deletion, cancel_clinic_deletion,
                                delete_clinic (DEV)
0037_session_profile            session_profile: the session, profile, membership and plan in
                                one read (R13.2, D134)
0038_faster_reads               indexes and policies from the load-seeded EXPLAINs (R13.3)
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
| Closures | `GET, POST /api/closures` · `DELETE /api/closures/[id]` · `GET /api/closures/appointments` (the appointments on the days being picked, D137) |
| Team | `GET /api/team` · `POST /api/team/invites` · `POST /api/team/invites/[id]/resend` · `DELETE /api/team/invites/[id]` · `GET, PATCH /api/team/[id]` · `POST /api/team/[id]/active` |
| Doctors | `GET /api/doctors` (active doctors, for pickers) |
| Subscription | `GET /api/subscription` (state, dates, prices, contact, history — owner) · `GET /api/subscription/payments/[id]/receipt.pdf` |
| Patients | `POST /api/patients` · `POST /api/patients/search` (the list, a page at a time: the words, the tab and the cursor in the body, D98) · `POST /api/patients/matches` (the mobile in the body, D98) · `GET, PATCH /api/patients/[id]` · `POST /api/patients/[id]/archive` · `POST /api/patients/[id]/restore` · `GET /api/patients/[id]/summary` (where they stand: the next appointment, D166, and their treatments, D260; each part only with its permission) · `GET /api/patients/[id]/timeline` (their history, a page at a time: visits and the appointments that have none, D167, D225; `?cursor=` counts each part shown; each part only with its permission) · `GET, POST /api/patients/import` (the owner's: the import's limits, D128; a batch) · `POST /api/patients/import/matches` (the clinic's patients on a batch's mobiles, in the body, D98) · `GET, POST /api/patients/[id]/alerts` · `PATCH /api/patients/[id]/alerts/[alertId]` |
| Appointments | `GET, POST /api/appointments` (the calendar's days, `?from&to&doctorId`, at most a week; a booking, with a new patient in its body when one is added, D145) · `GET /api/appointments/booked` (a doctor's taken times on a day, D147) · `GET, PATCH /api/appointments/[id]` (its detail, D160; its notes, or moved, D161) · `POST /api/appointments/[id]/status` (confirmed, scheduled, a no-show — `appointments.edit` — or cancelled with its reason — `appointments.cancel`, D162) · `POST /api/appointments/[id]/arrived` (the token, D173) · `POST /api/appointments/[id]/reminded` (a reminder noted, D180) · `POST /api/appointments/walk-in` (once per key, the token, D171, D173) |
| Queue | `GET /api/queue` (today's: still to come, arrived, with a doctor, done — and anyone still with a doctor from before; `?doctorId`, D170) · `POST /api/queue/send-in` (what becomes of those in, D192) · `POST /api/queue/done` · `POST /api/queue/next` (D193, D196) · `POST /api/queue/waiting` (back to waiting, D197) · `POST /api/queue/stepped-out` (D198) · `POST /api/queue/urgent` (D201) |
| Visits | `POST /api/visits` (New visit, D204) · `GET, PATCH /api/visits/[id]` (a section, with the copy read, D206) · `PUT /api/visits/[id]/vitals` · `POST /api/visits/[id]/done` (a profile visit's Done) · `PUT /api/appointments/[id]/vitals` (a waiting patient's, D203) · `POST /api/visits/[id]/no-charge` |
| Prescriptions | `PUT /api/visits/[id]/prescription` (whole, with the copy read, D210; the visit's own read carries it) · `GET /api/visits/[id]/prescription.pdf` (to open and print; `?download=1` to save, D221) · `GET /api/prescriptions/medicines?q=&doctorId=` (D211) · `GET /api/prescription-templates?doctorId=` (a doctor's, archived too, with their medicines; for the doctor and `prescriptions.write`, D241) · `POST /api/prescription-templates` (the doctor's own; `replace` once asked, D243) · `PATCH /api/prescription-templates/[id]` (its name, medicines and advice, or archived or restored, D242) |
| Treatments | `POST /api/treatments` (in a visit or from the profile, D252, D258; read with the visit and the patient's summary, so no `GET`) · `PATCH /api/treatments/[id]` (its details or its next sitting, with the copy read, D251, D259) · `POST /api/treatments/[id]/status` (D250) · `PUT, DELETE /api/treatments/[id]/sessions/[visitId]` (a visit's session on it: saved, completing it when ticked, D257; removed while the visit is open, D254) |
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
  The Queue tab carries the To-bill count for those who bill — as built
  (R8.6, D337), a coral count on its icon in the bar and the rail, at the
  end of its capsule in the sidebar, read beside the screen every 15 s.
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
| `/follow-ups` | Follow-ups | appointments.view or visits.view (D267) |
| `/billing` · `/billing/new` · `/bills/[id]` | Billing, new bill, bill | payments.view / .create |
| `/expenses` | Expenses | expenses.view |
| `/reports` | Reports | reports.view |
| `/team` · `/team/[id]` | Team, member | team.manage |
| `/settings` | Settings index | signed in |
| `/settings/account` | My account | signed in |
| `/settings/account/templates` · `/settings/account/templates/new` · `/settings/account/templates/[id]` | A doctor's prescription templates (D242) | a doctor |
| `/settings/clinic` · `/settings/price-list` · `/settings/appointment-types` · `/settings/expense-categories` · `/settings/closures` | Clinic setup | settings.manage |
| `/settings/plan` · `/settings/activity` · `/settings/import` · `/settings/export` · `/settings/delete-clinic` | Plan and receipts, activity, import, export, deletion request | owner |
| `/admin/*` | Developer console | DEV |
| `/offline` · not-found · error | System screens | — |

Create and edit forms are **sheets** (bottom sheet on a phone, side panel on a
desktop), except the visit workspace, a prescription template (D242) and the
new bill, which are screens.

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
- **A list shows its own rows:** while what is searched changes, the last rows
  stay until the new ones arrive; another tab or filter shows its own rows, or
  loading rows while they come, never the last tab's under its name (D191).
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
written anywhere. Printing opens the PDF itself in the browser's or phone's
viewer, which is its preview (D221); Download saves it (`?download=1`).
Sharing uses the Web Share API with the file where available, else download
(R6.8, D183).

- **`src/lib/pdf`:** the faces (Figtree Regular, SemiBold and Bold, static
  TrueType in `public/fonts/pdf`, cut to Latin and ₹ by
  `scripts/pdf-fonts.mjs`, D224), a layout composer that wraps text and marks
  where a page may end, the letterhead, and the renderer: laid out on A5's
  width and scaled to A4's, paged at those marks, a running line atop each
  later page, a foot (the signature) on the last, the footer on every page.
  Black and grey only (D220). A WebP logo is turned into PNG (sharp) for it.
- **Fonts on the server:** `next.config.ts` traces `public/fonts/pdf` into
  every `/api/**/*.pdf` route.

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
| Speed (R13.7) | `tests/db/integration/`, `tests/speed/` | `npm run verify` and CI on every push; `npm run test:speed` on the load seed, locally and in the release, before each release | every list, search, count and report served by an index; each screen and read within 2 round trips, each save within 4; first-load JS within 200 KB gzip; timed on the load seed, every list and search under 300 ms. |
| Security (R13.8) | `tests/contract/`, CI | `npm run verify`, CI on every push and weekly | the dependency audit (high and critical in shipped code, D188); Supabase's database lints; every API route behind its guard. Beside them, run as before: tenant isolation, the permission matrix, the doctor scope, read-only refusal, redaction. |
| Smoke (R13.9) | `tests/smoke/` | `npm run test:smoke`: in `npm run verify` and CI against the built app; in the release against each new version before it takes the domain | read-only and signed in to nothing (D187): the database, Supabase Auth, the API's refusal, the cron secret, the headers, the PWA files, the region. |

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
- **Locally first** (D189, from R13.10): `npm run verify` passes on this
  machine before anything is pushed — a pre-push hook runs it — and
  `npm run test:speed` passes before a release is tagged.

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
  Playwright install → E2E (phone + desktop) → artifacts on failure. From
  Phase 13 it also runs the speed checks, the security checks (weekly too)
  and the smoke test (R13.7 – R13.9, D185).
- **`release.yml`** on a published GitHub release `vX.Y.Z` equal to
  `package.json`'s version: check the tag → call `ci.yml` on it → `supabase db
  push` to the hosted project → build on GitHub → `check-deploy-output.mjs`
  (no source, source maps or env files) → `vercel deploy --prebuilt --prod`.
  **Vercel is never connected to the repository.** A push deploys nothing.
  From Phase 13 (D185, D186): `ci.yml` and `npm run test:speed` pass first;
  the new version is deployed without the domain (`--skip-domain`), the
  smoke test runs at its own address, and `vercel promote` gives it the
  domain only when that passes. A failure leaves the live version
  untouched — so a migration keeps the version before it working, since it
  is applied before the new version takes the domain.
- **Environments:** local (Docker Supabase + Mailpit) and production. No
  staging. `.env.example` lists every variable, validated at start by
  `src/lib/env`; `.env.local` holds local values; production values live in
  Vercel and GitHub secrets.
- **Locally first** (D189): `npm run verify` runs everything CI runs, on this
  machine; a pre-push hook runs it and refuses the push when anything fails.
  A release is tagged only after `npm run test:speed` passes locally too.
- **Branching** (D199, D200): until the first release, commit on `main`,
  the whole suite passed locally first. The user pushes it to
  github.com/mohd-jaffa/clinic when they choose; the agent does not push.
  CI runs on every push. From the first release on, work on a
  branch, PR to `main`, CI green before merge. Commit after every completed
  change with a short conventional message (`feat(patients): …`), as
  AGENTS.md says.
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
  every list and search under 300 ms at the API (R13.4).
- **Round trips** (D134): what a request waits on is mostly the trips from
  the server to the database, one after another — about 40 ms each from
  Vercel to Supabase in production. Every screen and every read waits on at
  most **2**: the session, then everything else at once. A save waits on at
  most **4**: the session, any check the write needs, the write, its audit
  row. Measured on the production build locally with 40 ms added to each
  database request (R13.1).
- **The server beside the database:** Vercel `bom1` with Supabase
  `ap-south-1`, and functions kept warm (fluid compute). Brio's live app was
  slow for both reasons: its server ran in Washington, and an idle function
  took 1 – 8.5 s to answer.
- **Screens:** server-drawn with their first data (AppScreen), no layout shift
  from loading states (skeletons sized to content).
- **Accessibility:** zero axe violations on every E2E-visited screen; a manual
  keyboard and screen-reader pass before release (R14.4).

### 37.1 Speed in every row (D135)

Speed is built with each row, not added at the end. From R5.1 on, every row:

- **Indexes what it reads.** Every query it adds is served by an index that
  leads with `clinic_id`, in the query's own filter and order. A paged list
  has an index in its own order, partial when the list keeps to one status.
  Every foreign key is indexed, since Postgres does not do it. The
  migration's contract test names each index.
- **Keeps policies cheap.** Helpers are called as `(select fn())`, so they
  run once a statement, not once a row. A policy keeps a doctor to their
  patients as `0015` does, `(select public.sees_every_patient()) or
  patient_id in (select public.doctor_patient_ids())`, never with
  `can_see_patient()` for each row.
- **Makes no call it does not need.**
  - Reads that do not depend on each other go at once, failing for the first
    one listed, as Brio's `allInOrder` does.
  - A record comes with its children in one query (embedded select).
  - No query runs in a loop.
  - A write answers from its own `returning`, not a second read.
  - Side work the answer does not need (emails, the bell) runs after the
    answer (`after()`); the audit row is written beside the read-back, not
    after it.
- **Selects what it shows.** No `select *`; a list reads its own columns. Sums,
  counts and balances are worked out in SQL, never by fetching rows to add
  up in the server or the browser.
- **Keeps the browser light.**
  - One SWR key serves every reader of a route.
  - A screen opened again shows the data its page arrived with and does not
    read it twice; Back and Forward read it again (D190).
  - A screen polls only when it changes under you (the queue), and stops
    while the tab is hidden.
  - Heavy code (PDF drawing, Excel reading, charts) loads when it is first
    needed.
- **Says what it costs.** Its changelog entry gives how many round trips its
  screens and saves wait on, within §37's budget.

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
| **13 — Speed and the release checks** | Every screen, read and save measured on a load-seeded clinic; the session in one round trip; indexes and policies tuned; round trips cut to the budget; the hosting beside the database (D134). The speed, security and smoke tests set up and run by CI (D185). | 12 | Every screen and read waits on at most 2 round trips and every save on at most 4 (§37); every list and search is under 300 ms at the API on the load seed; Supabase's performance advisor reports nothing; the speed checks, security checks and smoke test are set up and pass locally (`npm run verify`, the pre-push hook) and in CI. |
| **14 — Hardening and release v1.0.0** | Security and accessibility passes; speed checked again; the full journey; release workflow; production setup. Starts only when Phase 13's checks pass (D185). | 13 | §34.4 passes at both widths in CI; the release checklist is complete; v1.0.0 is live and answers from `bom1` within §37's budgets. |

## 39. Tracker

**Status** is one of **TODO**, **DOING**, **DONE (date)**, **BLOCKED
(reason)**, or **LATER (date)**. Rows done before D136 read **DONE (date ·
commit)**. *Source* is the plan section. *Waits on* names the open question
(§41) whose answer the row needs; without an answer it is built on that
question's default. Rows are never deleted. Every row includes its tests
(§34), its indexes and round-trip count (§37.1) and its changelog entry, all
in the row's one commit (D136).

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
| R4.1 | `0015_patients`: counter, `patient_doctors` + triggers, `can_see_patient`, alerts, search indexes; `create_patient`, `search_patients`, `import_patients` (D98 – D104) | §10, §27.3 | — | DONE (2026-10-03 · 8e2a0e9) |
| R4.2 | Patient sheet: DOB or age, gender, phones, emergency contact, assigned doctor; mobile-match hint; added once per idempotency key; the date picker's month and year jump (D105 – D109) | §10.1 | — | DONE (2026-10-04 · f1d155b) |
| R4.3 | Patients list: search (name, mobile digits, number), tabs, paging; Call on each row; a search that finds no one offers Add patient; the last visit and Owing come with their phases (D101, D110 – D112) | §10.2 | — | DONE (2026-10-04 · 04b6a76) |
| R4.4 | Patient profile: header and details, sections by permission; the next appointment, open treatments, balance and history come with their phases (D101, D113 – D116) | §10.3 | — | DONE (2026-10-04 · 1b07f6f) |
| R4.5 | Alerts: allergies, conditions, medications (D117 – D120) | §10.4 | — | DONE (2026-10-04 · 45f61d5) |
| R4.6 | Archive and restore (D122 – D125) | §10.1 | — | DONE (2026-10-04 · 8096bfa) |
| R4.7 | Integration: the doctor scope; staff without `patients.view`; isolation rows | §34 | — | DONE (2026-10-05 · 1e9c3c0) |
| R4.8 | `0016_patient_import`; patient import: parse CSV/Excel in the browser, map, preview (errors, duplicates), batches, summary, refused rows as CSV (D127 – D133) | §10.5 | — | DONE (2026-10-05 · c149350) |

### Phase 5 — Appointments and the queue

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R5.1 | `0017_appointments`: table (clinic's appointment types), exclusion, transitions, closures check, the appointments on a closure being added listed (D87, D137), nothing booked for an archived patient (D103), tokens, functions (D138 – D143) | §11, §28.4 | — | DONE (2026-10-11) |
| R5.2 | Booking sheet: patient search/quick add, doctor, date, time, type → duration; clash card (D144 – D151) | §11.1 | — | DONE (2026-10-11) |
| R5.3 | Calendar: day (list / columns per doctor), week, doctor filter, closures shaded; the kit's calendar grid (D66; D152 – D159) | §11.5 | — | DONE (2026-10-11) |
| R5.4 | Appointment detail: confirm, reschedule, cancel (reason), no-show; the profile's next appointment and its appointments in the history (D101; D160 – D167) | §11.2, §10.3 | — | DONE (2026-10-11) |
| R5.5 | Walk-ins, arrival tokens, today's queue (Waiting, With doctor, Still to come, Done) with 15 s refresh (D168 – D175) | §11.3, §11.4 | — | DONE (2026-10-12) |
| R5.6 | Integration (concurrent bookings, concurrent tokens) + E2E (D176 – D178) | §34 | — | DONE (2026-10-12) |
| R5.7 | WhatsApp click-to-send: the link helper; appointment reminders and `reminded_at` (D179 – D184; the share helper moves to R6.8, D183) | §22.1 | — | DONE (2026-10-12) |

### Phase 6 — Visits, vitals and prescriptions

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R6.1 | `0018_visits`: visits (billing state), vitals, `send_in`, `mark_done`, `next_patient`; Send in, Done and Next patient in the queue and the workspace (D192 – D198: a second chair, Next patient for the desk, Back to waiting, Stepped out, the visit screen's header) | §11.4, §12.1, §28.5 | — | DONE (2026-10-13) |
| R6.2 | `0020_visit_records`; visit workspace: alerts, vitals, complaint/diagnosis/notes, follow-up, per-section saves (D202 – D209: vitals while waiting, New visit, saves refused from an older copy) | §12.2 | — | DONE (2026-10-13) |
| R6.3 | `0021_prescriptions`: items, advice, medicine suggestions, allergy warning; the doctor's own, or typed with `prescriptions.write` (`entered_by`) (D210 – D217: fields on the visit screen saved together, a suggestion fills the line, Save asks about an allergy, the registration number first) | §13, §8.2 | — | DONE (2026-10-14) |
| R6.4 | `lib/pdf` letterhead (A4 and A5, footer) and the prescription PDF; download, print (D218 – D224: clinic on top and the doctor under it, a numbered list, black and grey, Print opens the PDF, once saved, the file's name, English letters now); share with R6.8 (D183) | §13, §33 | — | DONE (2026-10-14) |
| R6.5 | `0022_patient_timeline`; patient timeline with visits and prescriptions; the patients list's last visit (D101; D225 – D231: one list, a visit standing for its appointment; what it found and its medicines; opening its screen, which leads back; the last visit for everyone who sees the patient, on a line of its own; two columns on a desktop) | §10.3, §10.2 | — | DONE (2026-10-15) |
| R6.6 | Integration + E2E: queue → visit → prescription PDF (D232 – D235: the visit's moves and saves at once; the journey continued, an assistant in it; the doctor's visit follows the assistant's; the PDF's paper, name and title) | §34 | — | DONE (2026-10-15) |
| R6.7 | `0023_prescription_templates`; Repeat last prescription; prescription templates (save, apply, edit, archive) (D236 – D243: Repeat names its day and doctor, both add after what is typed, advice on a new line, the buttons in view, only the doctor saves, a sheet to pick, My account's screens, a name in use asks to replace) | §13 | — | DONE (2026-10-15) |
| R6.8 | Send prescription on WhatsApp, with the share helper: the PDF through the share sheet, or downloaded on a desktop (D183; D244 – D247: beside Print and Download for whoever reads the visit, the share sheet on a phone, WhatsApp Web and the download on a desktop, nothing recorded) | §22.1 | — | DONE (2026-10-15) |
| R6.9 | `0019_urgent`: Urgent, a tag on a waiting patient kept through their visit; Next patient still goes by token (D201) | §11.4 | R6.1 | DONE (2026-10-13) |

### Phase 7 — Treatments and follow-ups

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R7.1 | `0024_treatments`: treatments, sessions, transitions (D248 – D255: a session starts a planned or on-hold one, from any of the patient's visits; a cancellation may say why; refused from an older copy; its doctor changes while open; the cost for whoever sees it; a session removed only while its visit is open; no archive with one open) | §14.1 | — | DONE (2026-10-15) |
| R7.2 | `0025_treatment_screens`; treatments in the visit workspace and on the profile (D256 – D263: rows opening a sheet, the last sitting completing it in one save, begun today with the price list's estimate, the next sitting's own chips, open then Show closed on the profile, the whole story in the sheet, Tx in the history, between the notes and the prescription) | §14.1 | — | DONE (2026-10-15) |
| R7.3 | `0026_follow_ups`: `follow_up_items`, contacts (D267 – D271: the front desk works them too; done once the patient is coming back; on hold with a date counts; the 30-day windows fixed; snoozed out of the counts) | §14.2 | — | DONE (2026-10-15) |
| R7.4 | Follow-ups screen: tabs with counts, Call, WhatsApp, Book, Mark contacted (D272 – D278: Call on the row, the rest in its sheet; Remind noted as Reminder sent; "remind me on" chips; the last contact with who made it, `0027_follow_up_callers`; Book closes it; Completed offers Call and the profile; one list, no doctor filter) | §14.3 | — | DONE (2026-10-16) |
| R7.5 | Integration: each tab on the right day in the clinic's timezone; lapsed follows the setting (D279 – D281: every edge from the clinic's today, the 1:30 AM case, the setting changed and put back; database tests only) | §34 | — | DONE (2026-10-16) |
| R7.6 | Follow-up reminders on WhatsApp, recorded as a contact (built with R7.4, D273) | §14.3, §22.1 | — | DONE (2026-10-16) |

### Phase 8 — Billing and payments

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R8.1 | `0028_bills`: bills, items, financial-year counters, `create_bill` (idempotent, price check without `payments.discount`), `void_bill`, `mark_no_charge`, the fee at arrival as a bill for the arrived appointment (D282 – D289: payments with R8.4; the token, then the fee bill; typed lines need `payments.discount`; a treatment through a price-list line; more than one bill a visit; No charge billed after all; no archive with a visit to bill; a Consultation at its price or the doctor's fee) | §15.2, §15.6, §11.3 | — | DONE (2026-10-16) |
| R8.2 | `billing/totals.ts`, the one formula; discount by amount or % (D290 – D293: a percentage to the nearest rupee; whole percentages, 1 – 100; the amount only on the bill; a discount past the bill refused at its field) | §15.1 | — | DONE (2026-10-16) |
| R8.3 | New bill screen: from To bill, a visit or a patient; the doctor's fee; discount and price change with `payments.discount`; collect now. Collect fee at arrival (D302 – D313: back where it came from with the card; lines from a sheet; Collect now on with the total; the Collect fee sheet after the token; Fee paid; Bill now at the visit's foot; a reminder line for an unpriced treatment; the price a field with permission; lines left and totals right; New bill in the profile's header; Issue does not ask; a patient search first. `0030_bill_start`, so expenses are 0031 on) | §15.2, §11.3 | — | DONE (2026-10-18) |
| R8.4 | `0029_payments`: record, refund, void; the payment with a bill in `create_bill` — Collect now, Issue and collect (D282); `patient_balances`, `bill_settlement` (D294 – D301: built before R8.3; balances kept by the money functions; no `patient_stats`; refunds from the advance; oldest first; paid up to now; archived with a balance; a refund voided first) | §15.3, §15.4 | — | DONE (2026-10-16) |
| R8.5 | Bill PDF; share, download, print (D314 – D317: the bill's page with Print, Download, Void, Re-issue and the profile; VOID across a void bill; signed by the clinic; the issued card's Print and View bill. Share on WhatsApp is R8.8's, D327) | §15.5, §33 | — | DONE (2026-10-18) |
| R8.6 | Checkout: the queue's To-bill column, Billing's tabs (To bill, bills, payments, outstanding), No charge; the profile's balance section, its bills and payments in the history, and the patients list's Owing tab and balance chip (D101) | §15.4, §15.6, §10.2, §10.3 | — | DONE (2026-10-24) |
| R8.7 | Integration: double submit → one bill/payment; balances to the paisa; read-only refuses | §34 | — | DONE (2026-10-24) |
| R8.8 | A bill's doctor (from the visit, or picked); send bill on WhatsApp | §18, §22.1 | — | DONE (2026-10-24) |

### Phase 9 — Expenses

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R9.1 | `0033_expenses` and the expenses screen (the clinic's categories): add, edit, archive, month totals, by category | §16 | — | TODO |
| R9.2 | Integration + E2E | §34 | — | TODO |

### Phase 10 — Home and reports

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R10.1 | `0034_dashboard_and_reports`: `dashboard_summary`, `report_daily`, `report_monthly` | §17, §18 | — | TODO |
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
| R11.5 | `0035_subscription_notices`: daily notices, each once per period | §22 | — | TODO |
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
| R12.5 | `0036_clinic_deletion`: the owner's request and cancel (banner, emails), the admin's delete after the cooling-off | §9.1, §20 | — | TODO |
| R12.6 | CSV export, one file per area, audited | §9 | — | TODO |

### Phase 13 — Speed and the release checks (D134, D185)

Every screen, read and save built in Phases 0 – 12, made as fast as it can
be before anyone uses it live. Each row measures before and after, and its
changelog gives both. Then the three tests that guard every release are set
up: speed (R13.7), security (R13.8) and smoke (R13.9). They run locally first,
through `npm run verify` and a pre-push hook (R13.10, D189). **Phase 13 is
DONE only when all three pass locally and in CI; Phase 14, and any
deployment, waits on that (D185).**

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R13.1 | The measuring setup: a load seed (a clinic with 50 000 patients, 200 000 appointments, 100 000 bills, a year of visits); the production build timed locally with 40 ms added to each database request; every screen, read and save timed and its round trips counted; Home, Queue and Patients timed on a throttled phone (4× CPU, 4G). The baseline in the changelog | §37 | — | TODO |
| R13.2 | `0037_session_profile`: the session in one round trip. The token's signature and expiry checked on the server against the project's published key (`getClaims`), instead of asking Supabase Auth each request. One function checks the session is still open and hands back the profile, membership, clinic, doctor, plan and the settings it needs. Today a session waits on 3: Auth, the profile, then the plan and settings | §5.5, §37 | — | TODO |
| R13.3 | `0038_faster_reads`: EXPLAIN ANALYZE on the load seed for every list, search, count and report. Indexes added or changed (every paged list in its own order, every foreign key). No policy or list calls `can_see_patient()` per row. Supabase's performance advisor reports nothing: unindexed keys, policies re-run per row, overlapping policies, duplicate or unused indexes | §27, §28, §37 | — | TODO |
| R13.4 | Round trips cut to the budget. Reads that do not depend on each other go at once (`allInOrder`), records come with their children, writes answer from `returning`, and side work runs after the answer. Every screen and read within 2, every save within 4; every list and search under 300 ms at the API on the load seed | §37 | — | TODO |
| R13.5 | Pages: the proxy starts only where it has work and loads the Supabase client only to renew. Heavy code loads when first needed; first-load JS within 200 KB gzip. Polling stops while the tab is hidden. Reusing a screen revisited within seconds (`staleTimes`) measured, kept only if it helps. LCP and INP within budget on the throttled phone | §37 | — | TODO |
| R13.6 | Hosting: `vercel.json` with region `bom1` and fluid compute, sent by `vercel deploy --prebuilt` with every release; the release guide (R14.7) says so | §35, §37 | — | TODO |
| R13.7 | Speed tests, so no later change makes it slow again. **Locally (`npm run verify`) and in CI on every push:** every list, search, count and report query EXPLAINed against the local database by an integration test, failing on a sequential scan of a clinic-owned table; every screen, read and save's database round trips counted, failing over 2 and 4; each signed-in screen's first-load JS checked on the build, failing over 200 KB gzip. **Timed:** R13.1's measurements as `npm run test:speed` on the load seed, failing when a list or search is over 300 ms at the API. Run locally before every release (D189), and again by the release workflow before it deploys (R14.7); not on every push, since shared CI runners time too unevenly | §34, §37 | R13.1 – R13.5 | TODO |
| R13.8 | Security tests. **Locally (`npm run verify`), in CI on every push, and weekly:** the dependency audit, `npm audit --omit=dev --audit-level=high`, failing on a high or critical advisory in shipped code (D188), with today's (`next`, `sharp`, `source-map-js`) fixed here; Supabase's database lints (the security and performance advisors' checks) run against the local database, failing on any finding; a route test that finds every `src/app/api/**/route.ts` handler behind `withClinicRoute` naming its permission, `withDevRoute` or `withSessionRoute`, or on the short list of public routes. These join the tests already run: tenant isolation, the permission matrix, the doctor scope, read-only refusal, redaction | §27, §34, §35 | — | TODO |
| R13.9 | The smoke test: `npm run test:smoke`, a short read-only Playwright run against any address, signing in to nothing (D187). It checks: the landing page shows the live price, so the database answers; a wrong password is refused as the app refuses it, so Supabase Auth answers; a signed-out API call is refused with the envelope and a request id; the cron endpoint refuses a call without its secret; the security headers are present; the manifest and service worker are served; the answer comes from `bom1` (production only). **Run locally (`npm run verify`) and in CI on every push** against the built app on port 3100, and by the release workflow against each new version before it takes the domain (D186, R14.7) | §34, §35 | R13.6 | TODO |
| R13.10 | Locally first (D189): `npm run verify` runs everything CI runs, in CI's order — lint, format, types, coverage, the security checks (R13.8), the build, E2E, the speed checks (R13.7), the smoke test (R13.9) — and stops at the first failure. It refuses to start unless 55322 is ClinicDesk's own local database. A git pre-push hook, set up by `npm install`, runs it and refuses the push when it fails. The release guide (R14.7) has `npm run verify` and `npm run test:speed` passed locally before a release is tagged | §34, §35 | R13.7 – R13.9 | TODO |

### Phase 14 — Hardening and release v1.0.0

Starts only when Phase 13 is DONE, its speed, security and smoke tests set up
and passing locally and in CI (D185, D189).

| ID | Work | Source | Waits on | Status |
|---|---|---|---|---|
| R14.1 | Rate limits: Supabase Auth settings, Vercel firewall on `/api/auth/*` | §27.6 | — | TODO |
| R14.2 | Security review: every table's policies, every service-role call, headers, session settings, redaction | §27 | — | TODO |
| R14.3 | Patient-data review: logs, error log, audit, PDFs, cache headers, service worker | §27.6 | — | TODO |
| R14.4 | Accessibility pass: axe on every screen; manual keyboard and screen reader | §37 | — | TODO |
| R14.5 | Speed checked again: R13.1's measurements and R13.7's speed tests re-run after R14.1 – R14.4, nothing over budget | §37 | — | TODO |
| R14.6 | The full critical journey (§34.4) at both widths in CI | §34.4 | — | TODO |
| R14.7 | `release.yml`, `check-deploy-output.mjs`, `docs/RELEASE.md` (accounts, setup, each release, backups, rollback). Each release: `npm run verify` and `npm run test:speed` pass locally before the tag (D189); the workflow then runs every test again, `ci.yml` (with R13.7's and R13.8's checks) and `npm run test:speed`. It then deploys the new version without the domain, runs the smoke test (R13.9) at its own address, and promotes it only when that passes (D186); a failure leaves the live version untouched | §35 | — | TODO |
| R14.8 | Production: Supabase (ap-south-1), Vercel (bom1), domain, Gmail SMTP, Vault and env secrets (`CRON_SECRET`, `TRIAL_CLAIM_SECRET`), the DEV account, renewal contact set, the final product name; restore rehearsed; v1.0.0. The live app checked: the smoke test (R13.9) passes against it, and it answers from `bom1::bom1`, warm and after idling, within §37's budgets | §35, §37 | Q1, Q3, Q22 | TODO |

## 40. Definition of shippable

A phase is DONE when:

- typecheck, lint, format check, unit, integration (with 100% coverage) and
  E2E are green in CI;
- from Phase 13 on, the speed, security and smoke tests pass too, locally
  (`npm run verify`) and in CI (D185, D189);
- every screen it touched is checked at 360, 390, 414, 768, 1024 and 1440 px,
  in every theme, with no axe violations;
- no hard-coded strings (all words in `messages.ts`), no business rule in code
  that §6 says is a setting;
- `changelog.md` has the phase's entries and its tracker rows read DONE;
- its screens and saves are within §37's round-trip budget;
- open blockers are recorded.

## 41. Open questions

Answered questions keep their row, with the decision that settled them. An open
one has a **default** that is built if no answer arrives before its tracker row
starts.

| ID | Question | Status |
|---|---|---|
| Q1 | The product's final name and brand. | **Partly answered (D35):** "ClinicDesk" is a working name, used only through `UI_TEXT.appName` and the brand constants. The final name is needed before Phase 12. |
| Q2 | The renewal contact to show clinics (name, phone/WhatsApp, email, UPI id), and the business name and address for plan receipts. | **Open.** Set by the DEV in platform settings (§6); hidden until set; required before release. |
| Q3 | The production domain. | **Open.** Required before R14.8. |
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
  languages**; **a per-clinic temperature unit**;
  **Indian scripts in the PDFs** (Noto Sans for Hindi, Malayalam, Tamil,
  Telugu, Kannada, Bengali, Gujarati, Punjabi and Odia, D224).

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
| Phases: Foundation → Core → Finance → Operations → Inventory → Payroll | Phases 0 – 14 to a production v1.0.0; inventory, payroll and dental in Later | The draft's own V1 scope; D6. |
| Analytics "Revenue" | "Collected" and "Billed", defined (§18) | With bills, revenue has two meanings. |
| Hosting unstated | Vercel `bom1` + Supabase `ap-south-1` | D9 — close to users, data in India. |
| One price per service | The clinic's price list, and each doctor's own consultation fee | D26 |
| The doctor starts, completes and bills each visit | Staff run the queue (Send in, Done) and the doctor has one Next patient button; visits open and close with it, may close empty, and wait in **To bill** until billed or marked No charge; the fee may be taken at arrival | D43 – D46 — a busy doctor only sees patients |
| Fixed appointment types and expense categories | Per clinic, seeded | D32, D40 |
| Sign-in by email | Email or mobile | D39 |
