"use client";

import { ReceiptIndianRupee } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { RowList } from "@/components/ui/row";
import { UI_TEXT } from "@/constants/messages";
import { BILL_FROM } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { BILLING_TAB_LABELS } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useOpened } from "@/hooks/useOpened";

import { useToBill } from "../hooks/useToBill";
import type { ToBillVisit } from "../types";
import { ToBillPanel } from "./ToBillPanel";
import { ToBillRow } from "./ToBillRow";

const { billing: words } = UI_TEXT;

/**
 * Billing's To bill (plan §15.6; D318, D319): every doctor's visits waiting
 * to be billed, from any day, oldest first, a page at a time; each opens its
 * sheet — Bill, leading back here, or No charge.
 */
export function ToBillList() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const query = useToBill();
  const opened = useOpened<ToBillVisit>();
  const canBill = membership !== null && hasAccess(membership, "payments.create") && !readOnly;
  return (
    <>
      <ListScreen
        query={query}
        loadFailed="TO_BILL_LOAD_FAILED"
        data={query.data}
        empty={<EmptyState icon={ReceiptIndianRupee} title={words.toBillEmpty} hint={words.toBillEmptyHint} />}
        renderList={(visits) => (
          <RowList label={BILLING_TAB_LABELS.TO_BILL}>
            {visits.map((visit) => (
              <ToBillRow key={visit.visitId} visit={visit} showDoctor canBill={canBill} onOpen={opened.show} />
            ))}
          </RowList>
        )}
      />
      <ToBillPanel
        key={opened.item?.visitId}
        visit={opened.item}
        open={opened.open}
        onClose={opened.close}
        from={BILL_FROM.billing}
      />
    </>
  );
}
