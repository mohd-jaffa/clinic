/**
 * Every word the app says, in one place (AGENTS.md §5, §27). No screen, route
 * or schema writes a message inline: a wording is changed here once, and the
 * server and the client cannot end up saying different things about the same
 * failure. The voice is warm and plain (PRODUCT.md): an error says what
 * happened and what to do next, never more.
 */

import { FOLLOW_UP_WINDOW_DAYS, MAX_PATIENT_AGE } from "./limits";

/** A count as India writes it: 1,240 · 12,000 · 1,00,000. */
const count = (value: number) => value.toLocaleString("en-IN");

export const ERROR_MESSAGES = {
  VALIDATION_ERROR: "Please check the highlighted fields.",
  VALIDATION_INVALID_JSON: "The request body must be valid JSON.",
  IDEMPOTENCY_KEY_REQUIRED: "This request could not be checked for repeats. Please try again.",

  AUTH_SESSION_REQUIRED: "Please sign in to continue.",
  AUTH_SESSION_INVALID: "Your session has expired. Please sign in again.",
  AUTH_PERMISSION_DENIED: "You don't have permission to do this. Your clinic's owner can give it to you.",
  // One wording for a wrong password and an unknown account (plan §5.2).
  AUTH_INVALID_CREDENTIALS: "That email or mobile number and password don't match.",
  AUTH_EMAIL_NOT_CONFIRMED: "Please confirm your email first, with the link we sent you.",
  AUTH_MEMBERSHIP_INACTIVE: "You can't sign in to this clinic right now. Please ask its owner.",
  AUTH_EMAIL_ALREADY_EXISTS: "An account with this email already exists. Try signing in.",
  AUTH_PHONE_ALREADY_EXISTS: "An account with this mobile number already exists. Try signing in.",
  AUTH_LINK_INVALID: "This link has expired or has already been used. Please ask for a new one.",
  AUTH_PASSWORD_INCORRECT: "Your current password isn't right.",

  MAIL_NOT_CONFIGURED: "Email isn't set up yet, so it couldn't be sent.",

  // A refusal while the clinic's plan has run out (plan §7.3).
  CLINIC_PLAN_EXPIRED: "Your clinic is view-only until its plan is renewed.",

  LOGO_TOO_LARGE: "That logo is larger than 500 KB.",
  LOGO_TYPE_NOT_ALLOWED: "A logo must be a PNG, JPG or WebP image.",
  LOGO_UPLOAD_FAILED: "The logo couldn't be stored. Please try again.",
  CLINIC_LOAD_FAILED: "The clinic's details couldn't be loaded.",

  // The clinic's catalogues (plan §9, D80 – D83): a name is the clinic's only once while active.
  SERVICE_ALREADY_EXISTS: "Another service on the price list already has this name.",
  APPOINTMENT_TYPE_ALREADY_EXISTS: "Another appointment type already has this name.",
  EXPENSE_CATEGORY_ALREADY_EXISTS: "Another expense category already has this name.",
  // And one of each is always kept (D83).
  CONSULTATION_SERVICE_REQUIRED: "The price list keeps at least one Consultation — bills start from it.",
  APPOINTMENT_TYPE_REQUIRED: "Keep at least one appointment type — every booking needs one.",
  EXPENSE_CATEGORY_REQUIRED: "Keep at least one expense category — every expense is filed under one.",
  SERVICES_LOAD_FAILED: "The price list couldn't be loaded.",
  APPOINTMENT_TYPES_LOAD_FAILED: "The appointment types couldn't be loaded.",
  EXPENSE_CATEGORIES_LOAD_FAILED: "The expense categories couldn't be loaded.",

  // Holidays and leave (plan §9, D84 – D86).
  CLOSURE_STARTS_BEFORE_TODAY: "A holiday or leave starts today or later.",
  CLOSURE_DAYS_TAKEN:
    "Those days overlap a holiday or leave already set for the same people. Remove that one first, or choose other days.",
  CLOSURE_OVER: "That’s already over — it stays as a record.",
  CLOSURES_LOAD_FAILED: "Holidays and leave couldn't be loaded.",
  DOCTORS_LOAD_FAILED: "The clinic's doctors couldn't be loaded.",

  // The team (plan §8, D23, D63).
  MEMBER_ALREADY_EXISTS:
    "This person is already in a clinic on ClinicDesk, or invited to one. For now, a person belongs to one clinic.",
  MEMBER_DEACTIVATED_HERE: "They were on your team before. Reactivate them from the team list instead.",
  INVITE_EMAIL_NOT_ALLOWED: "This email can't join a clinic.",
  TEAM_MANAGE_OWNER_ONLY: "Only the clinic's owner can let someone manage the team.",
  TEAM_PERMISSION_NOT_HELD: "You can only give permissions you have yourself.",
  INVITE_CHANGED: "That invite was accepted or removed meanwhile.",
  INVITE_SENT_RECENTLY: "An invite went to them a moment ago. Give it a minute before sending another.",
  INVITE_INVALID: "This invite link isn't valid any more. Ask the clinic to send you a new one.",
  INVITE_EXPIRED: "This invite link has run out. Ask the clinic to send it again.",
  TEAM_LOAD_FAILED: "The team couldn't be loaded.",
  TEAM_OWNER_UNCHANGEABLE: "The owner always has all of it — their access can't be changed.",
  TEAM_NOT_YOURSELF: "You can't change your own access, or deactivate yourself.",
  TEAM_MEMBER_NOT_YOURS: "Only the owner can change someone who manages the team, or has access you don't.",
  MEMBER_STILL_INVITED: "They haven't joined yet. Resend or revoke their invite instead.",
  MEMBER_LOAD_FAILED: "This team member couldn't be loaded.",
  OWNER_NOT_DOCTOR: "Turn on “I also see patients” first.",
  DOCTOR_INACTIVE: "That doctor is no longer on the team. Choose another.",

  // Patients (plan §10, D103).
  PATIENT_ARCHIVED: "This patient is archived. Restore them to make changes.",
  PATIENT_BIRTH_DATE_INVALID: `A date of birth can’t be in the future, or more than ${MAX_PATIENT_AGE} years ago.`,
  PATIENT_LOAD_FAILED: "This patient couldn't be loaded.",
  HISTORY_LOAD_FAILED: "This patient's history couldn't be loaded.",
  PATIENTS_LOAD_FAILED: "The patients couldn't be loaded.",
  ALERT_ALREADY_EXISTS: "This patient already has that alert.",
  ALERTS_LOAD_FAILED: "The alerts couldn't be loaded.",
  PATIENT_HAS_APPOINTMENTS: "Cancel or move their appointments to come before archiving them.",
  PATIENT_HAS_TREATMENTS: "Complete or cancel their open treatments before archiving them.",
  PATIENT_HAS_VISITS_TO_BILL: "Bill their visits, or mark them No charge, before archiving them.",
  // A patient import's file (plan §10.5, D127): said in the browser, which reads it.
  IMPORT_FILE_TYPE: "That isn't a CSV or Excel (.xlsx) file.",
  IMPORT_FILE_XLS: "That's an older Excel file (.xls). Save it as .xlsx or CSV, then choose it again.",
  IMPORT_FILE_UNREADABLE: "That file couldn't be read. Check it opens, then choose it again.",
  IMPORT_FILE_EMPTY: "That file has no patients in it: it needs a header row and at least one row under it.",
  IMPORT_LIMITS_LOAD_FAILED: "The import couldn't be set up.",
  IMPORT_CHECK_FAILED: "The rows couldn't be checked against the clinic's patients.",

  // Appointments (plan §11; D7, D138 – D143).
  APPOINTMENT_SLOT_TAKEN: "That time is already booked with this doctor. Choose another time.",
  APPOINTMENT_ON_CLOSED_DAY: "The clinic is closed that day, or the doctor is on leave. Choose another day.",
  APPOINTMENT_IN_PAST: "That time has already passed. Choose a later time, or add a walk-in.",
  APPOINTMENT_STATUS_NOT_ALLOWED: "This appointment can’t go to that status from where it is. Refresh and try again.",
  APPOINTMENT_NOT_MOVABLE: "Only a booking that hasn’t arrived yet can be moved.",
  APPOINTMENT_NOT_TODAY: "Only today’s appointments can be marked arrived. Move it to today, or add a walk-in.",
  APPOINTMENT_NOT_REMINDABLE: "Only a booking still to come can be reminded.",
  APPOINTMENT_CANCEL_REASON_REQUIRED: "Say why it’s being cancelled.",
  APPOINTMENT_TYPE_INACTIVE: "That appointment type is archived. Choose another.",
  CLOSURE_APPOINTMENTS_LOAD_FAILED: "The appointments on these days couldn't be checked.",
  APPOINTMENTS_LOAD_FAILED: "The appointments couldn't be loaded.",
  APPOINTMENT_LOAD_FAILED: "This appointment couldn't be loaded.",
  QUEUE_LOAD_FAILED: "The queue couldn't be loaded.",

  // The queue's moves and visits (plan §11.4, §12.1; D192, D197).
  DOCTOR_ROOM_TAKEN: "Someone else is now with this doctor. Look at the queue again, then send them in.",
  APPOINTMENT_HAS_VISIT: "Their visit has something recorded. Send them in and mark them done instead.",
  VISIT_CHANGED: "Someone saved this part of the visit meanwhile. Their version is shown; what you typed is kept.",
  VISIT_LOAD_FAILED: "This visit couldn't be loaded.",

  // Prescriptions (plan §13, §8.2 rule 4; D213).
  PRESCRIPTION_NEEDS_REGISTRATION:
    "The doctor’s registration number isn’t on their details yet. Add it in Team, then write the prescription.",
  PRESCRIPTION_EMPTY: "This prescription has no medicines yet, so there’s nothing to print.",
  PRESCRIPTION_PDF_FAILED: "The prescription’s PDF couldn’t be made.",
  // The device's share sheet would not take it (D245): said by the client, never sent by the server.
  SHARE_FAILED: "It couldn’t be handed to WhatsApp. Try again, or download it and attach it in the chat.",
  // A doctor's prescription templates (plan §13; D240 – D243): a name is theirs once while in use.
  TEMPLATE_NAME_TAKEN: "You already have a template with this name. Choose another name.",
  TEMPLATES_LOAD_FAILED: "The templates couldn't be loaded.",
  TREATMENTS_LOAD_FAILED: "The treatments couldn't be loaded.",
  FOLLOW_UPS_LOAD_FAILED: "The follow-ups couldn't be loaded.",

  // Treatments (plan §14.1; D248 – D255).
  TREATMENT_CHANGED: "Someone changed this treatment meanwhile. Their version is shown; what you typed is kept.",
  TREATMENT_STATUS_NOT_ALLOWED: "This treatment can’t go to that status from where it is. Refresh and try again.",
  TREATMENT_CLOSED: "This treatment is completed or cancelled, so it can’t be worked on or handed to another doctor.",
  TREATMENT_SESSION_KEPT: "This visit is done, so its sessions stay. Correct the note instead.",

  // Bills (plan §15.2, §15.6; D29, D284, D289).
  BILL_PRICE_NOT_ALLOWED:
    "A price here isn’t the price list’s, or there’s a discount — that needs permission to give discounts. If the price list just changed, check the lines and issue it again.",
  SERVICE_INACTIVE: "A line’s service has been archived from the price list. Remove that line, or choose another.",
  VISIT_NOT_TO_BILL: "This visit isn’t waiting to be billed any more. Refresh to see where it stands.",
  BILL_START_LOAD_FAILED: "What to bill couldn't be loaded.",
  BILL_LOAD_FAILED: "This bill couldn't be loaded.",
  BILL_PDF_FAILED: "The bill’s PDF couldn’t be made.",
  TO_BILL_LOAD_FAILED: "What’s to bill couldn't be loaded.",
  BILLS_LOAD_FAILED: "The bills couldn't be loaded.",
  PAYMENTS_LOAD_FAILED: "The payments couldn't be loaded.",
  OUTSTANDING_LOAD_FAILED: "Who owes couldn't be loaded.",
  // Expenses (plan §16; D328 – D333).
  EXPENSES_LOAD_FAILED: "The expenses couldn't be loaded.",
  EXPENSE_TOTALS_LOAD_FAILED: "The month's totals couldn't be loaded.",
  EXPENSE_CATEGORY_ARCHIVED: "That category is archived. Choose another.",
  EXPENSE_ARCHIVED: "This expense is archived. Restore it to change it.",
  BALANCE_LOAD_FAILED: "The balance couldn't be loaded.",
  // Home (plan §17).
  DASHBOARD_LOAD_FAILED: "Today's figures couldn't be loaded.",
  // The owner's Plan screen (plan §7.5).
  PLAN_LOAD_FAILED: "Your plan couldn't be loaded.",
  // Reports (plan §18).
  REPORT_LOAD_FAILED: "This report couldn't be loaded.",
  COLLECTIONS_PDF_FAILED: "The day-end collections’ PDF couldn’t be made.",

  // Payments (plan §15.3; D297, D301).
  PAYMENT_REFUND_TOO_LARGE: "A refund can’t be more than the patient has paid in advance.",
  PAYMENT_HAS_REFUNDS:
    "Money was handed back from what this payment paid in. Void that refund first, then this payment.",

  // The browser could not reach the server (plan §21, D55): said by the client, never sent by the server.
  NETWORK_OFFLINE: "You're offline. Try again once the connection is back — what you typed is still here.",
  NETWORK_UNREACHABLE: "ClinicDesk couldn't be reached. Check the connection and try again.",

  CONFLICT: "Someone else changed this at the same moment. Refresh and try again.",
  NOT_FOUND: "We couldn't find that.",
  RECORD_NOT_FOUND: "That record could not be found. Refresh and try again.",
  EXTERNAL_SERVICE_ERROR: "A connected service didn't answer. Please try again.",
  CONFIG_INVALID: "The server's configuration is invalid.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
} as const;

