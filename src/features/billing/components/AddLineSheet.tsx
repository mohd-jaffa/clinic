"use client";

import { PenLine } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Row, RowList } from "@/components/ui/row";
import { SearchField } from "@/components/ui/search-field";
import { SectionHeading } from "@/components/ui/section-heading";
import { Sheet } from "@/components/ui/sheet";
import { UI_TEXT } from "@/constants/messages";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, type ServiceCategory } from "@/constants/statuses";
import type { Service } from "@/features/clinic/types";
import { formatPaise } from "@/lib/format/currency";

const { billing: words } = UI_TEXT;

/** The entries of a category that match what is searched, by name. */
function matching(services: readonly Service[], typed: string, category: ServiceCategory) {
  const sought = typed.trim().toLocaleLowerCase("en-IN");
  return services.filter(
    (service) =>
      service.active &&
      service.category === category &&
      (sought === "" || service.name.toLocaleLowerCase("en-IN").includes(sought)),
  );
}

/**
 * Adding a line (D303): a search over the clinic's price list, its entries
 * grouped by category, each with its price on this bill — the doctor's fee
 * for the consultation (D26). With permission to give discounts, **Type a
 * line** adds one with its own words and price (D284). Picking an entry for
 * a treatment's reminder (D308) offers the price list alone.
 */
export function AddLineSheet({
  open,
  onClose,
  services,
  priceFor,
  pickingFor,
  canType,
  onPick,
  onType,
}: {
  open: boolean;
  onClose: () => void;
  services: readonly Service[];
  /** An entry's price on this bill. */
  priceFor: (service: Service) => number;
  /** The treatment an entry is being picked for, or none. */
  pickingFor: string | null;
  canType: boolean;
  onPick: (service: Service) => void;
  onType: () => void;
}) {
  const [typed, setTyped] = useState("");
  const groups = SERVICE_CATEGORIES.map((category) => ({ category, entries: matching(services, typed, category) }));
  const any = groups.some(({ entries }) => entries.length > 0);
  const empty = !services.some((service) => service.active);
  const close = () => {
    setTyped("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={pickingFor ? words.pickTitle(pickingFor) : words.addLineTitle}>
      <div className="grid gap-5">
        <SearchField value={typed} onChange={setTyped} placeholder={words.searchPriceList} />
        {empty ? (
          <p className="text-small text-muted">{words.emptyPriceList}</p>
        ) : any ? (
          groups.map(({ category, entries }) =>
            entries.length === 0 ? null : (
              <Group key={category} title={SERVICE_CATEGORY_LABELS[category]}>
                {entries.map((service) => (
                  <Row
                    key={service.id}
                    look="menu"
                    title={service.name}
                    subtitle={<span className="tabular-nums">{formatPaise(priceFor(service))}</span>}
                    onClick={() => {
                      onPick(service);
                      close();
                    }}
                  />
                ))}
              </Group>
            ),
          )
        ) : (
          <p className="text-small text-muted">{words.noMatches}</p>
        )}
        {canType && !pickingFor && (
          <div className="grid justify-items-start gap-2 border-t border-line pt-4">
            <p className="text-small font-bold text-ink">{words.typedTitle}</p>
            <Button
              label={words.addTyped}
              icon={PenLine}
              variant="secondary"
              size="sm"
              onClick={() => {
                onType();
                close();
              }}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** One category's entries, under its name. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={title} />
      <RowList label={title} look="menu">
        {children}
      </RowList>
    </section>
  );
}
