"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { formatPaise } from "@/lib/format/currency";
import { FORM_RESET_OPTIONS, voidBillSchema, type VoidBillInput, type VoidBillPayload } from "@/lib/validation";

import { useVoidBill } from "../hooks/useVoidBill";
import type { BillDetail } from "../types";

const { bill: words } = UI_TEXT;

/**
 * Why a bill is voided (plan §15.2; D314): one line, then the coral card
 * asks first (AGENTS.md §23). Voided, the sheet closes with a card.
 */
export function VoidBillSheet({ bill, open, onClose }: { bill: BillDetail; open: boolean; onClose: () => void }) {
  const voiding = useVoidBill(bill, onClose);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VoidBillInput, unknown, VoidBillPayload>({
    resolver: zodResolver(voidBillSchema) as Resolver<VoidBillInput, unknown, VoidBillPayload>,
    defaultValues: { reason: "" },
    resetOptions: FORM_RESET_OPTIONS,
  });

  return (
    <FormSheet
      open={open}
      title={words.voidTitle}
      onClose={onClose}
      onSubmit={handleSubmit(({ reason }) => voiding.void(reason))}
      submitting={voiding.submitting}
      submitLabel={words.void}
      submitIcon={Ban}
      submitVariant="danger"
    >
      <p className="text-body text-ink">
        <span className="font-bold">{words.titleOf(bill.number)}</span>
        <span className="block text-small text-muted">{`${bill.patient.name} · ${formatPaise(bill.totalPaise)}`}</span>
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
