# Clinic Management App — Project Planning

## 1. Overview

A mobile-first, responsive clinic management application built with:

- **Next.js**
- **TypeScript**
- **Supabase**
- **PostgreSQL**
- **Supabase Auth**
- **Supabase Storage**
- **Vercel**

The application is designed for internal use in:

- Dental clinics
- General clinics
- Other small/medium healthcare clinics

The architecture should be **multi-tenant from the beginning**, so multiple independent clinics can use the same application later without exposing data between clinics.

Initial development will happen locally. Production will later use:

```text
Next.js → Vercel
Database/Auth/Storage → Supabase Cloud
```

No separate worker, Redis server, or continuously running backend process is required initially.

---

# 2. Core Concept

The main tenant boundary is the **Clinic**.

```text
Platform
│
├── Clinic A
│   ├── Owner
│   ├── Doctors
│   ├── Staff
│   ├── Patients
│   ├── Appointments
│   ├── Visits
│   ├── Treatments
│   ├── Payments
│   ├── Expenses
│   └── Inventory
│
├── Clinic B
│   ├── Owner
│   ├── Doctors
│   ├── Staff
│   └── Patients
│
└── Clinic C
    └── ...
```

Data belonging to one clinic must never be accessible by another clinic.

Tenant isolation must be enforced at the **database level using Supabase Row Level Security (RLS)** and not only through frontend/server-side filtering.

---

# 3. User Roles

Initial roles:

1. **Owner**
2. **Doctor**
3. **Staff**

## 3.1 Owner

The owner can:

- Manage the clinic
- Add/remove doctors
- Add/remove staff
- Manage staff permissions
- View all patients
- View all appointments
- View visits and treatments
- View payments
- Manage expenses
- View analytics
- Manage clinic settings

An owner may or may not be a doctor.

### Owner who is not a doctor

Can manage the complete clinic but does not have a doctor profile.

### Owner who is also a doctor

The same user can have:

```text
role = OWNER
doctor_profile = present
```

They can manage the clinic and also operate as a doctor.

---

# 4. Staff Permissions

Staff should not have one fixed access level.

Use granular permissions.

Examples:

```text
appointments.view
appointments.create
appointments.edit
appointments.cancel

patients.view
patients.create
patients.edit

visits.view
visits.create
visits.edit

payments.view
payments.create
payments.edit

expenses.view
expenses.create

inventory.view
inventory.manage

reports.view
```

Example receptionist:

```text
✓ View patients
✓ Create patients
✓ View appointments
✓ Create appointments
✓ Edit appointments
✓ Cancel appointments

✗ View financial reports
✗ Manage staff
✗ Manage expenses
✗ Manage inventory
```

Example clinic manager:

```text
✓ Patients
✓ Appointments
✓ Staff
✓ Payments
✓ Expenses
✓ Inventory
✓ Reports
```

The owner controls which permissions each staff member receives.

---

# 5. Authentication

Use **Supabase Auth**.

Initial authentication:

```text
Email + Password
```

Future options:

```text
Google
Phone OTP
Magic Link
```

Keep V1 authentication simple.

Recommended identity structure:

```text
auth.users
    │
    ▼
profiles
    │
    ▼
clinic_members
    │
    ├── owner
    ├── doctor
    └── staff
```

Do not build a separate authentication system.

---

# 6. Database Architecture

## 6.1 Clinics

```text
clinics
────────────
id
name
type
phone
email
address
timezone
created_at
updated_at
```

---

## 6.2 Profiles

```text
profiles
────────────
id
full_name
phone
avatar_url
created_at
updated_at
```

`profiles.id` should reference the authenticated Supabase user.

---

## 6.3 Clinic Members

```text
clinic_members
──────────────
id
clinic_id
user_id
role
status
joined_at
created_at
updated_at
```

This represents the relationship between a user and a clinic.

This structure also leaves room for a user to potentially belong to multiple clinics in the future.

---

## 6.4 Doctors

```text
doctors
────────────
id
clinic_id
user_id
specialization
license_number
active
created_at
updated_at
```

A doctor should be linked to a user account.

---

## 6.5 Staff

```text
staff
────────────
id
clinic_id
user_id
job_title
active
created_at
updated_at
```

Staff should represent clinic access/employment information, while payroll should be a separate future module.

---

# 7. Patients

