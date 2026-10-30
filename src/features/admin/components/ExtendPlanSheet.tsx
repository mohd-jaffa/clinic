"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus } from "lucide-react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { DateField } from "@/components/ui/date-field";
import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyField } from "@/components/ui/money-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import {
  EXTENSION_KIND_LABELS,
  EXTENSION_KINDS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type ExtensionKind,
} from "@/constants/statuses";
import { periodEnd } from "@/features/subscription/state";
import { isDayKey, todayKey } from "@/lib/dates/calendar";
import { formatDate } from "@/lib/format/date";
import { paiseToText, parseRupees } from "@/lib/money";
import { extendPlanSchema, FORM_RESET_OPTIONS, type ExtendPlanInput, type ExtendPlanPayload } from "@/lib/validation";

import { useExtendPlan } from "../hooks/useExtendPlan";
import type { ConsoleClinicDetail } from "../types";

const { console: words } = UI_TEXT;
const KIND_OPTIONS = EXTENSION_KINDS.map((kind) => ({ value: kind, label: EXTENSION_KIND_LABELS[kind] }));
const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }));

/** What the amount starts as for a kind: its live price; nothing for a date set by hand (D374). */
function priceOf(kind: ExtensionKind, { prices }: ConsoleClinicDetail): string {
  if (kind === "CUSTOM") return paiseToText(0);
  return paiseToText(kind === "MONTHLY" ? prices.monthlyPaise : prices.yearlyPaise);
}

/** A month at the live price, paid today by UPI — how the Plan screen asks owners to pay (D364, D373). */
const blank = (clinic: ConsoleClinicDetail): ExtendPlanInput => ({
  kind: "MONTHLY",
  amount: priceOf("MONTHLY", clinic),
  paidOn: todayKey(),
  method: "UPI",
  reference: "",
  validUntil: "",
  reason: "",
});

/**
 * Extend plan (plan §7.4; D373, D374): one sheet, the kind on top — Monthly
 * · Yearly · Set date — and the day it will run to under it, from the plan's
 * last day, as the database works it out. Monthly and Yearly are money
 * received: the amount starts at the live price, then the day paid and how,
 * and a reference. Set date takes the day and a reason, at ₹0 unless money
 * came, when it asks how and when too. Then the card asks first.
 */
export function ExtendPlanSheet({
  clinic,
  open,
  onClose,
}: {
  clinic: ConsoleClinicDetail;
  open: boolean;
  onClose: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    getFieldState,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ExtendPlanInput, unknown, ExtendPlanPayload>({
    // The form is held as typed; what is sent is read once more by the route.
    resolver: zodResolver(extendPlanSchema) as Resolver<ExtendPlanInput, unknown, ExtendPlanPayload>,
    defaultValues: blank(clinic),
    resetOptions: FORM_RESET_OPTIONS,
  });
  const [kind, amount, setDate] = useWatch({ control, name: ["kind", "amount", "validUntil"] });
  const custom = kind === "CUSTOM";
  // The amount is held from the start (`blank`); what cannot be read yet is no money.
  const paid = !custom || (parseRupees(amount!) ?? 0) > 0;
  const lastDay = custom ? (isDayKey(setDate) ? setDate : null) : periodEnd(kind, clinic.validUntil, todayKey());

  const extending = useExtendPlan(clinic, () => {
    reset(blank(clinic));
    onClose();
  });

  const choose = (next: ExtensionKind) => {
    setValue("kind", next);
    // The kind's price, until an amount of one's own is typed.
    if (!getFieldState("amount").isDirty) setValue("amount", priceOf(next, clinic));
  };

  return (
    <FormSheet
      open={open}
      title={words.extendFor(clinic.name)}
      onClose={onClose}
      onSubmit={handleSubmit((payload) => extending.extend(getValues(), payload, lastDay!))}
      submitLabel={words.extend}
      submitIcon={CalendarPlus}
      submitting={extending.submitting}
    >
      <SegmentedControl label={words.kindLabel} value={kind} options={KIND_OPTIONS} onChange={choose} />
      {custom ? (
        <Controller
          control={control}
          name="validUntil"
          render={({ field }) => (
            <DateField
              ref={field.ref}
              label={words.newLastDayLabel}
              required
              hint={words.nowUntil(formatDate(clinic.validUntil))}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.validUntil?.message}
            />
          )}
        />
      ) : (
        <p className="text-body text-ink">
          <span className="font-bold">{words.newLastDay(formatDate(lastDay))}</span>
          <span className="block text-small text-muted">{words.nowUntil(formatDate(clinic.validUntil))}</span>
        </p>
      )}
      <MoneyField
        label={words.amountLabel}
        required={!custom}
        hint={custom ? words.freeAmountHint : words.amountHint}
        error={errors.amount?.message}
        {...register("amount")}
      />
      {paid && (
        <>
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
      <TextField
        label={words.reasonLabel}
        hint={words.reasonHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.reason}
        required={custom}
        optional={!custom}
        error={errors.reason?.message}
        {...register("reason")}
      />
    </FormSheet>
  );
}
