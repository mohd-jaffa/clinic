import type { Metadata } from "next";

import { Landing } from "@/components/landing/Landing";
import { UI_TEXT } from "@/constants/messages";
import { readInitialSession } from "@/features/auth/session.server";
import { readPublicPricing } from "@/lib/platform/pricing";

export const metadata: Metadata = {
  title: { absolute: UI_TEXT.landing.pageTitle(UI_TEXT.appName) },
  description: UI_TEXT.landing.lede,
};

/**
 * The landing page (plan §21): who is signed in — read once for the layout
 * too — and the live prices, at once.
 */
export default async function LandingPage() {
  const [session, pricing] = await Promise.all([readInitialSession(), readPublicPricing()]);
  return <Landing session={session} pricing={pricing} />;
}