```text
patients
────────────
id
clinic_id
patient_number
full_name
phone
email
date_of_birth
gender
address
emergency_contact
created_at
updated_at
```

Every patient belongs to exactly one clinic.

Patients should be searchable by:

- Name
- Phone number
- Patient number

Example:

```text
Search patients...

John Doe
+91 XXXXX XXXXX
Patient #P1023
Last visit: 28 Sep
```

---

# 8. Appointments

```text
appointments
──────────────
id
clinic_id
patient_id
doctor_id
scheduled_at
duration
status
appointment_type
notes
created_by
created_at
updated_at
```

Suggested statuses:

```text
SCHEDULED
CONFIRMED
ARRIVED
IN_PROGRESS
COMPLETED
CANCELLED
NO_SHOW
```

Appointment creation should be quick.

Example flow:

```text
Patient
[ Search patient ]

Doctor
[ Select doctor ]

Date
[ Select date ]

Time
[ Select time ]

Duration
[ 30 min ]

Type
[ Consultation ]

[ Create Appointment ]
```

---

# 9. Visits

Do not store all visit information directly inside the patient table.

Use separate visit records.

```text
visits
────────────
id
clinic_id
patient_id
doctor_id
appointment_id
visit_date
complaint
diagnosis
notes
created_at
updated_at
```

A patient can have many visits.

```text
Patient
   │
   ├── Visit 1
   ├── Visit 2
   ├── Visit 3
   └── Visit 4
```

---

# 10. Treatments

```text
treatments
────────────
id
clinic_id
patient_id
visit_id
name
description
status
started_at
completed_at
next_treatment_date
created_at
updated_at
```

Suggested statuses:

```text
PLANNED
IN_PROGRESS
PENDING
COMPLETED
CANCELLED
```

This allows staff to quickly identify patients whose treatment is pending.

---

# 11. Patient Profile

The patient profile should be one of the main screens.

Example:

```text
Patient

John Doe
+91 XXXXX XXXXX

────────────────────

Next Appointment
12 Oct • 10:30 AM
Dr. Rahul

────────────────────

Treatment
Root Canal

Status
In Progress

Next Treatment
15 Oct

────────────────────

Visit History

12 Sep
Diagnosis...
Treatment...

25 Sep
Treatment...

────────────────────

Payments

₹5,000 paid
₹2,000 pending
```

Staff should be able to quickly understand the patient's current state without opening multiple screens.

---

# 12. Pending Treatments

Create a useful operational view:

```text
Pending Treatments
────────────────────────────

John
Root Canal
Next visit: 12 Oct
[Call]

Rahul
Crown fitting
Overdue by 4 days
[Call]

Anu
Follow-up
Due tomorrow
[Call]
```

Useful categories:

```text
Today's follow-ups
Upcoming treatments
Overdue treatments
Patients who haven't returned
Completed treatments
```

This feature can later support reminders and notifications.

---

# 13. Payments

Use a transaction-based payment model.

```text
payments
────────────
id
clinic_id
patient_id
appointment_id
amount
payment_method
payment_status
reference
paid_at
received_by
created_at
updated_at
```

Payment methods:

```text
CASH
UPI
CARD
BANK_TRANSFER
OTHER
```

Do not store only a `total_paid` field on the patient.

Instead:

```text
Patient
   │
   ├── Payment ₹2,000
   ├── Payment ₹3,000
   └── Payment ₹1,500
```

Totals can be calculated from the transaction history.

This also provides a better audit trail.

---

# 14. Expenses

```text
expenses
────────────
id
clinic_id
category
description
amount
expense_date
payment_method
created_by
created_at
updated_at
```

Possible categories:

```text
Rent
Electricity
Equipment
Medicine
Supplies
Salary
Maintenance
Marketing
Other
```

Basic financial calculation:

```text
Revenue
   -
Expenses
   =
Net operating amount
```

Financial terminology should remain clearly defined as the reporting system becomes more sophisticated.

---

# 15. Owner Dashboard

The owner dashboard can show:

```text
Good morning 👋

Today

┌───────────────┐
│ Appointments  │
│      18       │
└───────────────┘

┌───────────────┐
│ Patients Seen │
│      14       │
└───────────────┘

┌───────────────┐
│ Collected     │
│    ₹18,500    │
└───────────────┘

┌───────────────┐
│ Pending       │
│    ₹7,200     │
└───────────────┘
```

