"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ReceiptIndianRupee } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";

import { LinkButton } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { ScreenNotice } from "@/components/ui/screen-notice";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TextAreaField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { BILL_FROM, BILL_REISSUE, newBillRoute, type BillFrom } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { PatientPicker } from "@/features/appointments/components/PatientPicker";
import { useAuth } from "@/features/auth/AuthProvider";
import { useServices } from "@/features/clinic/hooks/useServices";
import type { Service } from "@/features/clinic/types";
import { describePatient } from "@/features/patients/describe";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { formatDayMonth } from "@/lib/format/date";
import { billSchema } from "@/lib/validation";

import { billStartKey, billTargetOf, reissueOf } from "../keys";
import {
  billBackOf,
  billFromOf,
  blankBill,
  priceOf,
  reissuedBill,
  serviceLine,
  toBillInput,
  type BillForm,
} from "../form";
import { useBill } from "../hooks/useBill";
import { useBillStart } from "../hooks/useBillStart";
import { useIssueBill } from "../hooks/useIssueBill";
import type { BillDetail, BillStart } from "../types";
import { AddLineSheet } from "./AddLineSheet";
import { BillLines } from "./BillLines";
import { BillSummary } from "./BillSummary";

const { billing: words, patients } = UI_TEXT;

/** What the bill is for, under the patient (D310): the visit and its doctor, or the arrival's token. */
function forLine(start: BillStart): string | undefined {
  const doctor = start.doctor?.name ?? words.noDoctor;
  if (start.visit) return words.forVisit(formatDayMonth(start.visit.day), doctor);
  if (start.appointment) return words.forArrival(start.appointment.token, doctor);
  return undefined;
}

/**
 * A new bill — `/billing/new` (plan §15.2; D302 – D313): for a visit, an
 * arrival or a patient, or — with none named — someone searched for first
 * (D313). It starts with what it bills (`startingLines`) — or, issuing a
 * void bill again, with that bill's lines (D314) — lines are added
 * from the price list (D303), and **Issue bill** issues it with what is
 * collected, without asking first (D312), then goes back where it was
 * started from with a card (D302). Lines on the left and the totals on the
 * right on a desktop; stacked, with Issue held at the foot, on a phone
 * (D310).
 */
export function NewBill() {
  const params = useSearchParams();
  const router = useRouter();
  const target = billTargetOf((name) => params.get(name));
  const from = billFromOf(params.get(BILL_FROM.param));
  const reissue = reissueOf(params.get(BILL_REISSUE));
  const startQuery = useBillStart(target);
  const servicesQuery = useServices();
  const reissuedQuery = useBill(target && reissue);
  const start = startQuery.data;
  const services = servicesQuery.data;
  const reissued = reissuedQuery.data;
  const back = billBackOf(target, from, start?.patient.id);

  let body;
  if (target === null) {
    body = (
      <div className="max-w-xl">
        <PatientPicker
          chosen={null}
          onChoose={(patient) => router.replace(newBillRoute({ patient: patient.id }, from))}
        />
      </div>
    );
  } else if (start && services && (reissue === null || reissued)) {
    body = start.patient.archived ? (
      <ScreenNotice>{words.archived(start.patient.name)}</ScreenNotice>
    ) : (
      <BillEditor
        key={`${billStartKey(target)}:${reissue}`}
        start={start}
        services={services}
        reissued={reissued ?? null}
        back={back}
        from={from}
      />
    );
  } else if (startQuery.error != null) {
    body = <LoadFailed query={startQuery} loadFailed="BILL_START_LOAD_FAILED" />;
  } else if (servicesQuery.error != null) {
    body = <LoadFailed query={servicesQuery} loadFailed="SERVICES_LOAD_FAILED" />;
  } else if (reissuedQuery.error != null) {
    body = <LoadFailed query={reissuedQuery} loadFailed="BILL_LOAD_FAILED" />;
  } else {
    body = (
      <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
        <SkeletonRows rows={3} />
      </section>
    );
  }

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={words.newBill}
            subtitle={start && `${start.patient.name} · ${describePatient(start.patient)}`}
            detail={start && forLine(start)}
            back={back}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">{body}</div>
    </>
  );
}

