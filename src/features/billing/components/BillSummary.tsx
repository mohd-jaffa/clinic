"use client";

import { ReceiptIndianRupee } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { cn } from "@/components/ui/cn";
import { MoneyField } from "@/components/ui/money-field";
import { Panel } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { DISCOUNT_KINDS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { paiseToText } from "@/lib/money";

import { balanceWords, collectedOf, previewOf, type BillForm } from "../form";
import { Figure } from "./Figure";

const { billing: words } = UI_TEXT;
const DISCOUNT_OPTIONS = (["NONE", ...DISCOUNT_KINDS] as const).map((kind) => ({
  value: kind,
  label: words.discountKinds[kind],
}));
const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }));

/**
 * The bill's totals and what is collected (plan §15.2; D290 – D293, D304,
 * D310): the live preview — subtotal, the discount for whoever may give one
 * (an amount or a whole percentage, shown as the amount), the total, and the
 * patient's balance now and after — then **Collect now**, on, filled with
 * the total until an amount is typed, in Cash; a reference. **Issue bill**
 * ends it: on a desktop in this column, which stays in view; on a phone or a
 * tablet on a bar held at the foot, with the total beside it.
 */
export function BillSummary({
  form,
  formId,
  balancePaise,
  canDiscount,
  issuing,
  disabled,
  notice,
}: {
  form: UseFormReturn<BillForm>;
  formId: string;
  balancePaise: number;
  canDiscount: boolean;
  issuing: boolean;
  /** Nothing can be issued: a view-only clinic. */
  disabled: boolean;
  /** Why, under the button. */
  notice?: ReactNode;
}) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = form;
  const [lines, discount, collect] = useWatch({ control, name: ["lines", "discount", "collect"] });
  const totals = previewOf({ lines, discount });
  const owing = totals.total > 0;
  const collected = owing
    ? collectedOf({ ...collect, amount: collect.typed ? collect.amount : paiseToText(totals.total) })
    : 0;
  const discountId = useId();

  return (
    <Panel title={words.totalsTitle} className="lg:sticky lg:top-6">
      <dl className="grid gap-2">
        <Figure label={words.subtotal} value={formatPaise(totals.subtotal)} />
      </dl>
      {canDiscount && (
        <div role="group" aria-labelledby={discountId} className="grid gap-3">
          <p id={discountId} className="text-small font-bold text-ink">
            {words.discountTitle}
          </p>
          <Controller
            control={control}
            name="discount.kind"
            render={({ field }) => (
              <SegmentedControl
                label={words.discountKindLabel}
                value={field.value}
                options={DISCOUNT_OPTIONS}
                onChange={field.onChange}
              />
            )}
          />
          {discount.kind === "AMOUNT" && (
            <MoneyField
              label={words.discountAmountLabel}
              error={errors.discount?.amount?.message}
              {...register("discount.amount")}
            />
          )}
          {discount.kind === "PERCENT" && (
            <TextField
              label={words.discountPercentLabel}
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              trailing={<span className="text-muted">%</span>}
              error={errors.discount?.percent?.message}
              {...register("discount.percent")}
            />
          )}
        </div>
      )}
      <dl className="grid gap-2">
        {totals.discount > 0 && <Figure label={words.discount} value={`−${formatPaise(totals.discount)}`} />}
        <Figure label={words.total} value={formatPaise(totals.total)} lead />
        <Figure label={words.balanceNow} value={balanceWords(balancePaise)} />
        <Figure label={words.balanceAfter} value={balanceWords(balancePaise + totals.total - collected)} />
      </dl>
      {owing && (
        <div className="grid gap-3 border-t border-line pt-3">
          <Checkbox label={words.collectNow} {...register("collect.on")} />
          {collect.on && (
            <>
              <Controller
                control={control}
                name="collect.amount"
                render={({ field }) => (
                  <MoneyField
                    ref={field.ref}
                    label={words.amountLabel}
                    required
                    name={field.name}
                    // Until an amount is typed, it is the total (D304).
                    value={collect.typed ? field.value : paiseToText(totals.total)}
                    onChange={(event) => {
                      setValue("collect.typed", true);
                      field.onChange(event.target.value);
                    }}
                    onBlur={field.onBlur}
                    error={errors.collect?.amount?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="collect.method"
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
                error={errors.collect?.reference?.message}
                {...register("collect.reference")}
              />
            </>
          )}
        </div>
      )}
      <div
        className={cn(
          "z-20 flex items-center gap-3",
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(var(--bottom-bar-offset)+var(--safe-bottom))]",
          "max-lg:border-t max-lg:border-line max-lg:bg-ground max-lg:py-3",
          "max-lg:pr-[calc(1rem+var(--safe-right))] max-lg:pl-[calc(1rem+var(--safe-left))]",
          "md:max-lg:left-[calc(6.5rem+var(--safe-left))] md:max-lg:px-8",
        )}
      >
        {/* The total again, beside the button on the bar: the panel above already says it to a screen reader. */}
        <p aria-hidden="true" className="text-title font-bold whitespace-nowrap text-ink tabular-nums lg:hidden">
          {formatPaise(totals.total)}
        </p>
        <Button
          type="submit"
          form={formId}
          label={words.issue}
          icon={ReceiptIndianRupee}
          loading={issuing}
          disabled={disabled}
          fullWidth
        />
      </div>
      {notice}
    </Panel>
  );
}
