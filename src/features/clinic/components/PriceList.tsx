"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Row, RowList } from "@/components/ui/row";
import { SearchField } from "@/components/ui/search-field";
import { SectionHeading } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/constants/statuses";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { formatPaise } from "@/lib/format/currency";
import { apiRoutes } from "@/lib/query/keys";

import { ServicesClient } from "../api.client";
import { useCatalogueChange } from "../hooks/useCatalogueChange";
import { useEntryEditor } from "../hooks/useEntryEditor";
import { useServices } from "../hooks/useServices";
import type { Service } from "../types";
import { ArchivedEntries } from "./ArchivedEntries";
import { activeCount, CatalogueScreen } from "./CatalogueScreen";
import { ServiceSheet } from "./ServiceSheet";

const { priceList } = UI_TEXT;

/** An archived service's line: its category and what it cost. */
const describe = (service: Service) =>
  `${SERVICE_CATEGORY_LABELS[service.category]} · ${formatPaise(service.pricePaise)}`;

/**
 * The price list (plan §9, D82), for `settings.manage`: what the clinic
 * charges for, a section per category in the plan's order, each service's
 * name and price; the search finds one by name. A service opens its sheet to
 * be changed or archived; **Add service** adds one. Archived ones wait at the
 * foot to be restored (D80). From 1024 px the categories stand in two
 * columns, the archived ones under the first. In a view-only clinic it is
 * shown, not changed, and says why.
 */
export function PriceList() {
  const query = useServices();
  return (
    <CatalogueScreen
      title={UI_TEXT.settings.items.priceList.label}
      subtitle={query.data && priceList.count(activeCount(query.data))}
      query={query}
      loadFailed="SERVICES_LOAD_FAILED"
    >
      {(services) => <Services services={services} />}
    </CatalogueScreen>
  );
}

function Services({ services }: { services: readonly Service[] }) {
  const { readOnly } = useReadOnly();
  const [search, setSearch] = useState("");
  const editor = useEntryEditor<Service>();
  const { restore, restoring } = useCatalogueChange({
    change: ServicesClient.change,
    list: apiRoutes.services.list,
  });

  const needle = search.trim().toLowerCase();
  const found = services.filter((service) => service.name.toLowerCase().includes(needle));
  const active = found.filter((service) => service.active);
  const sections = SERVICE_CATEGORIES.map((category) => ({
    category,
    services: active.filter((service) => service.category === category),
  })).filter((section) => section.services.length > 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[min(100%,16rem)] flex-1 md:max-w-md">
          <SearchField value={search} onChange={setSearch} placeholder={priceList.search} />
        </div>
        {!readOnly && <Button label={priceList.add} icon={Plus} onClick={editor.add} />}
      </div>
      <ReadOnlyNote />

      {sections.length === 0 ? (
        <p className="py-10 text-center font-bold text-muted">{UI_TEXT.states.noMatches(search.trim())}</p>
      ) : (
        <div className="mt-8 gap-x-10 lg:columns-2">
          {sections.map(({ category, services: inCategory }) => (
            <section
              key={category}
              aria-labelledby={`services-${category}`}
              className="mb-8 break-inside-avoid last:mb-0"
            >
              <SectionHeading id={`services-${category}`} title={SERVICE_CATEGORY_LABELS[category]} />
              <RowList look="menu">
                {inCategory.map((service) => (
                  <Row
                    key={service.id}
                    look="menu"
                    title={service.name}
                    detail={formatPaise(service.pricePaise)}
                    onClick={readOnly ? undefined : () => editor.edit(service)}
                  />
                ))}
              </RowList>
            </section>
          ))}
        </div>
      )}

      <ArchivedEntries
        entries={found.filter((service) => !service.active)}
        describe={describe}
        onRestore={readOnly ? undefined : (service) => void restore(service)}
        restoring={restoring}
        className="mt-8 lg:max-w-[calc(50%-1.25rem)]"
      />
      <ServiceSheet key={editor.key} open={editor.open} onClose={editor.close} service={editor.entry} />
    </>
  );
}
