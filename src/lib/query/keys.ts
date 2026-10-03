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
  },
  // The clinic's active doctors, for every picker (plan §30).
  doctors: {
    list: "/api/doctors",
  },
  // The team (plan §8, §30): everyone, and the open invites.
  team: {
    list: "/api/team",
    invites: "/api/team/invites",
    invite: (id: string) => `/api/team/invites/${id}`,
    resend: (id: string) => `/api/team/invites/${id}/resend`,
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
