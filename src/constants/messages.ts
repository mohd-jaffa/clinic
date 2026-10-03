/**
 * Every word the app says, in one place (AGENTS.md §5, §27). No screen, route
 * or schema writes a message inline: a wording is changed here once, and the
 * server and the client cannot end up saying different things about the same
 * failure. The voice is warm and plain (PRODUCT.md): an error says what
 * happened and what to do next, never more.
 */

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
  },

  /** The response card (plan §32.2). */
  response: {
    reference: (requestId: string) => `Reference: ${requestId}`,
    closeNotice: (title: string) => `Close “${title}”`,
  },

  states: {
    loading: "Loading…",
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
    calendar: (field: string) => `${field}: pick a day`,
    previousMonth: "Previous month",
    nextMonth: "Next month",
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

  /** My account's theme switch (D36): kept per device. */
  theme: {
    label: "Theme",
    hint: "Kept on this device only.",
    system: "System",
    light: "Light",
    dark: "Dark",
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
  passwordReset: {
    subject: `Reset your ${UI_TEXT.appName} password`,
    preheader: "Choose a new password with this link.",
    heading: "Choose a new password",
    body: "We got a request to reset the password for your account. Choose a new one with the button below.",
    action: "Choose a new password",
    footnote: "If you didn't ask for this, ignore this email. Your password stays as it is.",
  },
} as const;
