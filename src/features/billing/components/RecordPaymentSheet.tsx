"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IndianRupee, Undo2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { DateField } from "@/components/ui/date-field";
import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyField } from "@/components/ui/money-field";
import { Row, RowList } from "@/components/ui/row";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentKind } from "@/constants/statuses";
import { PatientPicker, type ChosenPatient } from "@/features/appointments/components/PatientPicker";
import { describePatient } from "@/features/patients/describe";
import { todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { paiseToText } from "@/lib/money";
import { FORM_RESET_OPTIONS, paymentSchema, type PaymentInput } from "@/lib/validation";

import { balanceWords, FIRST_METHOD } from "../form";
import { useRecordPayment } from "../hooks/useRecordPayment";

const { payment: words } = UI_TEXT;
const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }));

/** Who a payment is from, or a refund to: enough to tell one of a family from another, and their balance. */
export type PayingPatient = ChosenPatient & { balancePaise: number };

/**
 * What the amount starts as (D322, D324): what is owed — or, for a refund,
 * the advance held — unless the sheet was opened with an amount (a bill's
 * due, D314); empty when there is none.
 */
function startingAmount(kind: PaymentKind, patient: PayingPatient | null, amountPaise?: number): string {
  const owed = patient === null ? 0 : kind === "REFUND" ? -patient.balancePaise : patient.balancePaise;
  const paise = amountPaise ?? owed;
  return paise > 0 ? paiseToText(paise) : "";
}

/**
 * Record payment, or Refund (plan §15.3; D322 – D324, D334). Opened for no
 * one — from Billing or the ＋ — it searches for the patient first; the one
 * picked shows their balance and fills the amount with what they owe (D323,
 * D324). Opened for a patient — their profile, Outstanding, a bill — it
 * names them. A payment is paid on a day, today unless changed, never later
 * (D334); its method, a reference and a note. A refund hands back no more
 * than the advance held (D297, D322): the amount, the method and a
 * reference. Sent twice, it records once.
 */
export function RecordPaymentSheet({
  open,
  onClose,
  patient: fixed = null,
  kind = "PAYMENT",
  amountPaise,
  billId,
}: {
  open: boolean;
  onClose: () => void;
  /** Who it is for, when known; none to search. */
  patient?: PayingPatient | null;
  kind?: PaymentKind;
  /** What the amount starts as, in place of what is owed. */
  amountPaise?: number;
  /** The bill it is recorded from, read again once it is (D314). */
  billId?: string;
}) {
  const refund = kind === "REFUND";
  const [chosen, setChosen] = useState<PayingPatient | null>(null);
  const patient = fixed ?? chosen;
  const blank = (who: PayingPatient | null): PaymentInput => ({
    patientId: who?.id ?? "",
    kind,
    amount: startingAmount(kind, who, amountPaise),
    paidOn: todayKey(),
    method: FIRST_METHOD,
    reference: "",
    note: "",
  });

  const {
    register,
    control,
    handleSubmit,
    getValues,
    getFieldState,
    setValue,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<PaymentInput>({
    // The form is held as typed; what is sent is read once more by the route.
    resolver: zodResolver(paymentSchema) as unknown as Resolver<PaymentInput>,
    defaultValues: blank(fixed),
    resetOptions: FORM_RESET_OPTIONS,
  });

  const recording = useRecordPayment({
    kind,
    patient,
    billId,
    onDone: () => {
      setChosen(null);
      reset(blank(fixed));
      onClose();
    },
  });

  const choose = (who: PayingPatient | null) => {
    setChosen(who);
    setValue("patientId", who?.id ?? "", { shouldValidate: isSubmitted });
    // What they owe, until an amount of one's own is typed (D324).
    if (!getFieldState("amount").isDirty) setValue("amount", startingAmount(kind, who, amountPaise));
  };

  return (
    <FormSheet
      open={open}
      title={refund ? words.refundTitle : words.title}
      onClose={onClose}
      onSubmit={handleSubmit(() => recording.record(getValues(), patient!.name))}
      submitLabel={refund ? words.refund : words.record}
      submitIcon={refund ? Undo2 : IndianRupee}
      submitting={recording.submitting}
    >
      <div className="grid gap-2">
        {fixed ? (
          <RowList label={UI_TEXT.appointments.patientLabel} look="menu">
            <Row look="menu" title={fixed.name} subtitle={describePatient(fixed)} />
          </RowList>
        ) : (
          <PatientPicker
            chosen={chosen}
            onChoose={choose}
            onClear={() => choose(null)}
            error={errors.patientId?.message}
          />
        )}
        {patient && <p className="text-small text-muted">{words.balance(balanceWords(patient.balancePaise))}</p>}
      </div>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <MoneyField
            ref={field.ref}
            label={words.amountLabel}
            required
            // A refund is opened for a patient, never searched for (D322).
            hint={refund ? words.refundHint(formatPaise(-patient!.balancePaise)) : words.amountHint}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.amount?.message}
          />
        )}
      />
      {!refund && (
        <Controller
          control={control}
          name="paidOn"
          render={({ field }) => (
            <DateField
              ref={field.ref}
              label={words.paidOnLabel}
              required
              value={field.value}
              max={todayKey()}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.paidOn?.message}
            />
          )}
        />
      )}
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
      {!refund && (
        <TextField
          label={words.noteLabel}
          autoComplete="off"
          maxLength={TEXT_LIMITS.paymentNote}
          error={errors.note?.message}
          {...register("note")}
        />
      )}
    </FormSheet>
  );
}
