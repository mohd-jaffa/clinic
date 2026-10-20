"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_KIND_LABELS } from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import {
  FORM_RESET_OPTIONS,
  voidPaymentSchema,
  type VoidPaymentInput,
  type VoidPaymentPayload,
} from "@/lib/validation";

import { useVoidPayment } from "../hooks/useVoidPayment";
import type { Payment } from "../types";

const { payment: words } = UI_TEXT;

/**
 * Why a payment or a refund is voided (plan §15.3; D336): one line, then the
 * coral card asks first (AGENTS.md §23). Closing it goes back to the
 * payment; voided, everything closes with a card.
 */
export function VoidPaymentSheet({
  payment,
  open,
  onClose,
  onDone,
}: {
  payment: Payment;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const voiding = useVoidPayment(payment, onDone);
  const refund = payment.kind === "REFUND";
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VoidPaymentInput, unknown, VoidPaymentPayload>({
    resolver: zodResolver(voidPaymentSchema) as Resolver<VoidPaymentInput, unknown, VoidPaymentPayload>,
    defaultValues: { reason: "" },
    resetOptions: FORM_RESET_OPTIONS,
  });

  return (
    <FormSheet
      open={open}
      title={refund ? words.voidRefund : words.void}
      onClose={onClose}
      onSubmit={handleSubmit(({ reason }) => voiding.void(reason))}
      submitting={voiding.submitting}
      submitLabel={refund ? words.voidRefund : words.void}
      submitIcon={Ban}
      submitVariant="danger"
    >
      <p className="text-body text-ink">
        <span className="font-bold">{`${PAYMENT_KIND_LABELS[payment.kind]} · ${formatPaise(payment.amountPaise)}`}</span>
        <span className="block text-small text-muted">{payment.patient.name}</span>
      </p>
      <TextField
        label={words.voidReasonLabel}
        hint={words.voidReasonHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.reason}
        required
        error={errors.reason?.message}
        {...register("reason")}
      />
    </FormSheet>
  );
}
