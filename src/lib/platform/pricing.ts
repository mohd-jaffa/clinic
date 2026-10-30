import type { PlatformSettings } from "@/constants/platform";
import { captureError } from "@/lib/audit/errorLog";

import { getPlatformSettings } from "./settings";

/**
 * What anyone may be told of the platform settings (plan §6, §21): the free
 * trial, the two prices and who to talk to — each part of the contact null,
 * and not shown, until the DEV sets it. Nothing else of the row leaves the
 * server, and never the UPI id, which is for a clinic renewing.
 */
export interface PublicPricing {
  trialDays: number;
  monthlyPaise: number;
  yearlyPaise: number;
  contact: { name: string | null; phone: string | null; email: string | null };
}

export function toPublicPricing(settings: PlatformSettings): PublicPricing {
  return {
    trialDays: settings.trialDays,
    monthlyPaise: settings.monthlyPricePaise,
    yearlyPaise: settings.yearlyPricePaise,
    contact: {
      name: settings.renewalContactName,
      phone: settings.renewalContactPhone,
      email: settings.renewalContactEmail,
    },
  };
}

/** The live trial, prices and contact, read at request time (`GET /api/public/pricing`). */
export async function getPublicPricing(): Promise<PublicPricing> {
  return toPublicPricing(await getPlatformSettings());
}

/**
 * The same, for the landing as it is drawn: null when the settings cannot be
 * read — the page then leaves the prices out rather than show a default as
 * live (AGENTS.md §10) — with the failure in the error log.
 */
export async function readPublicPricing(): Promise<PublicPricing | null> {
  try {
    return await getPublicPricing();
  } catch (error) {
    await captureError({ message: "Could not read the prices for the landing", error });
    return null;
  }
}
