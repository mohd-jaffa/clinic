"use client";

import { ReceiptText } from "lucide-react";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { DateRangeFilter } from "@/components/ui/date-range";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { billRoute } from "@/constants/navigation";
import {
  BILL_LIST_STATE_LABELS,
  BILL_LIST_STATE_TONES,
  BILL_LIST_STATES,
  BILLING_TAB_LABELS,
  type BillListState,
} from "@/constants/statuses";
import { dayKey } from "@/lib/dates/calendar";
import type { DateRange } from "@/lib/dates/range";
import { formatPaise } from "@/lib/format/currency";
import { formatNearDate } from "@/lib/format/date";

import { useBills } from "../hooks/useBills";
import type { BillListItem } from "../types";

const { billing: words } = UI_TEXT;

/** Every state, or one (D320). */
export type BillsShown = BillListState | "ALL";
const STATE_OPTIONS = [
  { value: "ALL" as const, label: words.allStates },
  ...BILL_LIST_STATES.map((state) => ({ value: state, label: BILL_LIST_STATE_LABELS[state] })),
];

/**
 * Billing's Bills (plan §15.4; D320, D335): the bills issued on the days
 * picked — Today to start, 7 days, This month, or From – To — every state
 * or one, newest first, a page at a time. Each row its patient, number and
 * day, total and where it stands, opening its page.
 */
export function BillsList({
  range,
  onRange,
  shown,
  onShown,
}: {
  range: DateRange;
  onRange: (range: DateRange) => void;
  shown: BillsShown;
  onShown: (shown: BillsShown) => void;
}) {
  const query = useBills(range, shown === "ALL" ? undefined : shown);
  return (
    <div className="grid gap-4">
      <DateRangeFilter value={range} onChange={onRange} />
      <ChoiceChips label={words.stateLabel} value={shown} options={STATE_OPTIONS} onChange={onShown} />
      <ListScreen
        query={query}
        loadFailed="BILLS_LOAD_FAILED"
        data={query.data}
        empty={<EmptyState icon={ReceiptText} title={words.billsEmpty} hint={words.billsEmptyHint} />}
        renderList={(bills) => (
          <RowList label={BILLING_TAB_LABELS.BILLS}>
            {bills.map((bill) => (
              <BillRow key={bill.id} bill={bill} />
            ))}
          </RowList>
        )}
      />
    </div>
  );
}

/** A bill (D320): its patient, number and day, total and where it stands — a void one quiet — opening its page. */
function BillRow({ bill }: { bill: BillListItem }) {
  return (
    <Row
      look={bill.state === "VOID" ? "quiet" : "surface"}
      title={bill.patient.name}
      subtitle={words.billLine(bill.number, formatNearDate(dayKey(bill.issuedAt)))}
      detail={
        <span className="flex flex-col items-end gap-1">
          {formatPaise(bill.totalPaise)}
          <StatusPill label={BILL_LIST_STATE_LABELS[bill.state]} tone={BILL_LIST_STATE_TONES[bill.state]} />
        </span>
      }
      href={billRoute(bill.id)}
    />
  );
}
