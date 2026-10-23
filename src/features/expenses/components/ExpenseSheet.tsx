"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Wallet } from "lucide-react";
import { Controller, useForm, type Resolver } from "react-hook-form";

import { ArchiveButton } from "@/components/ui/archive-button";
import { ChoiceField } from "@/components/ui/choice-field";
import { DateField } from "@/components/ui/date-field";
import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyField } from "@/components/ui/money-field";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/constants/statuses";
import type { ExpenseCategory } from "@/features/clinic/types";
import { todayKey } from "@/lib/dates/calendar";
import { paiseToText } from "@/lib/money";
import { expenseSchema, FORM_RESET_OPTIONS, type ExpenseInput } from "@/lib/validation";

import { useArchiveExpense } from "../hooks/useArchiveExpense";
import { useSaveExpense } from "../hooks/useSaveExpense";
import type { Expense } from "../types";

const { expenses: words } = UI_TEXT;
const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }));

/** An expense's form as it opens: a new one blank, today, in cash; one corrected as it is. */
function blankOf(expense: Expense | null): ExpenseInput {
  return expense
    ? {
        categoryId: expense.category.id,
        amount: paiseToText(expense.amountPaise),
        day: expense.day,
        method: expense.method,
        description: expense.description ?? "",
      }
    : { categoryId: "", amount: "", day: todayKey(), method: PAYMENT_METHODS[0], description: "" };
}

/**
 * Add expense, or one corrected (plan §16; D328, D329, D333, D343, D344):
 * its category as wrapping chips — none chosen to start, so it must be
 * picked — the amount, the day (today unless changed, never after it), how
 * it was paid and what it was for, if the category does not say. A
 * correction keeps its category though archived since, and has **Archive**
 * at its foot, asked first. Sent twice, it adds once. The screen keys it by
 * the expense, so each opens afresh.
 */
export function ExpenseSheet({
  open,
  onClose,
  expense = null,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  /** The expense corrected; none to add one. */
  expense?: Expense | null;
  categories: readonly ExpenseCategory[];
}) {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ExpenseInput>({
    // The form is held as typed; what is sent is read once more by the route.
    resolver: zodResolver(expenseSchema) as unknown as Resolver<ExpenseInput>,
    defaultValues: blankOf(expense),
    resetOptions: FORM_RESET_OPTIONS,
  });
  const saving = useSaveExpense({
    expense,
    onDone: () => {
      reset(blankOf(expense));
      onClose();
    },
  });
  const archiving = useArchiveExpense();
  // The categories in use — and a corrected expense's own, archived since.
  const options = categories
    .filter((category) => category.active || category.id === expense?.category.id)
    .map((category) => ({ value: category.id, label: category.name }));
  const nameOf = (id: string) => options.find((option) => option.value === id)!.label;

  return (
    <FormSheet
      open={open}
      title={expense ? words.editTitle : words.addTitle}
      onClose={onClose}
      onSubmit={handleSubmit(() => saving.save(getValues(), nameOf(getValues("categoryId"))))}
      submitLabel={words.save}
      submitIcon={Wallet}
      submitting={saving.submitting}
    >
      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <ChoiceField
            label={words.categoryLabel}
            required
            value={field.value}
            options={options}
            onChange={field.onChange}
            error={errors.categoryId?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <MoneyField
            ref={field.ref}
            label={words.amountLabel}
            required
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.amount?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="day"
        render={({ field }) => (
          <DateField
            ref={field.ref}
            label={words.dateLabel}
            required
            value={field.value}
            max={todayKey()}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.day?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="method"
        render={({ field }) => (
          <ChoiceField
            label={words.methodLabel}
            value={field.value}
            options={METHOD_OPTIONS}
            onChange={field.onChange}
          />
        )}
      />
      <TextField
        label={words.descriptionLabel}
        hint={words.descriptionHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.expenseDescription}
        error={errors.description?.message}
        {...register("description")}
      />
      {expense && (
        <ArchiveButton
          archive={() => archiving.archive(expense)}
          archiving={archiving.archiving}
          onArchived={onClose}
        />
      )}
    </FormSheet>
  );
}