export type ErrorMessageCode = keyof typeof ERROR_MESSAGES;

export function isErrorMessageCode(code: string | null | undefined): code is ErrorMessageCode {
  return code != null && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code);
}

/** The wording for a code; an unknown code reads as a failure of our own, never as its raw text. */
export function getErrorMessage(code: ErrorMessageCode | string): string {
  return isErrorMessageCode(code) ? ERROR_MESSAGES[code] : ERROR_MESSAGES.INTERNAL_ERROR;
}

/**
 * What a field says when it is wrong, beside the field (AGENTS.md §24). Every
 * schema takes its words from here and never falls back to Zod's own English;
 * tests/unit/lib/validation/index.test.ts fails if one does.
 */
export const VALIDATION_MESSAGES = {
  required: (label: string) => `${label} needs a value.`,
  wholeNumber: (label: string) => `${label} must be a whole number.`,
  notNegative: (label: string) => `${label} cannot be negative.`,
  amount: (label: string) => `${label} must be a valid amount.`,
  email: (label: string) => `${label} must look like name@example.com.`,
  tooLarge: (label: string, max: string) => `${label} can be at most ${max}.`,
  phone: "Enter a valid 10-digit mobile number.",
  phoneNumber: (label: string) => `${label} must be a phone number, like 0484 234 5678.`,
  signInIdentifier: "Enter your email or your 10-digit mobile number.",
  choose: (label: string) => `Choose ${label.toLowerCase()}.`,
  moreThanZero: (label: string) => `${label} must be more than 0.`,
  tooLong: (label: string, max: number) => `${label} can be at most ${max} characters.`,
  tooShort: (label: string, min: number) => `${label} must be at least ${min} characters.`,
  between: (label: string, min: number, max: number) => `${label} must be from ${min} to ${max}.`,
  number: (label: string) => `${label} must be a number.`,
  decimals: (label: string, places: number) =>
    `${label} can have at most ${places} decimal place${places === 1 ? "" : "s"}.`,
  bloodPressure: "Enter both readings, the upper one higher.",
  afterVisit: (label: string) => `${label} must be after the visit.`,
  day: (label: string) => `${label} must be a date.`,
  notBeforeToday: (label: string) => `${label} can’t be before today.`,
  afterToday: (label: string) => `${label} must be after today.`,
  notAfterToday: (label: string) => `${label} can’t be after today.`,
  atMostRangeDays: (max: number) => `Pick at most ${max} days.`,
  endsBeforeStart: (last: string, first: string) => `${last} can’t be before the ${first.toLowerCase()}.`,
  atMostDays: (max: number) => `It can last at most ${max} days.`,
  atMostMedicines: (max: number) => `A prescription holds at most ${max} medicines.`,
  atMostTemplateMedicines: (max: number) => `A template holds at most ${max} medicines.`,
  templateEmpty: "Add a medicine or advice to it first.",
  permissionsNeedOthers: "Some of these need others ticked too.",
  birthDate: `A date of birth can’t be in the future, or more than ${MAX_PATIENT_AGE} years ago.`,
  invalid: "That value is not valid.",
  gstin: "GSTIN must be 15 characters, like 32ABCDE1234F1Z5.",
  /** A bill (plan §15.2; D293, D308). */
  billEmpty: "Add a line to the bill first.",
  atMostBillLines: (max: number) => `A bill holds at most ${max} lines.`,
  discountTooLarge: "A discount can’t be more than the bill.",
  pickEntry: (treatment: string) => `Pick a price-list entry for ${treatment}, or remove the line.`,
} as const;