Also show:

- Today's appointments
- Pending treatments
- Overdue treatments
- Upcoming appointments
- Outstanding payments
- Recent payments
- Recent expenses

---

# 16. Analytics

Do not overbuild analytics in V1.

## Daily analytics

```text
Patients visited
Appointments
Completed appointments
Cancelled appointments
No-shows
Revenue collected
Expenses
Net amount
```

## Monthly analytics

```text
Total patients
New patients
Returning patients
Appointments
Revenue
Expenses
Outstanding payments
```

Future analytics:

```text
Revenue by doctor
Revenue by treatment
Appointment cancellation rate
No-show rate
Treatment completion rate
Outstanding payments
Expense categories
Patient acquisition
```

---

# 17. Dental Module

The core application should not be tightly coupled to dentistry.

Core:

```text
Clinic Management
    │
    ├── Patients
    ├── Appointments
    ├── Visits
    ├── Treatments
    ├── Payments
    ├── Expenses
    └── Staff
```

Dental-specific features can be added as a module:

```text
Dental Module
    │
    ├── Teeth
    ├── Tooth conditions
    ├── Dental chart
    ├── Procedures
    └── Treatment plans
```

This allows the application to support:

- Dental clinics
- General clinics
- Physiotherapy clinics
- Dermatology clinics
- Other clinic types

without making the core architecture dental-specific.

---

# 18. Inventory — Future Phase

Medicine inventory can be added later.

## Inventory items

```text
inventory_items
────────────────
id
clinic_id
name
category
unit
current_quantity
minimum_quantity
created_at
updated_at
```

However, do not only update `current_quantity`.

Maintain an inventory transaction history.

```text
inventory_transactions
────────────────────────
id
clinic_id
item_id
type
quantity
reason
patient_id
created_by
created_at
```

Example:

```text
+100
Purchase

-2
Given to patient #123

-1
Given to patient #456
```

This gives a complete stock movement history.

---

# 19. Payroll — Future Phase

Payroll should be a separate module.

```text
employees
    │
    ├── salary
    ├── attendance
    ├── deductions
    ├── bonuses
    └── payroll_records
```

Do not mix payroll logic into the basic staff access system.

Staff represents:

```text
Who can access the clinic system?
```

Payroll represents:

```text
How is the employee compensated?
```

These are different concerns.

---

# 20. Tenant Isolation and Security

This is one of the most important architectural requirements.

Every clinic-owned table should contain:

```text
clinic_id
```

Examples:

```text
patients
appointments
visits
treatments
payments
expenses
inventory
doctors
staff
audit_logs
```

The basic access flow should be:

```text
Authenticated User
        │
        ▼
clinic_members
        │
        ▼
clinic_id
        │
        ▼
Allowed database records
```

Supabase RLS should enforce the boundary.

The frontend must never be trusted to enforce tenant isolation.

Do not rely on:

```text
Frontend sends clinic_id
        ↓
Backend trusts it
```

Instead:

```text
auth.uid()
    ↓
clinic_members
    ↓
allowed clinic_id
    ↓
RLS
    ↓
database records
```

If a user attempts to access another clinic's patient, the database should reject the request.

---

# 21. Audit Logs

Because this application contains sensitive clinic and financial information, an audit system should be included early.

```text
audit_logs
────────────
id
clinic_id
user_id
action
entity_type
entity_id
metadata
created_at
```

Examples:

```text
Dr. Rahul created patient P1023

Staff Anu changed appointment A203

Owner removed staff member S14

Receptionist recorded payment ₹2,000
```

Important medical and financial records should generally be archived/soft-deleted where appropriate instead of being permanently deleted without a trace.

---

# 22. Mobile-First UI

The application should be designed mobile-first but remain fully usable on larger screens.

## Mobile

```text
┌─────────────────────────┐
│ Good morning            │
│ Dr. Rahul               │
│                         │
│ ┌────────┐ ┌────────┐   │
│ │ Today  │ │Patients│   │
│ │   12   │ │  248   │   │
│ └────────┘ └────────┘   │
│                         │
│ Today's appointments    │
│                         │
│ 09:00 John              │
│       Dr. Rahul         │
│                         │
│ 09:30 Sarah             │
│       Dr. Maya           │
│                         │
├─────────────────────────┤
│ Home Patients + More    │
└─────────────────────────┘
```

