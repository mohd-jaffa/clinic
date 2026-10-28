"use client";

import { Building2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { CoastHeader } from "@/components/ui/coast-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { SearchField } from "@/components/ui/search-field";
import { UI_TEXT } from "@/constants/messages";
import { consoleClinicRoute } from "@/constants/navigation";
import {
  CLINIC_TYPE_LABELS,
  CONSOLE_CLINIC_FILTER_LABELS,
  CONSOLE_CLINIC_FILTERS,
  SUBSCRIPTION_PLAN_LABELS,
  type ConsoleClinicFilter,
} from "@/constants/statuses";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/format/date";

import { useConsoleClinics } from "../hooks/useConsoleClinics";
import { clinicFilterOf } from "../keys";
import type { ConsoleClinic } from "../types";
import { ClinicPills } from "./ClinicPills";

const { console: words } = UI_TEXT;

/** "All", then each filter (plan §20.2): a place in the Overview, or No trial. */
const ALL = "ALL";
type Shown = ConsoleClinicFilter | typeof ALL;
const FILTERS: readonly { value: Shown; label: string }[] = [
  { value: ALL, label: words.allClinics },
  ...CONSOLE_CLINIC_FILTERS.map((value) => ({ value, label: CONSOLE_CLINIC_FILTER_LABELS[value] })),
];

/**
 * The console's Clinics — `/admin/clinics` (plan §20.2; D368, D371): every
 * clinic, the newest sign-up first, searched by the clinic's name or city
 * or the owner's name, email or mobile, and kept to one filter. Each row is
 * the clinic, its kind, city and owner, its plan and last day and how many
 * members it has, where it stands — and No trial while it waits — and opens
 * the clinic's page.
 */
export function ConsoleClinics() {
  const [search, setSearch] = useState("");
  // Opened from an Overview figure: kept to what it counted.
  const [shown, setShown] = useState<Shown>(clinicFilterOf(useSearchParams().get("filter")) ?? ALL);
  const searched = useDebouncedValue(search.trim());
  const query = useConsoleClinics(searched, shown === ALL ? null : shown);

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={words.places.clinics} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-6">
          <SearchField value={search} onChange={setSearch} placeholder={words.searchClinicsHint} />
          <ChoiceChips label={words.filters} value={shown} options={FILTERS} onChange={setShown} wrap />
          <ListScreen
            query={query}
            loadFailed="CONSOLE_CLINICS_LOAD_FAILED"
            data={query.data}
            empty={<EmptyState icon={Building2} title={words.noClinics} />}
            noMatches={(searched || shown !== ALL) && words.noClinicsMatch}
            renderList={(clinics) => (
              <RowList label={words.places.clinics}>
                {clinics.map((clinic) => (
                  <ClinicRow key={clinic.id} clinic={clinic} />
                ))}
              </RowList>
            )}
          />
        </div>
      </div>
    </>
  );
}

function ClinicRow({ clinic }: { clinic: ConsoleClinic }) {
  return (
    <Row
      href={consoleClinicRoute(clinic.id)}
      title={clinic.name}
      subtitle={`${CLINIC_TYPE_LABELS[clinic.type]} · ${clinic.city} · ${clinic.owner.name}`}
      note={`${words.planUntil(SUBSCRIPTION_PLAN_LABELS[clinic.plan], formatDate(clinic.validUntil))} · ${words.members(clinic.members)}`}
      detail={<ClinicPills clinic={clinic} brief />}
    />
  );
}
