"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ReceiptIndianRupee } from "lucide-react";
import { createContext, useCallback, useContext, useId, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { LoadFailed } from "@/components/ui/list-screen";
import { MoneyField } from "@/components/ui/money-field";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { useServices } from "@/features/clinic/hooks/useServices";
import type { Service } from "@/features/clinic/types";
import { formatPaise } from "@/lib/format/currency";
import { paiseToText, parseRupees } from "@/lib/money";
import { collectFeeSchema, FORM_RESET_OPTIONS, type CollectFeeInput } from "@/lib/validation";

import { consultationOf, feeBillInput, FIRST_METHOD, priceOf } from "../form";
import { useBillStart } from "../hooks/useBillStart";
import { useIssueBill } from "../hooks/useIssueBill";
import type { BillStart } from "../types";

const { billing: words, queue } = UI_TEXT;
const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }));

/** Who the fee is collected from (D305): their arrival, and the token it gave, when it just did. */
export interface FeeOffer {
  appointmentId: string;
  patientName: string;
  doctorName: string | null;
  token: number | null;
}

const FeeContext = createContext<(offer: FeeOffer) => void>(() => undefined);

/**
 * Where **Collect fee** opens from (plan §11.3; D283, D305, D306): an
 * arrival — **Arrived**, **Add walk-in** — or a patient's appointment, from
 * the queue, the calendar or a profile, each of which closes as it goes on.
 * So the sheet is held here, above every screen.
 */
export function FeeCollectionProvider({ children }: { children: ReactNode }) {
  const [offer, setOffer] = useState<FeeOffer | null>(null);
  const [open, setOpen] = useState(false);
  const offerFee = useCallback((next: FeeOffer) => {
    setOffer(next);
    setOpen(true);
  }, []);
  return (
    <FeeContext.Provider value={offerFee}>
      {children}
      {offer && <CollectFeeSheet key={offer.appointmentId} offer={offer} open={open} onClose={() => setOpen(false)} />}
    </FeeContext.Provider>
  );
}

/** Opens **Collect fee** for an arrival. */
export const useCollectFee = () => useContext(FeeContext);

/**
 * **Collect fee** (D283, D305): after the token — said first — the doctor's
 * consultation fee (D26), a field for whoever may change prices and its
 * read-out for anyone else, the method and a reference; **Issue and
 * collect** issues the consultation bill for the arrival with its payment,
 * in one transaction, and **Skip** leaves it for checkout. A bill that fails
 * never takes the token back.
 */
function CollectFeeSheet({ offer, open, onClose }: { offer: FeeOffer; open: boolean; onClose: () => void }) {
  const startQuery = useBillStart(open ? { appointment: offer.appointmentId } : null);
  const servicesQuery = useServices();
  const start = startQuery.data;
  const services = servicesQuery.data;
  const consultation = services ? consultationOf(services) : null;
  const intro = offer.token !== null && (
    <p className="font-bold text-ink">
      {queue.tokenGiven(offer.patientName, offer.token, offer.doctorName ?? UI_TEXT.appointment.formerDoctor)}
    </p>
  );

  if (start && services && consultation && !start.consultationBilled) {
    return (
      <FeeForm
        open={open}
        onClose={onClose}
        start={start}
        consultation={consultation}
        feePaise={priceOf(consultation, services, start.doctor?.feePaise ?? null)}
        intro={intro}
      />
    );
  }

  let body;
  if (start && services) {
    body = (
      <p className="text-small text-muted">
        {start.consultationBilled ? words.feeAlreadyPaid(offer.patientName) : words.noConsultation}
      </p>
    );
  } else if (startQuery.error != null) {
    body = <LoadFailed query={startQuery} loadFailed="BILL_START_LOAD_FAILED" />;
  } else if (servicesQuery.error != null) {
    body = <LoadFailed query={servicesQuery} loadFailed="SERVICES_LOAD_FAILED" />;
  } else {
    body = (
      <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
        <SkeletonRows rows={2} />
      </section>
    );
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={words.collectFee}
      footer={<Button label={words.skip} variant="secondary" fullWidth onClick={onClose} />}
    >
      <div className="grid gap-4">
        {intro}
        {body}
      </div>
    </Sheet>
  );
}

function FeeForm({
  open,
  onClose,
  start,
  consultation,
  feePaise,
  intro,
}: {
  open: boolean;
  onClose: () => void;
  start: BillStart;
  consultation: Service;
  feePaise: number;
  intro: ReactNode;
}) {
  const { membership } = useAuth();
  const canChangePrice = membership !== null && hasAccess(membership, "payments.discount");
  const formId = useId();
  const form = useForm<CollectFeeInput>({
    resolver: zodResolver(collectFeeSchema) as unknown as Resolver<CollectFeeInput>,
    defaultValues: { fee: paiseToText(feePaise), method: FIRST_METHOD, reference: "" },
    resetOptions: FORM_RESET_OPTIONS,
  });
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const { issue, issuing } = useIssueBill(start, onClose);
  const save = () => issue(feeBillInput(start, consultation, form.getValues()));
  const fee = parseRupees(useWatch({ control, name: "fee" })) ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={words.collectFee}
      footer={
        <div className="grid gap-2">
          <Button
            type="submit"
            form={formId}
            label={words.issueAndCollect}
            icon={ReceiptIndianRupee}
            loading={issuing}
            fullWidth
          />
          <Button label={words.skip} variant="secondary" fullWidth disabled={issuing} onClick={onClose} />
        </div>
      }
    >
      <form id={formId} noValidate className="grid gap-4" onSubmit={form.handleSubmit(save)}>
        {intro}
        {canChangePrice ? (
          <MoneyField label={words.feeLabel} required error={errors.fee?.message} {...register("fee")} />
        ) : (
          <div>
            <p className="mb-1.5 text-small font-bold text-ink">{words.feeLabel}</p>
            <p className="text-title font-bold text-ink tabular-nums">{formatPaise(fee)}</p>
          </div>
        )}
        {fee > 0 && (
          <>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <ChoiceChips
                  label={words.methodLabel}
                  value={field.value}
                  options={METHOD_OPTIONS}
                  onChange={field.onChange}
                  wrap
                />
              )}
            />
            <TextField
              label={words.referenceLabel}
              hint={words.referenceHint}
              autoComplete="off"
              maxLength={TEXT_LIMITS.reference}
              error={errors.reference?.message}
              {...register("reference")}
            />
          </>
        )}
      </form>
    </Sheet>
  );
}
