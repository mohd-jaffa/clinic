/**
 * Every endpoint the browser calls, in one place. A screen names a route
 * through here, and the hook that refreshes after a change names the same one,
 * so a mutation cannot revalidate a key no query used — the way an inline
 * string quietly can. These double as SWR's cache keys.
 */
export const apiRoutes = {
  // Sessions (plan §5, §30). Each feature adds its group as its phase builds it.
  auth: {
    register: "/api/auth/register",
    session: "/api/auth/session",
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    refresh: "/api/auth/refresh",
    confirm: "/api/auth/confirm",
    resendConfirmation: "/api/auth/resend-confirmation",
    passwordReset: "/api/auth/password-reset",
    passwordResetComplete: "/api/auth/password-reset/complete",
    password: "/api/auth/password",
    profile: "/api/auth/profile",
    acceptInvite: "/api/auth/accept-invite",
    invitePreview: "/api/auth/accept-invite/preview",
  },
  // The clinic's profile and logo (plan §9, §30).
  clinic: {
    profile: "/api/clinic",
    logo: "/api/clinic/logo",
  },
  // The clinic's catalogues (plan §9, §30): each a list, and one entry by id.
  services: {
    list: "/api/services",
    one: (id: string) => `/api/services/${id}`,
  },
  appointmentTypes: {
    list: "/api/appointment-types",
    one: (id: string) => `/api/appointment-types/${id}`,
  },
  expenseCategories: {
    list: "/api/expense-categories",
    one: (id: string) => `/api/expense-categories/${id}`,
  },
  // Holidays and leave (plan §9, §30).
  closures: {
    list: "/api/closures",
    one: (id: string) => `/api/closures/${id}`,
    appointments: "/api/closures/appointments",
  },
  // The clinic's active doctors, for every picker (plan §30).
  doctors: {
    list: "/api/doctors",
  },
  // The team (plan §8, §30): everyone, and the open invites.
  team: {
    list: "/api/team",
    member: (id: string) => `/api/team/${id}`,
    active: (id: string) => `/api/team/${id}/active`,
    ownDoctor: "/api/team/me/doctor",
    invites: "/api/team/invites",
    invite: (id: string) => `/api/team/invites/${id}`,
    resend: (id: string) => `/api/team/invites/${id}/resend`,
  },
  // Patients (plan §10, §30): what is typed about one goes in a body, never here (D98).
  patients: {
    list: "/api/patients",
    search: "/api/patients/search",
    matches: "/api/patients/matches",
    import: "/api/patients/import",
    importMatches: "/api/patients/import/matches",
    one: (id: string) => `/api/patients/${id}`,
    archive: (id: string) => `/api/patients/${id}/archive`,
    restore: (id: string) => `/api/patients/${id}/restore`,
    alerts: (id: string) => `/api/patients/${id}/alerts`,
    alert: (id: string, alertId: string) => `/api/patients/${id}/alerts/${alertId}`,
    summary: (id: string) => `/api/patients/${id}/summary`,
    timeline: (id: string) => `/api/patients/${id}/timeline`,
  },
  // Appointments (plan §11, §30): a doctor's day is who and which day, never a patient.
  appointments: {
    list: "/api/appointments",
    booked: "/api/appointments/booked",
    one: (id: string) => `/api/appointments/${id}`,
    status: (id: string) => `/api/appointments/${id}/status`,
    arrived: (id: string) => `/api/appointments/${id}/arrived`,
    reminded: (id: string) => `/api/appointments/${id}/reminded`,
    vitals: (id: string) => `/api/appointments/${id}/vitals`,
    walkIn: "/api/appointments/walk-in",
  },
  // Today's queue (plan §11.4): one doctor's, or every doctor's.
  queue: {
    list: "/api/queue",
    sendIn: "/api/queue/send-in",
    done: "/api/queue/done",
    next: "/api/queue/next",
    waiting: "/api/queue/waiting",
    steppedOut: "/api/queue/stepped-out",
    urgent: "/api/queue/urgent",
  },
  // Visits (plan §12, §30): opened and closed by the queue, or started from a profile (D204).
  visits: {
    list: "/api/visits",
    one: (id: string) => `/api/visits/${id}`,
    vitals: (id: string) => `/api/visits/${id}/vitals`,
    done: (id: string) => `/api/visits/${id}/done`,
    prescription: (id: string) => `/api/visits/${id}/prescription`,
    /** Its PDF (D221): to open and print; `?download=1` to save it. */
    prescriptionPdf: (id: string) => `/api/visits/${id}/prescription.pdf`,
    /** Settled free, from To bill (plan §15.6; D319). */
    noCharge: (id: string) => `/api/visits/${id}/no-charge`,
  },
  // Prescriptions (plan §13, §30): this clinic's medicines, as written before (D211).
  prescriptions: {
    medicines: "/api/prescriptions/medicines",
  },
  // A doctor's prescription templates (D240 – D243): theirs, archived too (`?doctorId=`); made; changed.
  prescriptionTemplates: {
    list: "/api/prescription-templates",
    one: (id: string) => `/api/prescription-templates/${id}`,
  },
  // Treatments (plan §14.1, §30): made; changed; moved; a visit's session on one (D256).
  treatments: {
    list: "/api/treatments",
    one: (id: string) => `/api/treatments/${id}`,
    status: (id: string) => `/api/treatments/${id}/status`,
    session: (id: string, visitId: string) => `/api/treatments/${id}/sessions/${visitId}`,
  },
  // Bills (plan §15.2, §15.4, §30): issued, and a page of a range; where a new one starts — a visit, an arrival or a patient, by id; one; voided.
  bills: {
    list: "/api/bills",
    start: "/api/bills/start",
    one: (id: string) => `/api/bills/${id}`,
    void: (id: string) => `/api/bills/${id}/void`,
    /** Its PDF (plan §15.5): to open and print; `?download=1` to save it. */
    pdf: (id: string) => `/api/bills/${id}/bill.pdf`,
  },
  // Checkout (plan §15.6; D318, D337): the visits waiting in To bill, a page at a time, and how many.
  toBill: {
    list: "/api/to-bill",
    count: "/api/to-bill/count",
  },
  // Payments (plan §15.3, §15.4): recorded, a page of a range at a time; voided.
  payments: {
    list: "/api/payments",
    void: (id: string) => `/api/payments/${id}/void`,
  },
  // Expenses (plan §16): a month's, a page at a time; one corrected, archived or restored; a month's totals.
  expenses: {
    list: "/api/expenses",
    one: (id: string) => `/api/expenses/${id}`,
    archive: (id: string) => `/api/expenses/${id}/archive`,
    summary: "/api/expenses/summary",
  },
  // Who owes, most first (plan §15.4).
  outstanding: {
    list: "/api/outstanding",
  },
  // Home (plan §17): its figures and sections, each with its permission.
  dashboard: {
    home: "/api/dashboard",
  },
  // The follow-ups to call (plan §14.3): a tab a page at a time, how many each holds, a contact noted.
  followUps: {
    list: "/api/follow-ups",
    counts: "/api/follow-ups/counts",
    contacts: "/api/follow-ups/contacts",
  },
} as const;

/**
 * A route with its query: the values given, in the order given, and nothing
 * for one left empty — so a list with no search asks for exactly its route,
 * and shares its cache with every other screen that does.
 */
export function withQuery(route: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(name, value);
  }
  const text = query.toString();
  if (text === "") return route;
  return `${route}${route.includes("?") ? "&" : "?"}${text}`;
}
