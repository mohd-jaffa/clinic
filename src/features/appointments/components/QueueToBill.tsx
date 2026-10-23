"use client";

import { Button } from "@/components/ui/button";
import { LoadFailed } from "@/components/ui/list-screen";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { BILL_FROM, QUEUE_TO_BILL } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { ToBillPanel } from "@/features/billing/components/ToBillPanel";
import { ToBillRow } from "@/features/billing/components/ToBillRow";
import { useToBill } from "@/features/billing/hooks/useToBill";
import type { ToBillVisit } from "@/features/billing/types";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useOpened } from "@/hooks/useOpened";

import { QueueSection } from "./QueueRows";

const { queue } = UI_TEXT;

/**
 * The queue's To bill (plan §15.6; D318, D339, D340), after With doctor: the
 * visits waiting to be billed — the doctor's whose queue is shown, or every
 * doctor's — from any day, oldest first, a page at a time, read again with
 * the queue; the section the land's pin jumps to. It counts `total`, how
 * many wait, once the rows agree there are some. Each row, and its **Bill**,
 * opens its sheet: Bill — the new bill, leading back to the queue — or No
 * charge.
 */
export function QueueToBill({ doctorId, total }: { doctorId: string; total?: number }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const query = useToBill(doctorId || undefined, { beside: true });
  const opened = useOpened<ToBillVisit>();
  const canBill = membership !== null && hasAccess(membership, "payments.create") && !readOnly;
  const visits = query.data ?? [];

  let state;
  if (query.data === undefined) {
    state =
      query.error != null ? <LoadFailed query={query} loadFailed="TO_BILL_LOAD_FAILED" /> : <SkeletonRows rows={2} />;
  }

  return (
    <>
      <QueueSection
        id={QUEUE_TO_BILL}
        title={queue.toBill}
        count={visits.length === 0 ? 0 : Math.max(total ?? 0, visits.length)}
        empty={queue.noneToBill}
        state={state}
        footer={
          query.hasMore && (
            <div className="mt-3 flex justify-center">
              <Button
                label={UI_TEXT.actions.showMore}
                variant="secondary"
                size="sm"
                loading={query.loadingMore}
                onClick={query.loadMore}
              />
            </div>
          )
        }
      >
        {visits.map((visit) => (
          <ToBillRow key={visit.visitId} visit={visit} showDoctor={!doctorId} canBill={canBill} onOpen={opened.show} />
        ))}
      </QueueSection>
      <ToBillPanel
        key={opened.item?.visitId}
        visit={opened.item}
        open={opened.open}
        onClose={opened.close}
        from={BILL_FROM.queue}
      />
    </>
  );
}
