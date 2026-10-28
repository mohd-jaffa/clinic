import type { Metadata } from "next";

import { ConsoleScreen } from "@/components/nav/ConsoleScreen";
import { UI_TEXT } from "@/constants/messages";
import { listConsoleClinics } from "@/features/admin/api";
import { ConsoleClinics } from "@/features/admin/components/ConsoleClinics";
import { clinicFilterOf, consoleClinicsKey } from "@/features/admin/keys";

export const metadata: Metadata = { title: UI_TEXT.console.places.clinics };

export default async function ConsoleClinicsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  // The list opens on the filter its address names (an Overview figure), and arrives with that page.
  const filter = clinicFilterOf((await searchParams).filter);
  return (
    <ConsoleScreen
      pages={{ [consoleClinicsKey("", filter)]: (admin) => listConsoleClinics(admin, { filter: filter ?? undefined }) }}
    >
      <ConsoleClinics />
    </ConsoleScreen>
  );
}
