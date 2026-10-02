# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

One responsive Next.js app for every device: the browser on a phone, a tablet
or a desktop, and the same app installed as a PWA. There is no store app; the
design follows no single OS's native style.

## Stack

Decided in the plan (`clinic-management-app-planning.md` §24): Next.js 16
(App Router, React Compiler), TypeScript, Tailwind CSS 4 with tokens in
`src/app/globals.css`, our own UI kit in `src/components/ui`, Supabase,
Vercel. Conventions follow Brio (`/Users/jaffa/projects/ovenly`).

## Users

Small and medium clinics in India — dental, general, physiotherapy,
dermatology and others — with one to a handful of doctors. Patients never use
the app.

- **Reception staff** run the day at a shared desktop and on their phones:
  walk-ins and tokens, bookings, sending patients in, marking them done,
  billing at checkout, collecting money, reminding patients on WhatsApp. Many
  are new to software.
- **Doctors** see patients. Their only required action in the app is **Next
  patient**; notes, vitals and prescriptions are optional, often typed by an
  assistant. Many are senior (50s – 60s).
- **Assistants and nurses** take vitals and type notes and prescriptions for
  the doctor.
- **The owner** (often also a doctor) sets the clinic up, manages the team,
  and reads the day's collections and the month's numbers, usually at a desk.
- **The platform admin** (DEV) runs a separate console: clinics,
  subscriptions, platform settings. Never patient data.

## Product Purpose

ClinicDesk runs the front desk and the consulting room of a small clinic:
patients, appointments and the walk-in queue, visits with vitals and
prescriptions, treatments and follow-ups, bills and payments, expenses and
reports (the plan, §1 – §22).

**Success** is a clinic where reception never double-books a doctor, the
doctor sees allergies before a prescription is written, no treatment is
forgotten half-done, every finished visit is billed or deliberately free, and
the owner knows at the end of each day what came in and what went out.

## Positioning

All four are true and must stay true (the user, 2026-10-02):

1. **Built around the OPD queue.** Walk-ins, tokens and the front desk come
   first — how an Indian clinic actually runs on a busy day.
2. **The doctor only sees patients.** Staff run the queue, notes and billing;
   the doctor's one required control is **Next patient**.
3. **Small-clinic simple and cheap.** Everything a 1 – 5 doctor clinic needs
   and nothing more, usable on day one without training. ₹300/month or
   ₹3,000/year after a free trial (defaults; the platform admin sets them).
4. **Nothing slips.** Every finished visit is billed or marked No charge, every
   pending treatment is followed up, every rupee is collected or visibly owed.

## Operating Context

- **A busy OPD morning:** patients arrive in waves; reception issues tokens,
  sends patients in as the doctor frees up, checks them out and collects.
  Speed and not making mistakes under pressure matter more than anything else.
- **Devices:** a shared reception desktop used all day by several people;
  budget Android phones, sometimes in sunlit reception areas; the doctor's
  phone or a desk computer in the room.
- **Connection drops** are common: the app is online-only but loses nothing
  typed and never stores patient data on the device.
- **Patients are reached on WhatsApp** — click-to-send reminders, bills and
  prescriptions; calls are a tap away.
- **Paper still matters:** prescriptions and bills print on A4 or A5 with the
  clinic's letterhead, and are signed by the doctor.
- **India throughout:** ₹ (integer paise), +91 mobiles, the clinic's day in
  Asia/Kolkata, financial-year bill numbers, English UI.
- **Weekly or monthly at a desk:** the owner reviews collections, outstanding,
  revenue by doctor and expenses.

## Capabilities and Constraints

- The plan (`clinic-management-app-planning.md`) is the source of truth for
  every capability; its decision log (D1 – D58) records what was decided.
- **Roles:** Owner, Doctor, Staff, with granular permissions and presets;
  doctors see only their own patients. A platform DEV role sees no clinic
  data.
- **Subscription states** show in the app: Active, Expiring (banner),
  Grace (banner), Read-only (writes disabled, with the reason).
- **The only upload** is the clinic logo. Avatars are initials.
- **Words:** clinic, patient, doctor, team, token, visit, bill, No charge,
  To bill, Next patient.
- **Undecided:** the final product name ("ClinicDesk" is a working name,
  used only through constants), the production domain, the renewal contact.

## Brand Commitments

- **Name:** ClinicDesk — a working name until the user confirms the final one
  before Phase 12. It is never hard-coded outside the brand constants.
- **Voice: warm and reassuring** (the user, 2026-10-02). Plain, everyday
  English with a little warmth at moments that earn it ("All caught up for
  today"). Never playful about money, health or errors; an error says what
  happened and what to do next.
- **The clinic leads.** Its name and logo head the app and every bill and
  prescription; ClinicDesk appears only on sign-in, the installed icon and a
  small document footer.
- **Binding visual constraints from the user** (2026-10-02), recorded as
  given:
  - **No gold** colour (Brio's Golden theme is not reused).
  - **Light and dark themes** (D36).
  - **A centre ＋ button in the phone bottom bar** that opens Quick Actions.
  - Design references supplied by the user, kept locally in
    `design-references/` (git-ignored, never committed).

## Evidence on Hand

- The plan and its decision log; the design references above.
- **Absent, and never to be invented:** real clinics, users, testimonials,
  reviews, usage numbers, ratings, press or partner logos. The product has no
  track record yet. Demo data (names, patients, figures) is synthetic and
  labelled as such wherever it could be mistaken for real.

## Product Principles

1. **The queue is the heartbeat.** What is happening at the desk right now —
   who is waiting, who is in, who is to bill — is always one tap away.
2. **The doctor's time is sacred.** Nothing in the app ever requires the doctor
   to stop and fill something in.
3. **Nothing slips.** Every state that needs a person's attention (to bill,
   overdue, owing, expiring) is visible until it is resolved.
4. **Usable on day one.** One obvious next step per screen, plain words, hard
   to make a mistake; no training required.
5. **The clinic's name, not ours.** Every surface a patient sees belongs to
   the clinic.

## Accessibility & Inclusion

- **WCAG 2.2 AA** in both themes; touch targets ≥ 44 px; inputs at 16 px.
- **Older doctors:** generous base text size, high contrast, obvious buttons,
  nothing that works only through a gesture or hover.
- **Staff new to software:** plain words, one primary action per screen,
  irreversible actions confirmed, errors beside their field.
- **Budget phones in bright rooms:** fast on mid-range Android over 4G, light
  pages, contrast that survives glare.
- **Shared reception desktop:** full keyboard operation, visible focus,
  scannable dense lists where they help.
- Screen-reader support, reduced motion respected, colour never the only
  carrier of status.