export const UI_TEXT = {
  /** A working name (plan D35): the final one replaces it here and nowhere else. */
  appName: "ClinicDesk",
  appDescription: "The front desk and consulting room of your clinic, on any device.",

  /** The verbs every screen shares (plan §32.2). */
  actions: {
    close: "Close",
    back: "Go back",
    retry: "Try again",
    showMore: "Show more",
    viewAll: "View all",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    archive: "Archive",
    restore: "Restore",
  },

  /** The response card (plan §32.2). */
  response: {
    reference: (requestId: string) => `Reference: ${requestId}`,
    closeNotice: (title: string) => `Close “${title}”`,
  },

  states: {
    loading: "Loading…",
    noMatches: (search: string) => `Nothing matches “${search}”`,
  },

  /** A form field's own words (plan §32.2). */
  fields: {
    optional: "(Optional)",
    phonePrefix: "+91",
    phonePlaceholder: "98765 43210",
    amountPlaceholder: "0.00",
    clearSearch: "Clear search",
  },

  /** The kit's calendar and time list (D65). Weeks start on Monday, as the clinic's do. */
  datePicker: {
    choose: "Choose a date",
    chooseTime: "Choose a time",
    chooseHour: "Hour",
    chooseMinute: "Min",
    minuteOf: (minute: string) => `:${minute}`,
    calendar: (field: string) => `${field}: pick a day`,
    previousMonth: "Previous month",
    nextMonth: "Next month",
    previousYear: "Previous year",
    nextYear: "Next year",
    earlierYears: "Earlier years",
    laterYears: "Later years",
    /** The heading that jumps to the months, then the years (D109): its words first, so it is named as it reads. */
    chooseMonth: (month: string) => `${month}, choose another month`,
    chooseYear: (year: string) => `${year}, choose another year`,
    months: (year: string) => `Months of ${year}`,
    years: (from: number, to: number) => `${from} – ${to}`,
    today: "Today",
    clear: "Clear",
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    weekdaysShort: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    weekdaysAbbr: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },

  /** The ＋ in the phone's bottom bar, the rail and the sidebar opens these (plan §31.1, D67, D69). */
  quickActions: {
    title: "Add",
    walkIn: "Walk-in",
    appointment: "Appointment",
    patient: "Patient",
    payment: "Payment",
    expense: "Expense",
  },

  /** The shell's places and menus (plan §31.1). */
  nav: {
    main: "Main",
    more: "More",
    account: (name: string) => `Account: ${name}`,
    myAccount: "My account",
    /** A place with how many wait there, read whole (D337): "Queue, 3 to bill". */
    counted: (place: string, waiting: string) => `${place}, ${waiting}`,
    /** Under a person's name: where they work, and as what. */
    membership: (clinic: string, role: string) => `${clinic} · ${role}`,
    /** Every place in the app, by its nav id. */
    places: {
      home: "Home",
      queue: "Queue",
      appointments: "Appointments",
      patients: "Patients",
      followUps: "Follow-ups",
      billing: "Billing",
      expenses: "Expenses",
      reports: "Reports",
      team: "Team",
      settings: "Settings",
    },
    /** What each place behind More holds, under its name. */
    hints: {
      appointments: "The calendar",
      followUps: "Who is due back",
      billing: "Bills, payments and dues",
      expenses: "What the clinic spends",
      reports: "Daily and monthly",
      team: "Doctors and staff",
      settings: "Clinic, price list and plan",
    },
  },

  /** Signing out, and the session gate (plan §5.4). */
  auth: {
    signOut: "Sign out",
    signOutTitle: "Sign out?",
    signOutBody: "You’ll need your email or mobile number and your password to sign in again.",
    staySignedIn: "Stay signed in",
    signingOut: "Signing out…",
    checkingSession: "Checking who is signed in…",

    // Signing in (plan §5.2).
    signIn: "Sign in",
    signingIn: "Signing in…",
    signInIntro: "With your email or your mobile number.",
    identifierLabel: "Email or mobile number",
    passwordLabel: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    forgotPassword: "Forgot password?",
    newHere: "New here?",
    setUpClinic: "Set up your clinic",
    signInFailed: "You’re not signed in",

    // Signing up (plan §5.1): you, then your clinic.
    registerTitle: "Set up your clinic",
    registerIntro: "Two short steps: you, then your clinic.",
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    stepYou: "You",
    stepClinic: "Your clinic",
    fullNameLabel: "Your name",
    emailLabel: "Email",
    phoneLabel: "Mobile number",
    phoneHint: "You can sign in with this or your email.",
    newPasswordHint: "At least 8 characters.",
    seesPatients: "I also see patients",
    seesPatientsHint: "You’ll be one of the clinic’s doctors too.",
    clinicNameLabel: "Clinic name",
    clinicTypeLabel: "Clinic type",
    clinicTypePlaceholder: "Choose a type",
    cityLabel: "City",
    addressLabel: "Address",
    clinicPhoneLabel: "Clinic phone",
    next: "Next",
    back: "Back",
    createClinic: "Create my clinic",
    creatingClinic: "Creating your clinic…",
    registerFailed: "Your clinic wasn’t set up",
    haveAccount: "Already have an account?",

    // Confirming the email (plan §5.1).
    checkEmailTitle: "Check your email",
    checkEmailSent: (email: string) => `We sent a link to ${email}. Open it to confirm your email and sign in.`,
    checkEmailIntro: "Open the link we emailed you to confirm your address and sign in.",
    noTrial:
      "This mobile number has had a free trial before, so your clinic starts view-only. Once you sign in, you’ll see how to renew its plan.",
    confirming: "Confirming your email…",
    resendLink: "Send the link again",
    linkSent: "Link sent",
    linkSentBody: "If that email is waiting to be confirmed, a new link is on its way.",
    linkNotSent: "The link wasn’t sent",
    linkExpiredTitle: "This link has expired",

    // A new password, by a link (plan §5.3).
    forgotTitle: "Forgot your password?",
    forgotIntro: "Enter the email you signed up with, and we’ll send you a link to choose a new password.",
    sendLink: "Send link",
    sendingLink: "Sending…",
    resetSentBody: "If there’s an account for that email, a link to choose a new password is on its way.",
    resetTitle: "Choose a new password",
    resetIntro: "You’ll be signed in once it is saved.",
    newPasswordLabel: "New password",
    savePassword: "Save and sign in",
    savingPassword: "Saving…",
    passwordNotSaved: "Your password wasn’t changed",
    askForNewLink: "Ask for a new link",
    backToSignIn: "Back to sign in",
  },

  /** The system screens (plan §31.2): a page that is not there, a screen that failed. */
  system: {
    notFoundTitle: "This page isn’t here",
    notFoundBody: "The link may be out of date, or the address mistyped.",
    errorTitle: "Something went wrong",
    errorBody: "This screen stopped before it finished loading. Anything you had already saved is safe.",
    toHome: "Go to Home",
    noAccessTitle: "This screen isn’t open to you",
    noAccessBody: "Your clinic’s owner can give you access to it.",
  },

  /** Home (plan §31.2); its numbers come with its own phase. */
  /** Home (plan §17; D345 – D353). */
  home: {
    /** By the clinic's clock: "Good morning, Dr. Rahul". */
    greeting: {
      morning: (name: string) => `Good morning, ${name}`,
      afternoon: (name: string) => `Good afternoon, ${name}`,
      evening: (name: string) => `Good evening, ${name}`,
    },
    /** A doctor greeted by their first name: "Dr. Rahul". */
    doctor: (firstName: string) => `Dr. ${firstName}`,
    /** How many appointments today holds, beside its date (D350): "Tuesday, 27 Oct 2026 · 14 appointments". */
    appointments: (count: number) => (count === 1 ? "1 appointment" : `${count} appointments`),
    waiting: "Waiting",
    seen: "Seen",
    money: "Money today",
    collected: "Collected today",
    outstanding: "Outstanding",
    queue: {
      title: "Today’s queue",
      open: "Open queue",
      empty: "No one is waiting.",
      /** One doctor's queue: "1 with the doctor · 2 waiting". */
      doctorLine: (withDoctor: number, waiting: number) =>
        [withDoctor > 0 && `${withDoctor} with the doctor`, `${waiting} waiting`].filter(Boolean).join(" · "),
      waitingFor: (doctor: string) => `Waiting for ${doctor}`,
    },
    toBill: {
      title: "To bill",
      open: "Open billing",
      openName: "Open billing’s To bill",
      empty: "Nothing waiting to be billed.",
    },
    followUps: {
      title: "Follow-ups due today",
      openName: "View all follow-ups",
      empty: "No follow-ups due today.",
      overdue: (count: number) => `${count} overdue`,
      lapsed: (count: number) => `${count} lapsed`,
    },
    upcoming: {
      title: "Tomorrow",
      open: "Open appointments",
      empty: "No appointments tomorrow.",
      at: "At",
    },
    owing: {
      title: "Owing most",
      open: "Open billing",
      openName: "Open billing’s Outstanding",
      empty: "No one owes anything.",
    },
    payments: {
      title: "Recent payments",
      open: "Open billing",
      openName: "Open billing’s Payments",
      empty: "No payments yet.",
    },
    expenses: { title: "Recent expenses", open: "Open expenses", empty: "No expenses yet." },
    /** A new clinic's first steps, until its first patient (D348, D352). */
    gettingStarted: {
      title: "Getting started",
      hint: (clinic: string) => `Three steps to set up ${clinic}.`,
      steps: {
        prices: { label: "Set your prices", hint: "Price list and doctors’ fees" },
        team: { label: "Add your team", hint: "Invite your doctors and front desk" },
        patient: { label: "Add your first patient", hint: "Then Home fills with your day" },
      },
      done: "Done",
    },
  },

  /** The Settings index (plan §31.2, D71): each row says what its screen holds. */
  settings: {
    you: "You",
    accountHint: "Name, mobile, password, theme",
    groups: {
      clinic: "Clinic setup",
      owner: "Plan and records",
    },
    items: {
      clinic: { label: "Clinic details", hint: "Address, logo and paper size" },
      priceList: { label: "Price list", hint: "Services and what they cost" },
      appointmentTypes: { label: "Appointment types", hint: "Kinds of visit and durations" },
      expenseCategories: { label: "Expense categories", hint: "How spending is grouped" },
      closures: { label: "Holidays and leave", hint: "Closed days and doctors’ leave" },
      plan: { label: "Plan", hint: "Your plan and its receipts" },
      activity: { label: "Activity", hint: "Who changed what, and when" },
      import: { label: "Import patients", hint: "From an Excel or CSV file" },
      export: { label: "Export", hint: "All records as CSV files" },
      deleteClinic: { label: "Delete clinic", hint: "Ask to delete the clinic" },
    },
  },

  /** No connection (plan §21, D55): the band at the top while it is gone. */
  offline: {
    banner: "You’re offline. What you type stays here until it can be saved.",
  },

  /**
   * The plan banner and read-only mode (plan §7.2, D73): the owner is told
   * how to renew; everyone else, quietly, what is happening to the clinic.
   */
  plan: {
    banner: "Your plan",
    endsOn: (date: string) => `Your plan ends on ${date}.`,
    clinicEndsOn: (date: string) => `The clinic’s plan ends on ${date}.`,
    endedOn: (ended: string, viewOnly: string) =>
      `Your plan ended on ${ended}. The clinic becomes view-only on ${viewOnly}.`,
    clinicEndedOn: (ended: string, viewOnly: string) =>
      `The clinic’s plan ended on ${ended}. It becomes view-only on ${viewOnly}.`,
    readOnly: "Your clinic is view-only. Renew its plan to make changes.",
    clinicReadOnly: "The clinic is view-only until its owner renews its plan.",
    howToRenew: "How to renew",
    /** Beside every control read-only mode turns off (plan §32.2). */
    readOnlyReason: "Your clinic is view-only until its plan is renewed.",

    // The owner's Plan screen (plan §7.5; D363 – D366): the last day on the land, its state under it.
    named: (plan: string) => `${plan} plan`,
    validUntil: "Valid until",
    activeUntil: "Valid until · Active",
    endsToday: "Ends today",
    endsTomorrow: "Ends tomorrow",
    endsIn: (days: number) => `Ends in ${days} days`,
    endedViewOnlyFrom: (date: string) => `Ended · view-only from ${date}`,
    viewOnly: "View-only",
    renewIntro:
      "Pay for a month or a year, then let us know. Your plan runs on from its last day, so renewing early loses no days.",
    contactName: "Name",
    contactPhone: "Mobile",
    contactEmail: "Email",
    upiId: "UPI id",
    call: "Call",
    callTo: (name: string) => `Call ${name}`,
    whatsApp: "WhatsApp",
    whatsAppTo: (name: string) => `WhatsApp ${name}`,
    email: "Email",
    emailTo: (name: string) => `Email ${name}`,
    copy: "Copy",
    copyUpi: "Copy the UPI id",
    upiCopied: "UPI id copied",
    upiCopiedBody: "Paste it in your UPI app to pay.",
    upiNotCopied: "The UPI id wasn’t copied",
    upiNotCopiedBody: "Select it and copy it yourself.",
    /** What WhatsApp and the email open with (D365): the owner may change it before sending. */
    renewalMessage: (clinic: string) => `Hello, I’d like to renew the plan for ${clinic}.`,
    renewalSubject: (clinic: string) => `Renewing the plan for ${clinic}`,
    history: "History",
    noHistory: "Nothing recorded yet.",
    /** A history row (D366): "Until 12 Nov 2026", then "Monthly · Paid 12 Oct 2026 · UPI"; a date set by hand, "Date changed". */
    until: (date: string) => `Until ${date}`,
    dateChanged: "Date changed",
    paidOn: (date: string) => `Paid ${date}`,
    noCharge: "No charge",
  },

  /** My account (plan §5.4, D72): each detail changed in a sheet of its own. */
  account: {
    details: "Your details",
    nameLabel: "Name",
    phoneLabel: "Mobile number",
    emailLabel: "Email",
    noPhone: "Not added yet",
    password: "Password",
    changePassword: "Change password",
    changePasswordHint: "Also signs out other devices",
    changeName: "Change your name",
    changePhone: "Change your mobile number",
    currentPasswordLabel: "Current password",
    nameSaved: "Name saved",
    phoneSaved: "Mobile number saved",
    phoneSavedBody: (phone: string) => `You can now sign in with ${phone}.`,
    detailsNotSaved: "Your details weren’t changed",
    phoneTaken: "Another account uses this mobile number.",
    passwordChanged: "Password changed",
    passwordChangedBody: "You’re still signed in here, and signed out on your other devices.",
    passwordNotChanged: "Your password wasn’t changed",
  },

  /**
   * Clinic details (plan §9, D78, D79): the logo at the top, the details as
   * rows opening one sheet, paper size and fee timing saved as they are picked.
   */
  clinic: {
    logo: "Logo",
    logoHint: "PNG, JPG or WebP, up to 500 KB. It heads your bills and prescriptions.",
    noLogo: "No logo yet",
    logoAlt: (clinic: string) => `${clinic} logo`,
    addLogo: "Add logo",
    changeLogo: "Change logo",
    removeLogo: "Remove logo",
    removeLogoTitle: "Remove the logo?",
    removeLogoBody: "Bills and prescriptions will show the clinic’s name only.",
    logoSaved: "Logo saved",
    logoRemoved: "Logo removed",
    logoNotSaved: "The logo wasn’t changed",
    details: "Details",
    changeDetails: "Change clinic details",
    nameLabel: "Clinic name",
    typeLabel: "Clinic type",
    addressLabel: "Address",
    cityLabel: "City",
    phoneLabel: "Clinic phone",
    emailLabel: "Clinic email",
    gstinLabel: "GSTIN",
    contact: "Phone and email",
    noContact: "No phone or email added",
    noGstin: "No GSTIN added",
    timezone: "Time zone",
    timezoneValue: "India (IST)",
    detailsSaved: "Clinic details saved",
    detailsNotSaved: "The clinic details weren’t changed",
    documents: "Bills and prescriptions",
    paperSize: "Paper size",
    paperSizeHint: "What bills and prescriptions print on.",
    paperSizeSaved: (size: string) => `Bills and prescriptions now print on ${size}`,
    feeTiming: "Consultation fee",
    feeTimingHint: "When reception collects the doctor’s fee.",
    feeTimingSaved: (timing: string) => `The consultation fee is now collected ${timing.toLowerCase()}`,
    choiceNotSaved: "That wasn’t changed",
  },

  /**
   * What the price list, appointment types and expense categories share (plan
   * §9, D80 – D83): archived, never deleted, and brought back from Archived.
   */
  catalogues: {
    archived: "Archived",
    showArchived: (count: number) => `Show archived (${count})`,
    hideArchived: "Hide archived",
    restoreNamed: (name: string) => `Restore ${name}`,
    archivedNote: (name: string) => `${name} archived`,
    restoredNote: (name: string) => `${name} restored`,
    savedNote: (name: string) => `${name} saved`,
    notChanged: "That wasn’t changed",
  },

  /** The price list (plan §9, D82): grouped by category, found by name. */
  priceList: {
    count: (count: number) => (count === 1 ? "1 service" : `${count} services`),
    search: "Search services",
    add: "Add service",
    addTitle: "Add a service",
    editTitle: "Change service",
    nameLabel: "Service name",
    categoryLabel: "Category",
    categoryPlaceholder: "Choose a category",
    priceLabel: "Price",
    priceHint: "What a bill charges for one.",
    added: (name: string) => `${name} added to the price list`,
    notSaved: "The service wasn’t saved",
    archiveTitle: (name: string) => `Archive ${name}?`,
    archiveBody: "New bills won’t offer it. Bills that already have it keep it. You can restore it from Archived.",
  },

  /** Appointment types (plan §9, D32, D81): the kinds of visit, each with its usual length. */
  appointmentTypes: {
    count: (count: number) => (count === 1 ? "1 kind of visit" : `${count} kinds of visit`),
    add: "Add appointment type",
    addTitle: "Add an appointment type",
    editTitle: "Change appointment type",
    nameLabel: "Name",
    minutesLabel: "Length in minutes",
    minutesHint: "How long it usually takes, 5 to 480. A booking can change it.",
    minutes: (count: number) => `${count} min`,
    added: (name: string) => `${name} added`,
    notSaved: "The appointment type wasn’t saved",
    archiveTitle: (name: string) => `Archive ${name}?`,
    archiveBody: "New bookings won’t offer it. Appointments that have it keep it. You can restore it from Archived.",
    order: "New types join the end of the list.",
  },

  /** Expense categories (plan §9, §16, D40): how the clinic's spending is grouped. */
  expenseCategories: {
    count: (count: number) => (count === 1 ? "1 category" : `${count} categories`),
    add: "Add category",
    addTitle: "Add an expense category",
    editTitle: "Rename category",
    nameLabel: "Name",
    added: (name: string) => `${name} added`,
    notSaved: "The category wasn’t saved",
    archiveTitle: (name: string) => `Archive ${name}?`,
    archiveBody: "New expenses won’t offer it. Expenses filed under it keep it. You can restore it from Archived.",
    order: "New categories join the end of the list.",
  },

  /** Booking (plan §11.1; D144 – D151): the booking sheet, and the screen it opens on. */
  appointments: {
    book: "Book appointment",
    bookTitle: "Book an appointment",
    patientLabel: "Patient",
    searchPatients: "Search by name, mobile or number",
    searchHint: "Type a name, a mobile number or a P-number.",
    noMatches: "No patient found. Add them as a new patient.",
    newPatient: "New patient",
    findPatient: "Find a patient instead",
    change: "Change",
    changeNamed: (name: string) => `Change ${name}`,
    doctorLabel: "Doctor",
    chooseDoctor: "Choose a doctor",
    dateLabel: "Date",
    timeLabel: "Time",
    hourLabel: "Hour",
    minuteLabel: "Minutes",
    timePassed: "That time has already passed. Choose a later time, or add a walk-in.",
    typeLabel: "Type",
    chooseType: "Choose a type",
    lengthLabel: "Length",
    otherLength: "Other",
    minutesLabel: "Minutes",
    minutes: (count: number) => `${count} min`,
    notesLabel: "Notes",
    notesHint: "Not clinical: first visit, bring the X-ray.",
    /** The doctor's taken times on the day being booked (D147): times only, never patients. */
    doctorDayLead: (doctor: string) => `${doctor} that day:`,
    doctorDayFree: (doctor: string) => `Nothing booked for ${doctor} that day yet.`,
    timeRange: (from: string, to: string) => `${from} – ${to}`,
    booked: (patient: string, when: string, doctor: string) => `Booked ${patient} · ${when} with ${doctor}`,
    bookedWhen: (day: string, time: string) => `${day}, ${time}`,
    notBooked: "That wasn’t booked",
    /** Why it wasn't (D148): the time it clashed with, the closure it fell on. */
    slotTaken: (doctor: string, range: string) => `${doctor} is booked ${range}`,
    clinicClosed: (reason: string) => `The clinic is closed that day: ${reason}`,
    doctorAway: (doctor: string, reason: string) => `${doctor} is away that day: ${reason}`,
  },

  /** The calendar (plan §11.5; D152 – D159). */
  calendar: {
    view: "Show",
    views: { DAY: "Day", WEEK: "Week" },
    doctor: "Doctor",
    allDoctors: "All doctors",
    today: "Today",
    chooseDay: "Choose a day",
    day: "Day",
    previousDay: "Previous day",
    nextDay: "Next day",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    dayGrid: (day: string) => `Appointments, ${day}`,
    weekGrid: (doctor: string, range: string) => `${doctor}’s appointments, ${range}`,
    weekDay: (weekday: string, day: string) => `${weekday} ${day}`,
    nothingBooked: "Nothing booked",
    nothingBookedHint: "Nothing is booked for this day yet.",
    clinicClosed: (reason: string) => `Clinic closed: ${reason}`,
    doctorAway: (doctor: string, reason: string) => `${doctor} away: ${reason}`,
    away: (reason: string) => `Away: ${reason}`,
    walkIn: "Walk-in",
    token: (token: number) => `#${token}`,
    cancelled: (count: number) => `Cancelled and no-shows (${count})`,
    hideCancelled: "Hide cancelled and no-shows",
    /** One appointment, said whole to a screen reader: the grid draws it in a line or two. */
    said: (time: string, patient: string, kind: string, status: string) => `${time}, ${patient}, ${kind}, ${status}`,
  },

  /** Today's queue (plan §11.4; D168 – D175): who is waiting, with the doctor, still to come and done. */
  queue: {
    doctors: "Whose queue",
    allDoctors: "All doctors",
    waiting: "Waiting",
    withDoctor: "With doctor",
    stillToCome: "Still to come",
    done: "Done",
    doneCount: (count: number) => `Done (${count})`,
    hideDone: "Hide done",
    token: "Token",
    booked: "Booked",
    /** How long a patient has waited, or been with the doctor. */
    minutes: (count: number) => (count < 1 ? "Just now" : `${count} min`),
    late: (minutes: number) => `Late ${minutes} min`,
    withDoctorLine: (doctor: string, minutes: string) => `With ${doctor} · ${minutes}`,
    doneAt: (time: string) => `Done ${time}`,
    roomFree: "The room is free",
    roomFreeHint: "A patient sent in shows here.",
    noneWaiting: "No one is waiting",
    noneWithDoctor: "No one is with the doctor",
    noneToCome: "No one else is booked today",
    noneDone: "No one is done yet",
    /** The queue's To bill (D318): those done, from any day, waiting to be billed. */
    toBill: "To bill",
    noneToBill: "No one is waiting to be billed",
    arrived: "Arrived",
    markArrived: (patient: string) => `Mark ${patient} arrived`,
    /** What the card says as a patient joins the queue (D173): the number to tell them. */
    tokenGiven: (patient: string, token: number, doctor: string) => `${patient} is #${token} with ${doctor}`,
    notArrived: "That wasn’t marked arrived",
    addWalkIn: "Add walk-in",
    walkInTitle: "Add a walk-in",
    notAdded: "The walk-in wasn’t added",
    // The queue's moves (plan §11.4; D192 – D198).
    sendIn: "Send in",
    sendInOf: (patient: string) => `Send ${patient} in`,
    doneOf: (patient: string) => `Mark ${patient} done`,
    nextPatient: "Next patient",
    nextPatientAfter: (patient: string) => `Next patient after ${patient}`,
    nextPatientFor: (doctor: string) => `Send in ${doctor}'s next patient`,
    backToWaiting: "Back to waiting",
    stepOut: "Stepped out",
    stepBack: "Back",
    stepBackOf: (patient: string) => `Mark ${patient} back`,
    /** On a waiting row (D198): away for a moment, skipped by Next patient. */
    steppedOut: "Stepped out",
    /** The card when the doctor already has someone in (D192). */
    roomBusy: (patients: string, many: boolean, doctor: string) =>
      `${patients} ${many ? "are" : "is"} still with ${doctor}`,
    roomTaken: (doctor: string) => `Someone is still with ${doctor}`,
    roomBusyBody: (patient: string) => `Mark them done and send ${patient} in — or keep both in, for a second chair.`,
    finishAndSendIn: "Mark done and send in",
    keepBothIn: "Keep both in",
    sentIn: (patient: string, doctor: string) => `${patient} is in with ${doctor}`,
    markedDone: (patient: string) => `${patient} is done`,
    noOneWaiting: "No one is waiting",
    noOneWaitingBody: "The visit is closed. Send in the next patient when they arrive.",
    waitingAgain: (patient: string) => `${patient} is waiting again`,
    steppedOutCard: (patient: string) => `${patient} stepped out`,
    steppedOutBody: "They keep their token and place. Next patient skips them until they’re back.",
    backCard: (patient: string) => `${patient} is back`,
    /** A tag on a patient (D201), from waiting through their visit; Next patient still goes by token. */
    urgent: "Urgent",
    urgentOf: (patient: string) => `Mark ${patient} urgent`,
    notUrgent: "Not urgent",
    notUrgentOf: (patient: string) => `Mark ${patient} not urgent`,
    urgentCard: (patient: string) => `${patient} is marked urgent`,
    urgentBody:
      "Everyone sees the tag, the doctor too. Next patient still goes by token, so send them in when the room is free.",
    notUrgentCard: (patient: string) => `${patient} is no longer urgent`,
    notSentIn: "They weren’t sent in",
    notDone: "That wasn’t marked done",
    notMoved: "The queue didn’t move",
    openVisit: "Open visit",
    openVisitOf: (patient: string) => `Open ${patient}'s visit`,
  },

  /** A visit's screen (plan §12.2; D195): whose it is, where it stands, and the queue's controls. */
  visit: {
    title: "Visit",
    withDoctor: (doctor: string) => `With ${doctor}`,
    /** The lake's title on a visit in progress: since when the patient has been in. */
    since: (time: string) => `In since ${time}`,
    statusLabel: "Status",
    dayLabel: "Day",
    tokenLabel: "Token",
    startedLabel: "Went in",
    doneLabel: "Done",
    billingLabel: "Billing",
    /** Its sections (plan §12.2; D202): each optional, each saving alone. */
    sections: "The visit’s records",
    vitalsTitle: "Vitals",
    notesTitle: "Complaint, diagnosis and notes",
    followUpTitle: "Follow-up",
    saveVitals: "Save vitals",
    saveNotes: "Save notes",
    saveFollowUp: "Save follow-up",
    vitalsSaved: "Vitals saved",
    notesSaved: "Notes saved",
    followUpSaved: (day: string) => `Review on ${day}`,
    followUpRemoved: "Follow-up removed",
    notSaved: "That wasn’t saved",
    complaintLabel: "Complaint",
    diagnosisLabel: "Diagnosis",
    notesLabel: "Notes",
    nothingRecorded: "Nothing recorded",
    /** Someone else saved the section meanwhile (D206): theirs, beside what is being typed. */
    changedMeanwhile: "Someone saved this meanwhile",
    changedMeanwhileHint: "Theirs is below. Save to keep yours instead, or use theirs.",
    useTheirs: "Use theirs",
    /** Follow-up (D205). */
    followUpLabel: "Review on",
    followUpHint: "A day after the visit.",
    followUpChoices: { "3_DAYS": "3 days", "1_WEEK": "1 week", "2_WEEKS": "2 weeks", "1_MONTH": "1 month" },
    followUpChoicesLabel: "Review in",
    noFollowUp: "No follow-up",
    removeFollowUp: "Remove",
    bookNext: "Book next appointment",
    /** New visit, from a profile (D204), and its Done. */
    newVisit: "New visit",
    startVisit: "Start visit",
    started: (patient: string) => `${patient}’s visit started`,
    openedAgain: (patient: string, doctor: string) => `${patient} is already in with ${doctor}`,
    notStarted: "The visit wasn’t started",
    finished: (patient: string) => `${patient}’s visit is done`,
    notFinished: "That wasn’t marked done",
    /** Vitals of a patient still waiting (D203), from their appointment. */
    takeVitals: "Vitals",
    takeVitalsOf: (patient: string) => `Take ${patient}’s vitals`,
    vitalsFor: (patient: string) => `Vitals for ${patient}`,
    vitalsSavedFor: (patient: string) => `Vitals saved for ${patient}`,
  },

  /** A visit's prescription (plan §13; D210 – D217). */
  prescription: {
    title: "Prescription",
    save: "Save prescription",
    saved: "Prescription saved",
    none: "No prescription yet",
    /** Each medicine's block, in order (D210). */
    medicineN: (n: number) => `Medicine ${n}`,
    medicineLabel: "Medicine",
    strengthLabel: "Strength",
    doseLabel: "Dose",
    frequencyLabel: "Frequency",
    /** The chip that opens a frequency to type (D214), and its field. */
    otherFrequency: "Other",
    otherFrequencyLabel: "Frequency, in words",
    timingLabel: "Timing",
    daysLabel: "Days",
    instructionsLabel: "Instructions",
    adviceLabel: "Advice",
    printDiagnosis: "Print the diagnosis",
    printDiagnosisHint: "On the printed prescription. Off until ticked.",
    printsDiagnosis: "The diagnosis prints on it",
    addMedicine: "Add medicine",
    moveUp: (n: number) => `Move medicine ${n} up`,
    moveDown: (n: number) => `Move medicine ${n} down`,
    remove: (n: number) => `Remove medicine ${n}`,
    /** The suggestions under a medicine (D211): this clinic's, as last written. */
    suggestions: "Medicines written before",
    days: (n: number) => `${n} day${n === 1 ? "" : "s"}`,
    /** Allergies, above the prescription and on a line that matches one (plan §10.4, D212). */
    allergiesLabel: "Allergies",
    noAllergies: "No allergies recorded",
    allergy: (labels: string) => `Allergy: ${labels}`,
    allergyConfirmTitle: "Save it with an allergy?",
    allergyLine: (medicine: string, labels: string) => `${medicine} matches the allergy to ${labels}`,
    allergyConfirmBody: (lines: string) => `${lines}. Check it before saving.`,
    saveAnyway: "Save anyway",
    /** Who typed it for the doctor (D45). */
    typedBy: (name: string) => `Typed by ${name}`,
    /** The doctor has no registration number yet (D213). */
    needsRegistration: (doctor: string) =>
      `${doctor} has no registration number yet, so a prescription can’t be written in their name.`,
    needsRegistrationHint: "It’s added in Team, with the doctor’s details.",
    openTeam: "Open Team",
    /** Its PDF (D221, D222): opened to look at and print, or saved. */
    print: "Print",
    printOf: (patient: string) => `Print ${patient}’s prescription`,
    download: "Download",
    downloadOf: (patient: string) => `Download ${patient}’s prescription`,
    downloaded: "Prescription downloaded",
    savedAs: (name: string) => `Saved as “${name}”.`,
    notDownloaded: "The prescription wasn’t downloaded",
    /** Sending it on WhatsApp (D244 – D246). */
    whatsApp: "WhatsApp",
    whatsAppOf: (patient: string) => `Send ${patient}’s prescription on WhatsApp`,
    shared: "Prescription shared",
    attachTitle: "Attach it in WhatsApp",
    attachBody: (name: string) =>
      `WhatsApp opened in a new tab with the message, and “${name}” was downloaded. Attach it in the chat.`,
    readyTitle: "The prescription is ready",
    readyBody: "Tap Send, then choose WhatsApp.",
    send: "Send",
    notSent: "The prescription wasn’t sent",
    /** Repeat (D236): the patient's latest prescription before this visit, by its day and doctor. */
    repeat: (day: string, doctor: string) => `Repeat ${day} · ${doctor}`,
    repeatedFrom: (day: string, doctor: string) => `${day} · ${doctor}`,
    /** Nothing is added past the most a prescription holds (D237). */
    /** What Repeat or a template added, closing itself (D237): "Added from “Viral fever”". */
    added: (from: string) => `Added from ${from}`,
    tooManyTitle: "Too many medicines",
    tooManyBody: (max: number, adding: number) =>
      `A prescription holds at most ${max} medicines, and this adds ${adding}. Remove some first.`,
    /** The doctor's templates, picked from a sheet (D241). */
    templates: "Templates",
    templatesOf: (doctor: string) => `${doctor}’s templates`,
    noTemplates: "No templates yet",
    noTemplatesHint: "Save a prescription as a template, or start one in My account.",
    noTemplatesFor: (doctor: string) => `${doctor} hasn’t saved any yet.`,
    /** A template's medicines under its name: "Paracetamol, Amoxicillin +1". */
    templateMedicines: (names: string[], more: number) => `${names.join(", ")}${more > 0 ? ` +${more}` : ""}`,
    quoted: (name: string) => `“${name}”`,
    adviceOnly: "Advice only",
    /** Saving what is typed as a template, the doctor's alone (D240, D243). */
    saveAsTemplate: "Save as template",
    templateNameLabel: "Template name",
    templateNameHint: "Like “Viral fever” or “Post-extraction”. It saves the medicines and advice on the screen.",
    templateSaved: (name: string) => `Saved as the template “${name}”`,
    templateNotSaved: "The template wasn’t saved",
    replaceTitle: (name: string) => `Replace your template “${name}”?`,
    replaceBody: "Its medicines and advice become these.",
    replace: "Replace",
  },

  /** A doctor's prescription templates in My account (plan §13, D242). */
  templates: {
    title: "Prescription templates",
    hint: "Saved prescriptions, added in a tap",
    section: "Prescriptions",
    count: (count: number) => (count === 1 ? "1 template" : `${count} templates`),
    add: "New template",
    newTitle: "New template",
    emptyTitle: "No templates yet",
    emptyHint: "Start one here, or save a prescription as a template on a visit.",
    archived: "Archived",
    archiveTitle: (name: string) => `Archive “${name}”?`,
    archiveBody: "It’s no longer offered on prescriptions. Show archived brings it back.",
    notChanged: "The template wasn’t changed",
  },

  /** Treatments (plan §14.1; D248 – D263): on a visit and on a patient's profile. */
  treatments: {
    title: "Treatments",
    add: "Add treatment",
    addFor: (patient: string) => `Add a treatment for ${patient}`,
    none: "No open treatments",
    noneHint: "A course of care across visits — a root canal over three sittings.",
    showClosed: (count: number) => `Show closed (${count})`,
    hideClosed: "Hide closed",
    closed: "Closed",
    /** A row (D256, D260). */
    dueToday: "Due today",
    dueIn: (days: number) => (days === 1 ? "Due tomorrow" : `Due in ${days} days`),
    overdueBy: (days: number) => (days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`),
    estimate: (amount: string) => `Est. ${amount}`,
    thisVisit: (note: string | null) => (note ? `This visit: ${note}` : "Worked on this visit"),
    startedThisVisit: "Started this visit",
    completedOn: (day: string) => `Completed ${day}`,
    cancelledOn: (day: string) => `Cancelled ${day}`,
    /** In a visit's history row (D262): those worked on or started in it. */
    worked: (names: string[], more: number) => `Tx ${names.join(", ")}${more > 0 ? ` +${more}` : ""}`,
    /** Its sheet (D261). */
    doctorLabel: "Doctor",
    descriptionLabel: "Description",
    estimateLabel: "Estimated cost",
    startedLabel: "Started",
    completedLabel: "Completed",
    cancelledLabel: "Cancelled",
    reasonLabel: "Reason",
    reasonHint: "For example, “Patient declined” or “Moved away”.",
    sessions: "Sessions",
    noSessions: "No sessions yet",
    sessionOn: (day: string, doctor: string) => `${day} · ${doctor}`,
    noNote: "No note",
    actions: "What can be done",
    /** What this visit did for it (D256, D257). */
    thisVisitTitle: "This visit",
    noteLabel: "What was done",
    completes: "This completes it",
    completesHint: "The session is saved and the treatment marked completed, together.",
    saveSession: "Save session",
    sessionSaved: (name: string) => `${name}: session saved`,
    sessionCompleted: (name: string) => `${name} completed`,
    notSaved: "That wasn’t saved",
    removeSession: "Remove from this visit",
    removeTitle: (name: string) => `Remove ${name} from this visit?`,
    removeBody: "What was written for it in this visit goes. The treatment stays where it is.",
    removed: (name: string) => `${name} removed from this visit`,
    notRemoved: "That wasn’t removed",
    /** Its status (D250). */
    start: "Start",
    resume: "Resume",
    hold: "Put on hold",
    complete: "Complete",
    cancel: "Cancel treatment",
    keep: "Keep it",
    completeTitle: (name: string) => `Complete ${name}?`,
    completeBody: "It leaves the open treatments and is due no more.",
    cancelTitle: (name: string) => `Cancel ${name}?`,
    cancelBody: (reason: string | null) =>
      reason ? `It closes for good, with the reason “${reason}”.` : "It closes for good.",
    moved: {
      IN_PROGRESS: (name: string) => `${name} in progress`,
      ON_HOLD: (name: string) => `${name} on hold`,
      COMPLETED: (name: string) => `${name} completed`,
      CANCELLED: (name: string) => `${name} cancelled`,
    },
    notChanged: "That treatment wasn’t changed",
    /** Its next sitting (D259). */
    nextDueTitle: "Next sitting",
    nextDueLabel: "Next due",
    nextDueHint: "Today or later.",
    nextDueChoicesLabel: "Due in",
    saveNextDue: "Save next sitting",
    nextDueSaved: (name: string, day: string) => `${name}: next due ${day}`,
    nextDueRemoved: (name: string) => `${name}: no next sitting`,
    noNextDue: "No next sitting set",
    /** New, and edited (D252, D258). */
    newTitle: "New treatment",
    editTitle: "Edit treatment",
    edit: "Edit",
    editOf: (name: string) => `Edit ${name}`,
    nameLabel: "Treatment",
    nameHint: "A procedure from the price list, or typed.",
    procedures: "Procedures on the price list",
    startLabel: "When",
    startChoices: { IN_PROGRESS: "Start today", PLANNED: "Plan it" },
    firstNoteLabel: "What was done today",
    created: (name: string) => `${name} added`,
    saved: (name: string) => `${name} saved`,
    notCreated: "That treatment wasn’t added",
  },

  /** The follow-ups to call (plan §14.3; D267 – D278). */
  followUps: {
    yours: "Your patients",
    tabsLabel: "Follow-ups by when they’re due",
    /** Each tab with nothing in it. */
    empty: {
      TODAY: "No one is due back today",
      OVERDUE: "Nothing overdue",
      UPCOMING: `No one is due in the next ${FOLLOW_UP_WINDOW_DAYS} days`,
      LAPSED: "No lapsed follow-ups",
      COMPLETED: `No treatments completed in the last ${FOLLOW_UP_WINDOW_DAYS} days`,
    },
    emptyHint: "A visit’s follow-up day and a treatment’s next sitting show here when they come due.",
    emptyHintLapsed: "Patients overdue for longer than the clinic waits show here, to call back.",
    emptyHintCompleted: "A treatment shows here for a month after it’s completed.",
    /** A row. */
    visitFollowUp: "Follow-up",
    about: (what: string, doctor: string) => `${what} · ${doctor}`,
    lastContact: (outcome: string, day: string) => `${outcome}, ${day}`,
    /** Its sheet. */
    forLabel: "For",
    dueLabel: "Due",
    lastContactLabel: "Last contact",
    lastContactBy: (outcome: string, day: string, by: string | null) =>
      by ? `${outcome} · ${day}, by ${by}` : `${outcome} · ${day}`,
    notContacted: "Not contacted yet",
    actions: "Reach them",
    book: "Book",
    bookFor: (name: string) => `Book an appointment for ${name}`,
    /** Mark contacted (D271, D274). */
    markTitle: "Mark contacted",
    outcomeLabel: "How it went",
    noteLabel: "Note",
    noteHint: "For example, “Will call back after Diwali”.",
    remindMeLabel: "Remind me on",
    remindMeHint: "Until then it stays off the lists and their counts.",
    remindMeChoicesLabel: "Remind me in",
    remindMeChoices: { TOMORROW: "Tomorrow", "3_DAYS": "3 days", "1_WEEK": "1 week", "2_WEEKS": "2 weeks" },
    save: "Save contact",
    noted: (name: string, outcome: string) => `Noted for ${name}: ${outcome}`,
    notedUntil: (name: string, outcome: string, day: string) =>
      `Noted for ${name}: ${outcome}. Back on the list on ${day}.`,
    notNoted: "That contact wasn’t noted",
    reminderNotNoted: "The reminder wasn’t noted",
  },

  /** A new bill (plan §15.2; D302 – D313) and the fee at arrival (plan §11.3; D283, D305, D306). */
  billing: {
    newBill: "New bill",
    /** What the bill is for, under the patient's name. */
    forVisit: (day: string, doctor: string) => `Visit ${day} · ${doctor}`,
    forArrival: (token: number | null, doctor: string) =>
      token === null ? `Arrival with ${doctor}` : `Arrival · #${token} with ${doctor}`,
    noDoctor: "No doctor",
    /** A patient's bill names its doctor (D326, D342). */
    doctorLabel: "Doctor",
    billThatVisit: "Bill that visit",
    archived: (patient: string) => `${patient} is archived, so nothing can be billed. Restore them first.`,
    /** Its lines (D303, D308, D309). */
    linesTitle: "Lines",
    noLines: "No lines yet. Add one from the price list.",
    addLine: "Add line",
    removeLine: (name: string) => `Remove ${name}`,
    quantityLabel: "Quantity",
    quantityOf: (name: string) => `Quantity of ${name}`,
    priceLabel: "Price",
    priceOf: (name: string) => `Price of ${name}`,
    /** What a line, and the bill, may come to at most. */
    lineLabel: "A line",
    billLabel: "The bill",
    forTreatment: (treatment: string) => `For ${treatment}`,
    pickReminder: (treatment: string) => `${treatment}: pick its price-list entry`,
    pickEntry: "Pick entry",
    pickEntryFor: (treatment: string) => `Pick a price-list entry for ${treatment}`,
    /** The sheet lines are added from (D303). */
    addLineTitle: "Add a line",
    pickTitle: (treatment: string) => `Entry for ${treatment}`,
    searchPriceList: "Search the price list",
    noMatches: "Nothing in the price list matches.",
    emptyPriceList: "The price list is empty. Add entries in Settings.",
    typedTitle: "Or type a line",
    descriptionLabel: "Description",
    addTyped: "Add typed line",
    /** The discount, with permission to give one (D29, D290 – D293). */
    discountTitle: "Discount",
    discountKindLabel: "Discount as",
    discountKinds: { NONE: "None", AMOUNT: "Amount", PERCENT: "Percent" },
    discountAmountLabel: "Discount",
    discountPercentLabel: "Discount (%)",
    notesLabel: "Notes",
    /** The totals (plan §15.2). */
    totalsTitle: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    balanceNow: "Balance now",
    balanceAfter: "Balance after",
    due: (amount: string) => `${amount} due`,
    advance: (amount: string) => `${amount} advance`,
    settled: "Nothing due",
    /** Collect now (D304). */
    collectNow: "Collect now",
    amountLabel: "Amount",
    methodLabel: "Method",
    referenceLabel: "Reference",
    referenceHint: "A UPI ref or cheque number, if any.",
    issue: "Issue bill",
    /** The card after it is issued (D302). */
    issued: (number: string) => `Bill ${number} issued`,
    collected: (amount: string) => `${amount} collected`,
    notIssued: "The bill wasn’t issued",
    /** The fee at arrival (D283, D305, D306). */
    collectFee: "Collect fee",
    collectFeeOf: (patient: string) => `Collect ${patient}’s fee`,
    feeLabel: "Consultation fee",
    issueAndCollect: "Issue and collect",
    skip: "Skip",
    noConsultation: "The price list has no Consultation to bill. Add one in Settings, or bill at checkout.",
    feeAlreadyPaid: (patient: string) => `${patient}’s fee is already paid.`,
    feePaid: "Fee paid",
    /** On a visit (D307) and a profile (D311). */
    billNow: "Bill now",
    billNowOf: (patient: string) => `Bill ${patient}’s visit`,
    newBillOf: (patient: string) => `New bill for ${patient}`,
    /** The issued card's ways on (D317). */
    viewBill: "View bill",
    /** Billing (plan §15.4; D318 – D325, D334 – D336). */
    tabsLabel: "Billing views",
    recordPayment: "Record payment",
    /** To bill (plan §15.6; D318, D319). */
    /** How many visits wait in To bill (D337): the queue's pin and the Queue item's count. */
    toBillCount: (count: number) => `${count} to bill`,
    toBillEmpty: "Nothing to bill",
    toBillEmptyHint: "Finished visits wait here until they’re billed or marked No charge.",
    consultation: "Consultation",
    token: (token: number) => `#${token}`,
    workedLabel: "What was done",
    visitOf: (patient: string) => `${patient}’s visit`,
    bill: "Bill",
    checkOut: (patient: string) => `Check out ${patient}’s visit`,
    archivedNoBill: "Archived: restore them to bill this visit.",
    /** No charge (plan §15.6; D319). */
    noCharge: "No charge",
    noChargeOf: (patient: string) => `Mark ${patient}’s visit No charge`,
    noChargeReasonLabel: "Why",
    noChargeNoteLabel: "Note",
    noChargeNoteHint: "Needed for Other.",
    markNoCharge: "Mark No charge",
    noCharged: (patient: string) => `${patient}’s visit marked No charge`,
    notNoCharged: "The visit wasn’t marked No charge",
    /** Bills and Payments by their days (D320, D335). */
    stateLabel: "Show",
    allStates: "All",
    billsEmpty: "No bills on these days",
    billsEmptyHint: "Bills issued on the days picked show here.",
    billLine: (number: string, day: string) => `${number} · ${day}`,
    paymentsEmpty: "No payments on these days",
    paymentsEmptyHint: "Payments and refunds recorded on the days picked show here.",
    /** Outstanding (plan §15.4; D321). */
    outstandingEmpty: "No one owes",
    outstandingEmptyHint: "Patients with a balance due show here, most first.",
    remindDues: (patient: string) => `Remind ${patient} on WhatsApp of what’s due`,
    recordPaymentFrom: (patient: string) => `Record a payment from ${patient}`,
  },

  /** A list's days (D320): a chip, or From – To. */
  ranges: {
    label: "Dates",
    from: "From",
    to: "To",
  },

  /** Expenses (plan §16; D328 – D333, D343, D344). */
  /** Reports (plan §18; D345 – D349, D354 – D356). */
  reports: {
    tabsLabel: "Reports",
    dayLabel: "Day",
    chooseDay: "Choose a day",
    previousDay: "Previous day",
    nextDay: "Next day",
    monthLabel: "Month",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    patients: "Patients and appointments",
    money: "Money",
    patientsSeen: "Patients seen",
    newPatients: "New patients",
    returningPatients: "Returning patients",
    appointments: "Appointments",
    completed: "Completed",
    cancelled: "Cancelled",
    noShows: "No-shows",
    collected: "Collected",
    billed: "Billed",
    expenses: "Expenses",
    net: "Net",
    outstanding: "Outstanding today",
    /** The bar chart (D354): money in above the line, money out below. */
    byDay: "Collected and expenses by day",
    byDayHint: "Collected above the line, expenses below",
    dayColumn: "Day",
    byDayKeys: "Use the left and right arrow keys to read each day.",
    /** The donut (D355): how the month's appointments ended. */
    outcomes: "Appointment outcomes",
    outcomesEmpty: "No appointments this month.",
    stillToCome: "Still to come",
    /** "12 · 40%". */
    share: (count: number, percent: number) => `${count} · ${percent}%`,
    /** The donut's whole, cancelled ones included: "50 in all". */
    outcomeTotal: (count: number) => `${count} in all`,
    showTable: "Show as table",
    hideTable: "Hide table",
    table: "Table",
    /** Each doctor's month (D53, D361, D362). */
    byDoctor: "By doctor",
    byDoctorEmpty: "No visits or bills this month.",
    patientsCount: (count: number) => (count === 1 ? "1 patient" : `${count} patients`),
    visitsCount: (count: number) => (count === 1 ? "1 visit" : `${count} visits`),
    billedPaid: (billed: string, paid: string) => `${billed} billed · ${paid} paid`,
    /** The day-end collection summary (D49, D357 – D360). */
    dayEnd: "Day-end collections",
    dayEndEmpty: "No payments this day.",
    byPerson: "By person",
    byMethod: "By method",
    formerMember: "No longer on the team",
    /** A refund handed back, by how: "Refunded, Cash". */
    refunded: (method: string) => `Refunded, ${method}`,
    /** What each person hands over (D357): the cash they took less the cash they handed back. */
    handOver: "Cash to hand over",
    methodColumns: { method: "Method", received: "Received", refunded: "Refunded", net: "Net" },
    netCollected: "Net collected",
    /** The day's payments and refunds voided since, left out of it: "Voided: 1 payment, ₹500 · 1 refund, ₹200". */
    voided: (parts: string) => `Voided: ${parts}`,
    voidedPayments: (count: number, amount: string) => `${count === 1 ? "1 payment" : `${count} payments`}, ${amount}`,
    voidedRefunds: (count: number, amount: string) => `${count === 1 ? "1 refund" : `${count} refunds`}, ${amount}`,
    print: "Print",
    printOf: (day: string) => `Print the day-end collections of ${day}`,
    download: "Download",
    downloadOf: (day: string) => `Download the day-end collections of ${day}`,
    downloaded: "Collections downloaded",
    savedAs: (name: string) => `Saved as “${name}”.`,
    notDownloaded: "The collections weren’t downloaded",
  },

  expenses: {
    add: "Add expense",
    addTitle: "Add expense",
    editTitle: "Expense",
    categoryLabel: "Category",
    amountLabel: "Amount",
    dateLabel: "Date",
    methodLabel: "Paid by",
    descriptionLabel: "Description",
    descriptionHint: "What it was for, if the category doesn’t say: “AC repair, room 2”.",
    save: "Save expense",
    added: (amount: string, category: string) => `${amount} for ${category} added`,
    notAdded: "The expense wasn’t added",
    saved: "Expense saved",
    notSaved: "The expense wasn’t saved",
    archiveAsk: (amount: string, category: string) => `Archive ${amount} for ${category}?`,
    archiveAskMessage: "It leaves the month’s totals. Show archived lists it, to restore.",
    archived: "Expense archived",
    restored: "Expense restored",
    notChanged: "The expense wasn’t changed",
    restoreOf: (amount: string, category: string) => `Restore ${amount} for ${category}`,
    /** The month shown (D330). */
    monthLabel: "Month",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    spentIn: (month: string) => `Spent in ${month}`,
    byCategory: "By category",
    /** A category's total, tapped, shows its expenses alone (D330). */
    onlyOf: (category: string) => `Show only ${category}`,
    showAll: "Show all",
    list: "Expenses",
    empty: "No expenses this month",
    emptyHint: "Rent, salaries, supplies — what the clinic spends, totalled by category.",
    noneOf: (category: string) => `No ${category} this month`,
    today: "Today",
    showArchived: "Show archived",
    hideArchived: "Hide archived",
    archivedEmpty: "Nothing archived this month",
  },

  /** Payments and refunds (plan §15.3; D322 – D324, D334, D336). */
  payment: {
    title: "Record payment",
    refundTitle: "Refund",
    balance: (words: string) => `Balance: ${words}`,
    amountLabel: "Amount",
    amountHint: "More than is due is kept as an advance.",
    paidOnLabel: "Paid on",
    methodLabel: "Method",
    referenceLabel: "Reference",
    referenceHint: "A UPI ref or cheque number, if any.",
    noteLabel: "Note",
    record: "Record payment",
    recorded: (amount: string, patient: string) => `${amount} received from ${patient}`,
    notRecorded: "The payment wasn’t recorded",
    refund: "Refund",
    refundTo: (patient: string) => `Refund ${patient}`,
    refundHint: (advance: string) => `Up to the ${advance} advance they hold.`,
    refunded: (amount: string, patient: string) => `${amount} refunded to ${patient}`,
    notRefunded: "The refund wasn’t recorded",
    balanceNow: (words: string) => `Balance now: ${words}.`,
    /** A payment as a row and its sheet (D325, D336). */
    paidLine: (amount: string, method: string) => `Paid ${amount} · ${method}`,
    refundedLine: (amount: string, method: string) => `Refunded ${amount} · ${method}`,
    paidOn: "Paid on",
    refundedOn: "Refunded on",
    receivedBy: "Received by",
    handedBackBy: "Handed back by",
    void: "Void payment",
    voidRefund: "Void refund",
    voidReasonLabel: "Reason",
    voidReasonHint: "For example: entered twice, or the wrong patient.",
    voidAsk: (amount: string) => `Void the payment of ${amount}?`,
    voidRefundAsk: (amount: string) => `Void the refund of ${amount}?`,
    voidAskMessage: "It stays on record, marked Void, and leaves the balance.",
    keep: "Keep it",
    voided: "Payment voided",
    refundVoided: "Refund voided",
    notVoided: "It wasn’t voided",
    voidedOn: (day: string) => `Voided ${day}`,
    voidedBy: (day: string, name: string) => `Voided ${day} by ${name}`,
    voidReason: (reason: string) => `Void: ${reason}`,
  },

  /** A bill's page (plan §15.2; D314, D317). */
  bill: {
    title: "Bill",
    titleOf: (number: string) => `Bill ${number}`,
    issued: (day: string) => `Issued ${day}`,
    issuedBy: (name: string) => `Issued by ${name}`,
    /** A line as it was billed: "2 × ₹400". */
    times: (quantity: number, price: string) => `${quantity} × ${price}`,
    forVisit: "For a visit",
    paid: "Paid",
    due: "Due on this bill",
    balance: "Patient’s balance",
    /** Sent on WhatsApp with its PDF (D327, D341), as the prescription is. */
    whatsApp: "WhatsApp",
    whatsAppOf: (number: string) => `Send bill ${number} on WhatsApp`,
    shared: "Bill shared",
    attachTitle: "Attach it in WhatsApp",
    attachBody: (name: string) =>
      `WhatsApp opened in a new tab with the message, and “${name}” was downloaded. Attach it in the chat.`,
    readyTitle: "The bill is ready",
    readyBody: "Tap Send, then choose WhatsApp.",
    send: "Send",
    notSent: "The bill wasn’t sent",
    /** Its PDF (plan §15.5): opened to look at and print, or saved. */
    print: "Print",
    printOf: (number: string) => `Print bill ${number}`,
    download: "Download",
    downloadOf: (number: string) => `Download bill ${number}`,
    downloaded: "Bill downloaded",
    savedAs: (name: string) => `Saved as “${name}”.`,
    notDownloaded: "The bill wasn’t downloaded",
    openProfile: "Open profile",
    /** Voiding it (D314): a reason, then the card asks first. */
    void: "Void bill",
    voidTitle: "Void bill",
    voidReasonLabel: "Reason",
    voidReasonHint: "For example: wrong patient, or a line missed.",
    voidAsk: (number: string) => `Void bill ${number}?`,
    voidAskMessage: "It stays on record, marked Void, and leaves the balance. Issue a new bill to correct it.",
    keep: "Keep it",
    voided: (number: string) => `Bill ${number} voided`,
    visitBackToBill: "Its visit is back in To bill.",
    notVoided: "The bill wasn’t voided",
    voidedOn: (day: string) => `Voided ${day}`,
    voidedBy: (day: string, name: string) => `Voided ${day} by ${name}`,
    /** A void bill, issued again with its lines (D314). */
    reissue: "Re-issue",
    reissueOf: (number: string) => `Re-issue bill ${number}`,
  },

  /** What the PDFs say (plan §33; D218 – D224). */
  documents: {
    /** At the foot of every page (D30). */
    footer: "Generated with ClinicDesk",
    page: (page: number, of: number) => `Page ${page} of ${of}`,
    /** Atop every page after the first: whose it is. */
    running: (patient: string, about: string, day: string) => `${patient} · ${about} · ${day}`,
    /** A doctor as the printout names them: "Dr. Maya Rao" — once, should their name already say it. */
    doctor: (name: string) => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`),
    registration: (number: string) => `Reg. ${number}`,
    rx: "Rx",
    diagnosis: "Diagnosis",
    advice: "Advice",
    followUp: (day: string) => `Review on ${day}`,
    prescriptionTitle: (patient: string, day: string) => `Prescription for ${patient}, ${day}`,
    /** The bill (plan §15.5; D315, D316). */
    billTitle: (number: string, patient: string) => `Bill ${number} for ${patient}`,
    /** The file a bill is saved as: its number as a file may hold it. */
    billFile: (patient: string, number: string) => `${patient} - Bill ${number}.pdf`,
    bill: "Bill",
    billNumber: (number: string) => `No. ${number}`,
    gstin: (gstin: string) => `GSTIN ${gstin}`,
    mobile: (phone: string) => `Mobile ${phone}`,
    billColumns: { description: "Description", quantity: "Qty", rate: "Rate", amount: "Amount" },
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    paid: "Paid",
    due: "Due on this bill",
    balance: (words: string) => `Patient’s balance: ${words}`,
    notes: "Notes",
    voidStamp: "VOID",
    voidReason: (reason: string) => `Void: ${reason}`,
    signatory: "Authorised signatory",
    /** The file a prescription is saved as (D223). */
    prescriptionFile: (patient: string, day: string) => `${patient} - ${day} - Prescription.pdf`,
    /** The day-end collections (D49, D359, D360). */
    collectionsTitle: (day: string) => `Day-end collections, ${day}`,
    collectionsFile: (day: string) => `Collections - ${day}.pdf`,
    collectionsRunning: (day: string) => `Day-end collections · ${day}`,
    countedBy: "Counted by",
    receivedBy: "Received by",
    /** The vitals in one line, each short. */
    vitals: {
      bloodPressure: "BP",
      pulse: "Pulse",
      temperatureF: "Temp",
      spo2: "SpO₂",
      respiratoryRate: "RR",
      weightKg: "Weight",
      heightCm: "Height",
      bmi: "BMI",
    },
  },

  /** The readings of a visit (plan §12.2), with their units. */
  vitals: {
    bloodPressure: "Blood pressure",
    systolic: "Systolic",
    diastolic: "Diastolic",
    pulse: "Pulse",
    temperatureF: "Temperature",
    spo2: "SpO₂",
    respiratoryRate: "Respiratory rate",
    weightKg: "Weight",
    heightCm: "Height",
    bmi: "BMI",
    units: {
      bloodPressure: "mmHg",
      pulse: "/min",
      temperatureF: "°F",
      spo2: "%",
      respiratoryRate: "/min",
      weightKg: "kg",
      heightCm: "cm",
    },
    notTaken: "—",
  },

  /** One appointment (plan §11.2; D160 – D167): its detail, and what its status allows. */
  appointment: {
    whenLabel: "When",
    doctorLabel: "Doctor",
    typeLabel: "Type",
    tokenLabel: "Token",
    notesLabel: "Notes",
    bookedLabel: "Booked",
    addedLabel: "Added at the desk",
    cancelledLabel: "Cancelled",
    reasonLabel: "Reason",
    /** Who did it and on which day; the day alone once their account is gone. */
    by: (who: string | null, day: string) => (who ? `${who}, ${day}` : day),
    when: (day: string, range: string) => `${day} · ${range}`,
    formerDoctor: "No longer on the team",
    openProfile: "Open profile",
    openProfileOf: (name: string) => `Open ${name}’s profile`,
    actions: "What to do",
    confirm: "Confirm",
    reschedule: "Reschedule",
    rescheduleTitle: "Reschedule",
    editNotes: "Edit notes",
    noShow: "No-show",
    cancel: "Cancel appointment",
    cancelTitle: "Cancel the appointment",
    keep: "Keep it",
    reasonsLabel: "Why",
    reasons: ["Patient asked", "Doctor unavailable", "Clinic closed", "Booked by mistake"],
    otherReason: "Other",
    cancelAsk: (patient: string) => `Cancel ${patient}’s appointment?`,
    cancelAskBody: (when: string, doctor: string, reason: string) => `${when} with ${doctor}. Reason: ${reason}.`,
    noShowAsk: (patient: string) => `Mark ${patient} a no-show?`,
    noShowAskBody: "It can’t go back to scheduled. If they come later today, they can still be marked arrived.",
    confirmed: (patient: string, when: string) => `Confirmed ${patient} · ${when}`,
    cancelled: (patient: string, when: string) => `Cancelled ${patient} · ${when}`,
    markedNoShow: (patient: string, when: string) => `${patient} marked a no-show · ${when}`,
    moved: (patient: string, when: string, doctor: string) => `Moved ${patient} · ${when} with ${doctor}`,
    notesSaved: (patient: string) => `Notes saved for ${patient}`,
    notChanged: "That wasn’t changed",
    archivedNote: "This patient is archived: their appointments can’t change until they are restored.",
    /** A reminder on WhatsApp (plan §22.1; D179 – D184). */
    remind: "Remind on WhatsApp",
    remindNamed: (patient: string) => `Remind ${patient} on WhatsApp`,
    remindedLabel: "Reminded",
    reminded: "Reminded",
    notReminded: "The reminder wasn’t noted",
  },

  /** Holidays and leave (plan §9, D84 – D87): the days the clinic, or one doctor, is away. */
  closures: {
    count: (count: number) => (count === 0 ? "None coming up" : `${count} coming up`),
    upcoming: "Coming up",
    add: "Add holiday or leave",
    addTitle: "Add a holiday or leave",
    whoLabel: "Who’s away",
    wholeClinic: "Whole clinic",
    firstDayLabel: "First day",
    lastDayLabel: "Last day",
    datesHint: "Booking refuses these days.",
    reasonLabel: "Reason",
    reasonHint: "Like Diwali, a conference or annual leave.",
    days: (count: number) => (count === 1 ? "1 day" : `${count} days`),
    added: (reason: string) => `${reason} added`,
    notSaved: "That wasn’t saved",
    removeNamed: (reason: string) => `Remove ${reason}`,
    removeTitle: (reason: string) => `Remove ${reason}?`,
    removeBody: "Booking opens on those days again.",
    /** The appointments already on the days being picked (D87, D137). */
    appointmentsOnDays: (count: number) =>
      count === 1 ? "1 appointment on these days" : `${count} appointments on these days`,
    appointmentsStay: "They stay booked — move or cancel them from the calendar.",
    appointmentsList: "Appointments on these days",
    appointmentWhen: (day: string, time: string, doctor: string) => `${day}, ${time} · ${doctor}`,
    aPatient: "A patient",
    moreAppointments: (count: number) => `And ${count} more`,
    remove: "Remove",
    removed: (reason: string) => `${reason} removed`,
    notRemoved: "That wasn’t removed",
    past: "Past",
    showPast: (count: number) => `Show past (${count})`,
    hidePast: "Hide past",
    emptyTitle: "No days off coming up",
    emptyHint: "Add a holiday or a doctor’s leave, and booking will refuse those days.",
  },

  /** The team (plan §8, D88 – D90): who works at the clinic, and inviting more. */
  team: {
    count: (count: number) => (count === 1 ? "1 person" : `${count} people`),
    invite: "Invite",
    inviteTitle: "Invite a team member",
    send: "Send invite",
    people: "Team",
    invitedList: "Invited",
    inactiveList: "Inactive",
    you: (name: string) => `${name} (you)`,
    linkUntil: (date: string) => `Link until ${date}`,
    linkExpired: "Link has run out",
    nameLabel: "Name",
    emailLabel: "Email",
    emailHint: "The invite goes here. They choose their own password.",
    roleLabel: "Role",
    jobTitleLabel: "Job title",
    jobTitleHint: "Like Front desk or Nurse.",
    accessTitle: "What they can do",
    presetLabel: "Start from",
    accessHint: "Change any of these. What one needs is ticked with it.",
    ownerOnly: "Only the owner can give this.",
    notYours: "You don’t have this yourself.",
    doctorTitle: "Doctor details",
    specializationLabel: "Specialization",
    qualificationsLabel: "Qualifications",
    qualificationsHint: "Like BDS, MDS.",
    registrationLabel: "Registration number",
    registrationHint: "Needed before they can sign a prescription.",
    feeLabel: "Consultation fee",
    feeHint: "Leave it empty to charge the price list’s Consultation.",
    invited: (email: string) => `Invite sent to ${email}`,
    invitedNoEmail: "The invite is saved, but its email didn’t go",
    invitedNoEmailBody: "Send it with Resend once email is working.",
    notInvited: "The invite wasn’t sent",
    resend: "Resend",
    resendNamed: (name: string) => `Resend the invite to ${name}`,
    resent: (email: string) => `A new invite went to ${email}`,
    notResent: "The invite wasn’t sent again",
    revoke: "Revoke",
    revokeNamed: (name: string) => `Revoke ${name}’s invite`,
    revokeTitle: (name: string) => `Revoke ${name}’s invite?`,
    revokeBody: "Their link stops working. You can invite them again later.",
    revoked: (name: string) => `${name}’s invite revoked`,
    notRevoked: "The invite wasn’t revoked",
  },

  /** A member's page (plan §8.6, D93 – D95): who they are, what they can do, and whether they still work here. */
  member: {
    contact: "Contact",
    emailLabel: "Email",
    phoneLabel: "Mobile number",
    noPhone: "Not added yet",
    inactive: "Inactive — they can’t sign in.",
    details: "Details",
    jobTitle: "Job title",
    noJobTitle: "Not set",
    jobTitleSheet: "Change job title",
    doctorDetails: "Doctor details",
    doctorSheet: "Change doctor details",
    noDoctorDetails: "Specialization, qualifications, registration number and fee",
    registration: (number: string) => `Reg. ${number}`,
    ownFee: (fee: string) => `Fee ${fee}`,
    saveAccess: "Save changes",
    accessSaved: (name: string) => `${name}’s access saved`,
    detailsSaved: "Saved",
    notSaved: "That wasn’t saved",
    readOnly: (name: string) => `Only the owner can change ${name}.`,
    deactivate: "Deactivate",
    deactivateTitle: (name: string) => `Deactivate ${name}?`,
    deactivateBody:
      "They can’t sign in from their next request. What they did stays, with their name. You can reactivate them.",
    deactivated: (name: string) => `${name} deactivated`,
    reactivate: "Reactivate",
    reactivateTitle: (name: string) => `Reactivate ${name}?`,
    reactivateBody: "They can sign in again, with the access they had.",
    reactivated: (name: string) => `${name} reactivated`,
    notChanged: "That wasn’t changed",
    ownAccess: "As the owner, you have every permission, always.",
    seesPatients: "I also see patients",
    seesPatientsHint: "You can be booked, run a queue and write prescriptions.",
    seesOn: "You’re one of the clinic’s doctors now",
    seesOff: "You’re no longer one of the clinic’s doctors",
  },

  /** Accepting an invite (plan §8.5, D91, D92): the screen the emailed link opens. */
  acceptInvite: {
    pageTitle: "Accept an invite",
    title: (clinic: string) => `Join ${clinic}`,
    intro: (role: string, email: string) =>
      `You’re joining as ${role}. You’ll sign in with ${email} or your mobile number.`,
    roles: { DOCTOR: "a doctor", STAFF: "a member of staff" },
    opening: "Opening your invite…",
    nameLabel: "Your name",
    phoneLabel: "Mobile number",
    passwordLabel: "Choose a password",
    passwordHint: "At least 8 characters.",
    join: "Join the clinic",
    notJoined: "You haven’t joined yet",
    invalidTitle: "This invite link isn’t valid",
    expiredTitle: "This invite link has run out",
  },

  /** My account's theme switch (D36): kept per device. */
  theme: {
    label: "Theme",
    hint: "Kept on this device only.",
    system: "System",
    light: "Light",
    dark: "Dark",
  },

  /** Patients (plan §10, D98 – D108). */
  patients: {
    /** A patient's number as everyone reads it: P-1001. */
    number: (number: number) => `P-${number}`,
    add: "Add patient",
    addTitle: "Add a patient",
    editTitle: "Edit patient",
    nameLabel: "Full name",
    mobileLabel: "Mobile",
    bornLabel: "Born",
    bornAs: { DATE: "Date of birth", AGE: "Age" },
    dateOfBirthLabel: "Date of birth",
    ageLabel: "Age in years",
    ageHint: "For a baby, give the date of birth instead.",
    genderLabel: "Gender",
    doctorLabel: "Doctor",
    doctorHint: "Their doctor sees them — and so does any doctor who treats them.",
    noDoctor: "No doctor yet",
    showMore: "More details",
    hideMore: "Fewer details",
    moreDetails: "More details",
    altPhoneLabel: "Alternate phone",
    altPhoneHint: "Another number for them, mobile or landline.",
    emailLabel: "Email",
    addressLabel: "Address",
    emergencyNameLabel: "Emergency contact",
    emergencyPhoneLabel: "Emergency contact’s phone",
    notesLabel: "Notes",
    notesHint: "Not clinical, like “prefers mornings”. Allergies go in alerts.",
    matchesTitle: (count: number) =>
      count === 1 ? "Already here? 1 patient has this mobile" : `Already here? ${count} patients have this mobile`,
    matchesHint: "Open one, or carry on to add someone new — families often share a number.",
    matchesChooseHint: "Choose one, or carry on to add someone new — families often share a number.",
    archived: "Archived",
    added: (name: string, number: string) => `${name} added — ${number}`,
    notAdded: "The patient wasn’t added",
    saved: (name: string) => `${name} saved`,
    notSaved: "That wasn’t saved",
    /** The list (plan §10.2, D110 – D112). */
    yours: "Your patients",
    searchPlaceholder: "Search by name, mobile or number",
    tabsLabel: "Which patients",
    tabs: { ALL: "All", OWING: "Owing", ARCHIVED: "Archived" },
    call: (name: string) => `Call ${name}`,
    emptyTitle: "No patients yet",
    emptyHint: "Patients you add appear here, the newest first.",
    emptyHintDoctor: "Patients assigned to you, or booked with you, appear here.",
    owingEmptyTitle: "No one owes",
    owingEmptyHint: "Patients with a balance due show here, most first.",
    archivedEmptyTitle: "No archived patients",
    archivedEmptyHint: "A patient archived from their profile waits here, to be restored.",
    noMatches: (search: string) => `No patient matches “${search}”`,
    noMatchesHint: "Add them now — what you typed is filled in.",
    /** The profile (plan §10.3, D113 – D116). */
    doctorLine: (name: string) => `Doctor · ${name}`,
    callLabel: "Call",
    whatsAppLabel: "WhatsApp",
    whatsAppTo: (name: string) => `WhatsApp ${name}`,
    details: "Details",
    edit: "Edit",
    editName: (name: string) => `Edit ${name}`,
    /** Archive and restore (plan §10.1, D103, D122 – D125). */
    archiveTitle: (name: string) => `Archive ${name}?`,
    archiveBody:
      "They leave the patients list and search. Their records are kept, read-only, and they can be restored from Archived.",
    archivedNote: (name: string) => `${name} archived`,
    notArchived: "That patient wasn’t archived",
    /** An archive refused for an appointment still to come (D140). */
    hasAppointmentOn: (name: string, day: string) => `${name} has an appointment on ${day}`,
    /** An archive refused for an open treatment (D255): named to whoever reads treatments. */
    hasOpenTreatment: (name: string, treatment: string | null) =>
      treatment ? `${name} has an open treatment: ${treatment}` : `${name} has an open treatment`,
    /** An archive refused for a visit still waiting in To bill (D288). */
    hasVisitToBill: (name: string, day: string) => `${name} has a visit to bill from ${day}`,
    archivedOn: (date: string, by: string | null) => (by ? `Archived on ${date} by ${by}` : `Archived on ${date}`),
    archivedHint: "Their profile is read-only until they are restored.",
    restoreName: (name: string) => `Restore ${name}`,
    restoredNote: (name: string) => `${name} restored`,
    notRestored: "That patient wasn’t restored",
    /** Their appointments (plan §10.3, D101, D166, D167). */
    nextAppointment: "Next appointment",
    noNextAppointment: "No appointment to come",
    bookFor: (name: string) => `Book an appointment for ${name}`,
    history: "History",
    historyEmpty: "No visits or appointments yet",
    historyEmptyHint:
      "Their visits, appointments, bills and payments show here, newest first — cancelled ones and no-shows too.",
    /** Where the patient stands with the clinic's money (plan §10.3 item 4). */
    balance: "Balance",
    /** A visit in their history (D225, D226). */
    visitOn: (day: string) => `${day} · Visit`,
    nothingRecorded: "Nothing recorded",
    medicines: (names: string[], more: number) => `Rx ${names.join(", ")}${more > 0 ? ` +${more}` : ""}`,
    /** Their last visit, on the patients list (D228, D229). */
    lastVisit: (day: string) => `Last visit: ${day}`,
    lastVisitToday: "Last visit: today",
  },

  /** A patient's alerts (plan §10.4, D117 – D120). */
  alerts: {
    title: "Alerts",
    open: "Alerts",
    none: "No alerts",
    add: "Add alert",
    addTitle: "Add an alert",
    editTitle: (kind: string) => `Edit ${kind.toLowerCase()}`,
    kindLabel: "Kind",
    labelLabel: "Name",
    labelHint: "Like Penicillin, Diabetes or Metformin 500 mg.",
    noteLabel: "Note",
    noteHint: "Like the reaction, or since when.",
    emptyTitle: "No alerts yet",
    emptyHint:
      "Allergies, conditions and current medications show at the top of the profile, at visits and on prescriptions.",
    edit: (label: string) => `Edit ${label}`,
    turnOff: "Turn off",
    turnOffName: (label: string) => `Turn off ${label}`,
    turnOffTitle: (label: string) => `Turn off ${label}?`,
    turnOffBody: "It stops showing on the profile, at visits and on prescriptions. Add it again if it comes back.",
    turnedOff: (label: string) => `${label} turned off`,
    notTurnedOff: "That wasn’t turned off",
    added: (label: string) => `${label} added`,
    notAdded: "The alert wasn’t added",
    saved: (label: string) => `${label} saved`,
    notSaved: "That wasn’t saved",
    turnedOffSection: "Turned off",
    showTurnedOff: (count: number) => `Show turned off (${count})`,
    hideTurnedOff: "Hide turned off",
  },

  /** Importing patients (plan §10.5, D51, D127 – D133). */
  patientImport: {
    title: "Import patients",
    subtitle: "From an Excel or CSV file",
    steps: { FILE: "File", COLUMNS: "Columns", CHECK: "Check", SEND: "Import" },
    stepsLabel: "Import steps",
    next: "Next",
    back: "Back",
    // The file.
    fileTitle: "Choose a file",
    fileHint:
      "A CSV or Excel (.xlsx) file with a header row and one patient per row. It is read on this device: the file itself is never sent or kept.",
    choose: "Choose file",
    chooseAnother: "Choose another file",
    reading: "Reading…",
    chosen: (name: string, rows: number) => `${name} · ${rows === 1 ? "1 row" : `${count(rows)} rows`}`,
    tooLong: (rows: number, max: number) =>
      `That file has ${count(rows)} rows; one import takes at most ${count(max)}. Split it, and import each part.`,
    patientsOnly: "Patients only: visits, bills and balances stay in the old system.",
    // The columns.
    columnsTitle: "Match the columns",
    columnsHint: "Each field takes one of the file's columns, guessed from its headers. Check them before going on.",
    notInFile: "Not in the file",
    column: (letter: string, header: string) => (header ? `${letter} · ${header}` : `Column ${letter}`),
    sample: (value: string) => `First row: ${value}`,
    fields: {
      fullName: "Full name",
      phone: "Mobile",
      dateOfBirth: "Date of birth",
      age: "Age in years",
      gender: "Gender",
      altPhone: "Alternate phone",
      email: "Email",
      address: "Address",
      emergencyContactName: "Emergency contact",
      emergencyContactPhone: "Emergency contact’s phone",
      notes: "Notes",
    },
    bornHint: "Give the date of birth, the age, or both: a row uses its date of birth when it has one.",
    bornMissing: "Choose the column for the date of birth or the age.",
    columnMissing: (label: string) => `Choose the column for ${label.toLowerCase()}.`,
    genderUnread: "Gender needs to say Male, Female or Other (or M, F, O).",
    dateUnread: "Date of birth must be a date, like 03/04/1990 (day first) or 1990-04-03.",
    // Checking the rows.
    checkTitle: "Check the rows",
    checking: "Checking against the clinic's patients…",
    countsLabel: "The rows",
    readyLabel: "Ready",
    problemsTitle: "With problems",
    problemsHint: "Left out. Download them after the import to fix and import again.",
    duplicatesTitle: "Possible duplicates",
    duplicatesHint: "Skipped unless you tick them to import anyway: a family can share one mobile.",
    row: (line: number, name: string) => (name ? `Row ${line} · ${name}` : `Row ${line}`),
    sameAsPatient: (number: string, name: string) => `Same mobile and name as ${number} ${name}`,
    sameAsRow: (line: number) => `Same mobile and name as row ${line}`,
    showMore: "Show more",
    noneReady: "No row is ready to import. Go back and check the columns, or fix the file.",
    // Sending.
    sendTitle: "Import",
    willAdd: (rows: number) =>
      rows === 1
        ? "1 patient will be added, numbered after the clinic's last."
        : `${count(rows)} patients will be added, numbered after the clinic's last.`,
    willLeave: (skipped: number, refused: number) =>
      `${count(skipped)} skipped as duplicates, ${count(refused)} left out with problems.`,
    send: (rows: number) => (rows === 1 ? "Import 1 patient" : `Import ${count(rows)} patients`),
    sending: (done: number, total: number) => `Importing… ${count(done)} of ${count(total)}`,
    keepOpen: "Keep this page open until it finishes.",
    stopped: (done: number, total: number) =>
      `The import stopped at ${count(done)} of ${count(total)}. No one is added twice, so try again to carry on.`,
    progressLabel: "Import progress",
    // The summary.
    doneTitle: "Import finished",
    importedLabel: "Imported",
    skippedLabel: "Skipped as duplicates",
    refusedLabel: "Not imported",
    downloadRefused: "Download rows not imported",
    refusedFile: "patients-not-imported.csv",
    problemColumn: "Problem",
    openPatients: "Open patients",
    importAnother: "Import another file",
    fromEmpty: "Import from a file",
  },

  /** An age, short enough for a row or a prescription (plan §10.1). */
  age: {
    years: (count: number) => `${count} y`,
    months: (count: number) => `${count} mo`,
    days: (count: number) => `${count} d`,
  },

  /** How long ago something happened, by the clinic's calendar: "2 days ago". */
  ago: {
    today: "today",
    yesterday: "yesterday",
    days: (count: number) => `${count} days ago`,
    weeks: (count: number) => (count === 1 ? "a week ago" : `${count} weeks ago`),
    months: (count: number) => (count === 1 ? "a month ago" : `${count} months ago`),
    years: (count: number) => (count === 1 ? "a year ago" : `${count} years ago`),
  },
} as const;

/**
 * Every word of every email (plan §22). The app's name comes from UI_TEXT, so
 * the final name is one change (D35).
 */
/**
 * What a WhatsApp message says, written to the patient (plan §22.1, D48): the
 * app opens WhatsApp with it, and a person presses send. English in V1; no
 * clinical detail beyond what the patient is being sent.
 */
export const WHATSAPP_TEXT = {
  /** "Reminder: your appointment with Dr. Maya Rao at Smile Care on Tue 14 Oct, 10:30 AM." */
  appointmentReminder: (doctor: string | null, clinic: string, when: string) =>
    doctor
      ? `Reminder: your appointment with ${doctor} at ${clinic} on ${when}.`
      : `Reminder: your appointment at ${clinic} on ${when}.`,
  /** A doctor as a patient is told of them: "Dr. Maya Rao" — once, if their name already says so. */
  doctor: (name: string) => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`),
  when: (day: string, time: string) => `${day}, ${time}`,
  /**
   * "Dr. Maya Rao at Smile Care asked to see you again around 14 Oct. Reply or
   * call 98765 43210 to book." (plan §22.1, D273) — without the doctor, the
   * clinic asks; without the clinic's phone, a reply books.
   */
  followUpReminder: (doctor: string | null, clinic: string, day: string, phone: string | null) =>
    `${doctor ? `${doctor} at ${clinic}` : clinic} asked to see you again around ${day}. ${
      phone ? `Reply or call ${phone} to book.` : "Reply to book."
    }`,
  /**
   * "Hello Rohan, a balance of ₹1,200 is due at Smile Dental. Reply or call
   * 0484 234 5678." (D321) — without the clinic's phone, a reply does.
   */
  duesReminder: (firstName: string, amount: string, clinic: string, phone: string | null) =>
    `Hello ${firstName}, a balance of ${amount} is due at ${clinic}. ${
      phone ? `Reply or call ${phone}.` : "Reply with any questions."
    }`,
  /**
   * "Your bill 2026-27/0042 from Smile Care, 15 Oct: ₹1,500. ₹1,000 is
   * due." — with the PDF (D341); the due only while something is.
   */
  bill: (number: string, clinic: string, day: string, total: string, due: string | null) =>
    `Your bill ${number} from ${clinic}, ${day}: ${total}.${due ? ` ${due} is due.` : ""}`,
  /** "Your prescription from Dr. Maya Rao, Smile Care, 15 Oct." — with the PDF (D245). */
  prescription: (doctor: string | null, clinic: string, day: string) =>
    doctor ? `Your prescription from ${doctor}, ${clinic}, ${day}.` : `Your prescription from ${clinic}, ${day}.`,
} as const;

export const MAIL_TEXT = {
  greeting: (name: string) => `Hi ${name},`,
  /** Under a button, for a mail app that will not show one. */
  linkFallback: "If the button doesn't work, copy this link into your browser:",
  linkValid: (hours: number) => `The link works for ${hours} hours.`,
  confirmation: {
    subject: `Confirm your email for ${UI_TEXT.appName}`,
    preheader: "One tap, and you can sign in to your clinic.",
    heading: "Confirm your email",
    body: "Your clinic is set up. Confirm this is your email address, and you can sign in.",
    action: "Confirm my email",
    footnote: `You're getting this because this address was used to sign up a clinic on ${UI_TEXT.appName}. If that wasn't you, you can ignore this email.`,
  },
  invite: {
    subject: (clinic: string) => `You're invited to ${clinic} on ${UI_TEXT.appName}`,
    preheader: "Choose a password, and you're in.",
    heading: (clinic: string) => `Join ${clinic}`,
    body: (inviter: string, clinic: string, role: string) =>
      `${inviter} has invited you to join ${clinic} on ${UI_TEXT.appName}, as ${role}. Choose your password and add your mobile number with the button below.`,
    action: "Accept the invite",
    linkValid: (days: number) => (days === 1 ? "The link works for 1 day." : `The link works for ${days} days.`),
    footnote: "If you weren't expecting this, you can ignore this email. Nothing happens until the link is used.",
    /** How the role reads in a sentence. */
    roles: { DOCTOR: "a doctor", STAFF: "a member of staff" },
  },
  passwordReset: {
    subject: `Reset your ${UI_TEXT.appName} password`,
    preheader: "Choose a new password with this link.",
    heading: "Choose a new password",
    body: "We got a request to reset the password for your account. Choose a new one with the button below.",
    action: "Choose a new password",
    footnote: "If you didn't ask for this, ignore this email. Your password stays as it is.",
  },
} as const;
