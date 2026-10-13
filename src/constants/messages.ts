/**
 * Every word the app says, in one place (AGENTS.md §5, §27). No screen, route
 * or schema writes a message inline: a wording is changed here once, and the
 * server and the client cannot end up saying different things about the same
 * failure. The voice is warm and plain (PRODUCT.md): an error says what
 * happened and what to do next, never more.
 */

import { MAX_PATIENT_AGE } from "./limits";

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
  PATIENTS_LOAD_FAILED: "The patients couldn't be loaded.",
  ALERT_ALREADY_EXISTS: "This patient already has that alert.",
  ALERTS_LOAD_FAILED: "The alerts couldn't be loaded.",
  PATIENT_HAS_APPOINTMENTS: "Cancel or move their appointments to come before archiving them.",
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
  VISIT_LOAD_FAILED: "This visit couldn't be loaded.",

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
  day: (label: string) => `${label} must be a date.`,
  notBeforeToday: (label: string) => `${label} can’t be before today.`,
  endsBeforeStart: (last: string, first: string) => `${last} can’t be before the ${first.toLowerCase()}.`,
  atMostDays: (max: number) => `It can last at most ${max} days.`,
  permissionsNeedOthers: "Some of these need others ticked too.",
  birthDate: `A date of birth can’t be in the future, or more than ${MAX_PATIENT_AGE} years ago.`,
  invalid: "That value is not valid.",
  gstin: "GSTIN must be 15 characters, like 32ABCDE1234F1Z5.",
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
  home: {
    greeting: (firstName: string) => `Hello, ${firstName}`,
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
    tabs: { ALL: "All", ARCHIVED: "Archived" },
    call: (name: string) => `Call ${name}`,
    emptyTitle: "No patients yet",
    emptyHint: "Patients you add appear here, the newest first.",
    emptyHintDoctor: "Patients assigned to you, or booked with you, appear here.",
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
    historyEmpty: "No appointments yet",
    historyEmptyHint: "Their appointments show here, newest first — cancelled ones and no-shows too.",
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