/**
 * The bill as it is put together: the lines and notes, the totals and what
 * is collected. Its form is read the way it is sent (`toBillInput`), so a
 * field's message lands under the field.
 */
function BillEditor({
  start,
  services,
  reissued,
  back,
  from,
}: {
  start: BillStart;
  services: readonly Service[];
  /** A void bill issued again, its lines filling this one (D314). */
  reissued: BillDetail | null;
  back: string;
  from: BillFrom | undefined;
}) {
  const router = useRouter();
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const canDiscount = membership !== null && hasAccess(membership, "payments.discount");
  const formId = useId();
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const form = useForm<BillForm>({
    resolver: ((values, context, options) =>
      (zodResolver(billSchema) as unknown as Resolver<BillForm>)(
        toBillInput(values) as unknown as BillForm,
        context,
        options,
      )) as Resolver<BillForm>,
    defaultValues: reissued ? reissuedBill(start, services, reissued) : blankBill(start, services),
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const { issue, issuing } = useIssueBill(start, () => router.replace(back));
  const feePaise = start.doctor?.feePaise ?? null;
  const priceFor = (service: Service) => priceOf(service, services, feePaise);
  const pickingLine = picking === null ? undefined : form.getValues(`lines.${picking}`);
  const pickingFor = pickingLine?.kind === "PICK" ? pickingLine.name : null;

  /** An entry from the sheet: a new line — or, for a treatment's reminder, the line it asked for (D308). */
  const take = (service: Service) => {
    if (pickingLine?.kind === "PICK" && picking !== null) {
      lines.update(
        picking,
        serviceLine(service, priceFor(service), { id: pickingLine.treatmentId, name: pickingLine.name }),
      );
    } else {
      lines.append(serviceLine(service, priceFor(service)), { shouldFocus: false });
    }
  };

  return (
    <div className="grid gap-6">
      {start.toBill && (
        <div className="grid justify-items-start gap-3 rounded-row bg-surface p-4 sm:p-5">
          <p className="font-bold text-ink">
            {patients.hasVisitToBill(start.patient.name, formatDayMonth(start.toBill.day))}
          </p>
          <LinkButton
            href={newBillRoute({ visit: start.toBill.visitId }, from ?? BILL_FROM.patient)}
            label={words.billThatVisit}
            icon={ReceiptIndianRupee}
            variant="secondary"
            size="sm"
          />
        </div>
      )}
      <form
        id={formId}
        noValidate
        onSubmit={form.handleSubmit(() => issue(toBillInput(form.getValues())))}
        // Below a desktop, room at the foot for the Issue bar fixed over it (D310).
        className="grid grid-cols-1 items-start gap-6 max-lg:pb-24 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      >
        <div className="grid min-w-0 gap-6">
          <BillLines
            form={form}
            lines={lines}
            canChangePrices={canDiscount}
            onAdd={() => setAdding(true)}
            onPick={(index) => setPicking(index)}
          />
          <TextAreaField
            label={words.notesLabel}
            rows={2}
            autoComplete="off"
            maxLength={TEXT_LIMITS.notes}
            error={form.formState.errors.notes?.message}
            {...form.register("notes")}
          />
        </div>
        <BillSummary
          form={form}
          formId={formId}
          balancePaise={start.balancePaise}
          canDiscount={canDiscount}
          issuing={issuing}
          disabled={readOnly}
          notice={<ReadOnlyNote />}
        />
      </form>
      <AddLineSheet
        open={adding || picking !== null}
        onClose={() => {
          setAdding(false);
          setPicking(null);
        }}
        services={services}
        priceFor={priceFor}
        pickingFor={pickingFor}
        canType={canDiscount}
        onPick={take}
        onType={() =>
          lines.append(
            { kind: "TYPED", description: "", quantity: 1, price: "" },
            {
              focusName: `lines.${lines.fields.length}.description`,
            },
          )
        }
      />
    </div>
  );
}