## Desktop

```text
┌─────────────┬─────────────────────────────┐
│ Dashboard   │                             │
│ Patients    │                             │
│ Appointments│        Main content         │
│ Doctors     │                             │
│ Staff       │                             │
│ Payments    │                             │
│ Expenses    │                             │
│ Reports     │                             │
│ Settings    │                             │
└─────────────┴─────────────────────────────┘
```

The same application should adapt its navigation and layouts based on screen size.

---

# 23. Recommended Next.js Structure

A feature-oriented structure is recommended.

```text
src/
│
├── app/
│   ├── (auth)/
│   │
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── patients/
│   │   ├── appointments/
│   │   ├── visits/
│   │   ├── payments/
│   │   ├── expenses/
│   │   ├── staff/
│   │   ├── doctors/
│   │   ├── inventory/
│   │   └── settings/
│   │
│   └── api/
│
├── components/
│
├── features/
│   ├── patients/
│   ├── appointments/
│   ├── visits/
│   ├── payments/
│   ├── expenses/
│   ├── staff/
│   └── inventory/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── permissions/
│   └── validation/
│
├── hooks/
│
├── types/
│
└── utils/
```

Feature-specific business logic should stay close to its feature.

---

# 24. Server vs Client Responsibilities

## Server-side

Use server-side code for:

- Database mutations
- Sensitive operations
- Permission checks
- Financial calculations
- Reports
- Administrative operations
- Secure data fetching

## Client-side

Use client components for:

- Appointment interactions
- Search
- Filters
- Modals
- Interactive forms
- Calendar interactions
- Dashboards
- Mobile navigation

Never expose the Supabase service-role key to the browser.

---

# 25. No Worker Initially

A separate worker is **not required for V1**.

Initial architecture:

```text
Mobile/Web Browser
        │
        ▼
     Next.js
        │
        ▼
     Supabase
     ├── Auth
     ├── PostgreSQL
     └── Storage
```

Production:

```text
User
 │
 ▼
Vercel
 │
 ▼
Supabase Cloud
 ├── Auth
 ├── PostgreSQL
 └── Storage
```

No:

```text
Redis
Worker
BullMQ
Separate Node server
```

is required initially.

---

# 26. Features That Can Work Without Workers

The following can run using normal Next.js + Supabase:

- Authentication
- Clinic management
- Patients
- Doctors
- Staff
- Permissions
- Appointments
- Visits
- Treatments
- Payments
- Expenses
- Reports
- Dashboard analytics
- File uploads
- Audit logs

---

# 27. Features That May Need Background Processing Later

Potential future background-processing features:

- Automatic appointment reminders
- WhatsApp/SMS reminders
- Large report generation
- Bulk exports
- Large file processing
- Scheduled notifications
- Inventory alerts
- Payroll processing
- Recurring tasks

Possible future technologies:

```text
Supabase Edge Functions
Supabase scheduled functions
Cron
External job service
Dedicated worker
```

Do not introduce these until there is an actual requirement.

---

# 28. Development Phases

## Phase 1 — Foundation

```text
✓ Project setup
✓ Next.js
✓ TypeScript
✓ Supabase
✓ Authentication
✓ Clinic creation
✓ Clinic membership
✓ User profiles
✓ Roles
✓ Permissions
✓ RLS
✓ Basic audit logging
```

---

## Phase 2 — Core Clinic Management

```text
✓ Patients
✓ Doctors
✓ Staff
✓ Appointments
✓ Calendar
✓ Visits
✓ Treatments
✓ Treatment status
✓ Patient history
```

---

## Phase 3 — Finance

```text
✓ Payments
✓ Outstanding payments
✓ Payment history
✓ Expenses
✓ Revenue dashboard
✓ Expense dashboard
✓ Basic financial reports
```

---

## Phase 4 — Operations

```text
✓ Follow-ups
✓ Pending treatments
✓ Overdue treatments
✓ No-shows
✓ Patient callbacks
✓ Upcoming treatments
```

---

## Phase 5 — Inventory

```text
✓ Medicines
✓ Stock
✓ Stock movements
✓ Low-stock alerts
```

---

## Phase 6 — Payroll

```text
✓ Employee salary
✓ Attendance
✓ Payroll
✓ Bonuses
✓ Deductions
```

