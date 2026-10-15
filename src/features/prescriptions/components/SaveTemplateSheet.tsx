"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BookmarkPlus } from "lucide-react";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { FORM_RESET_OPTIONS, templateNameSchema, type TemplateInput, type TemplateNameInput } from "@/lib/validation";

import { useAddTemplate } from "../hooks/useAddTemplate";

const { prescription: words } = UI_TEXT;

/**
 * **Save as template** (D239, D240, D243): the doctor names the medicines
 * and advice on the screen — as they stand, saved or not — as a template of
 * their own. A name they already use asks before replacing that one. Once
 * saved the sheet closes and starts blank next time.
 */
export function SaveTemplateSheet({
  open,
  onClose,
  content,
}: {
  open: boolean;
  onClose: () => void;
  /** The medicines and advice on the screen at the moment it is saved. */
  content: () => Omit<TemplateInput, "name">;
}) {
  const form = useForm<TemplateNameInput>({
    resolver: zodResolver(templateNameSchema),
    defaultValues: { name: "" },
    resetOptions: FORM_RESET_OPTIONS,
  });
  const { submit, submitting } = useAddTemplate(() => {
    form.reset({ name: "" });
    onClose();
  });

  return (
    <FormSheet
      open={open}
      title={words.saveAsTemplate}
      onClose={onClose}
      onSubmit={form.handleSubmit(() => submit({ name: form.getValues("name"), ...content() }))}
      submitLabel={words.saveAsTemplate}
      submitIcon={BookmarkPlus}
      submitting={submitting}
    >
      <TextField
        label={words.templateNameLabel}
        hint={words.templateNameHint}
        autoComplete="off"
        required
        maxLength={TEXT_LIMITS.templateName}
        error={form.formState.errors.name?.message}
        {...form.register("name")}
      />
    </FormSheet>
  );
}
