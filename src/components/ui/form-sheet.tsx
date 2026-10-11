"use client";

import { Check, type LucideIcon } from "lucide-react";
import { useId, type ReactNode, type RefObject } from "react";

import { UI_TEXT } from "@/constants/messages";

import { Button, type ButtonVariant } from "./button";
import { Sheet } from "./sheet";

/**
 * The sheet a record is created or edited in (plan §31.2), ported from Brio:
 * a `Sheet` holding a form, its submit capsule pinned in the foot — outside
 * the scrolling body, reaching the form through its id. The form stays
 * mounted while the sheet is closed, so nothing typed is lost (D55). A
 * refusal about a field sits beside it; any other is a response card over the
 * sheet, which stays open beneath it to be put right. Focus goes to its first
 * typed field, or `initialFocus` where that is not the first to fill.
 */
export function FormSheet({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = UI_TEXT.actions.save,
  submitIcon = Check,
  submitVariant = "primary",
  submitting = false,
  initialFocus,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitIcon?: LucideIcon;
  /** `danger` for a sheet that confirms something that cannot be undone. */
  submitVariant?: ButtonVariant;
  submitting?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const formId = useId();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      initialFocus={initialFocus}
      footer={
        <Button
          type="submit"
          form={formId}
          label={submitting ? UI_TEXT.actions.saving : submitLabel}
          icon={submitIcon}
          loading={submitting}
          variant={submitVariant}
          fullWidth
        />
      }
    >
      <form
        id={formId}
        method="post"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="grid gap-5 pb-2"
      >
        {children}
      </form>
    </Sheet>
  );
}