---

# 29. Recommended V1 Scope

The first production-ready version should focus on:

```text
AUTH
 ├── Login
 └── Clinic membership

CLINIC
 ├── Clinic settings
 ├── Doctors
 └── Staff

PATIENTS
 ├── Create
 ├── Search
 ├── Profile
 └── History

APPOINTMENTS
 ├── Calendar
 ├── Create
 ├── Reschedule
 ├── Cancel
 └── Status

VISITS
 ├── Visit record
 ├── Treatment
 └── Next appointment

PAYMENTS
 ├── Record payment
 ├── Outstanding
 └── History

EXPENSES
 ├── Add expense
 └── History

DASHBOARD
 ├── Today's appointments
 ├── Patients today
 ├── Collection
 ├── Pending treatments
 └── Basic revenue/expense data

SECURITY
 ├── RLS
 ├── Permissions
 └── Audit logs
```

Avoid implementing inventory, payroll, advanced analytics, notifications, and other secondary features before the core workflow is stable.

---

# 30. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| UI | Tailwind CSS / component library |
| Database | PostgreSQL |
| Backend | Next.js server-side code + Supabase |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Security | Supabase RLS |
| Validation | Zod |
| Forms | React Hook Form |
| Hosting | Vercel |
| Database hosting | Supabase Cloud |
| Local development | Local Supabase |
| Background workers | None initially |
| Redis | None initially |
| Queue | None initially |
| Monitoring | Add later |

---

# 31. Overall Architecture

```text
                         ┌─────────────────────┐
                         │       USERS         │
                         │                     │
                         │ Owner / Doctor /    │
                         │ Staff               │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      NEXT.JS        │
                         │                     │
                         │ Responsive UI       │
                         │ Server Components   │
                         │ Server Actions/API  │
                         │ Permission checks   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │          SUPABASE            │
                    │                              │
                    │  Auth                        │
                    │     │                        │
                    │     ▼                        │
                    │  PostgreSQL                  │
                    │     │                        │
                    │     ├── Clinics               │
                    │     ├── Members               │
                    │     ├── Patients              │
                    │     ├── Doctors               │
                    │     ├── Staff                 │
                    │     ├── Appointments          │
                    │     ├── Visits                │
                    │     ├── Treatments             │
                    │     ├── Payments              │
                    │     ├── Expenses              │
                    │     └── Inventory              │
                    │                              │
                    │  RLS                         │
                    │  Storage                     │
                    └──────────────────────────────┘
```

---

# 32. Deployment Strategy

## Local development

```text
Next.js
   │
   ▼
Local Supabase
   ├── PostgreSQL
   ├── Auth
   └── Storage
```

Development should use migrations so the database schema can be reproduced reliably.

## Production

```text
Next.js
   │
   ▼
Vercel
   │
   ▼
Supabase Cloud
   ├── PostgreSQL
   ├── Auth
   └── Storage
```

The application should not depend on local-only configuration or local database behavior.

---

# 33. Key Architectural Principles

1. **Clinic is the tenant boundary.**
2. Every tenant-owned table should have `clinic_id`.
3. **RLS must enforce tenant isolation.**
4. Never trust a `clinic_id` supplied by the frontend.
5. Use Supabase Auth for identity.
6. Keep user identity separate from clinic membership.
7. Keep roles separate from granular permissions.
8. Keep staff access management separate from payroll.
9. Keep core clinic functionality separate from dental-specific functionality.
10. Use transaction/history tables for payments and inventory.
11. Maintain audit logs for important actions.
12. Prefer soft deletion/archiving for important records.
13. Design mobile-first but support desktop screens properly.
14. Avoid introducing Redis/workers until a real requirement exists.
15. Build the database and security model before heavily polishing the UI.
16. Keep the architecture compatible with both local Supabase and Supabase Cloud.
17. Keep V1 focused on the core clinic workflow.

---

# 34. Initial V1 Priority

The most important parts to get right are:

```text
1. Authentication
2. Clinic/Tenant model
3. Database schema
4. RLS
5. Roles
6. Permissions
7. Patients
8. Appointments
9. Visits/Treatments
10. Payments
11. Expenses
12. Dashboard
13. Audit logs
14. Responsive UI
```

Once these are stable, inventory, notifications, advanced analytics, dental-specific features, and payroll can be added as independent modules.
