import appointmentsDark from "./appointments-dark.webp";
import appointmentsLight from "./appointments-light.webp";
import billDark from "./bill-dark.webp";
import billLight from "./bill-light.webp";
import desktopDark from "./desktop-dark.webp";
import desktopLight from "./desktop-light.webp";
import followUpsDark from "./follow-ups-dark.webp";
import followUpsLight from "./follow-ups-light.webp";
import queueDark from "./queue-dark.webp";
import queueLight from "./queue-light.webp";
import reportsDark from "./reports-dark.webp";
import reportsLight from "./reports-light.webp";
import visitDark from "./visit-dark.webp";
import visitLight from "./visit-light.webp";

/**
 * The landing page's screenshots (plan §21, D401): the built app, photographed
 * by `scripts/landing-shots.mts` from a made-up clinic — Sunrise Family Clinic,
 * its doctors and patients all invented — which it deletes again. Each screen
 * in the light and the dark theme; a phone's at 390 × 844 (2×), Home on a
 * 1440 × 900 desktop.
 */
export const LANDING_SHOTS = {
  queue: { light: queueLight, dark: queueDark },
  appointments: { light: appointmentsLight, dark: appointmentsDark },
  visit: { light: visitLight, dark: visitDark },
  followUps: { light: followUpsLight, dark: followUpsDark },
  bill: { light: billLight, dark: billDark },
  reports: { light: reportsLight, dark: reportsDark },
  desktop: { light: desktopLight, dark: desktopDark },
} as const;
