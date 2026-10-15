"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";

import { NoAccess } from "@/components/nav/NoAccess";
import { ArchiveButton } from "@/components/ui/archive-button";
import { Button } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { FieldError } from "@/components/ui/field";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { useResponse } from "@/components/ui/response-card";
import { ScreenNotice } from "@/components/ui/screen-notice";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { PRESCRIPTION_MAX_ITEMS, TEXT_LIMITS } from "@/constants/limits";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { TEMPLATES_ROUTE } from "@/constants/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import type { PatientAlert } from "@/features/patients/types";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { FORM_RESET_OPTIONS, templateSchema, type TemplateInput } from "@/lib/validation";

import { TemplatesClient } from "../api.client";
import { useAddTemplate } from "../hooks/useAddTemplate";
import { useTemplateChange } from "../hooks/useTemplateChange";
import { useTemplates } from "../hooks/useTemplates";
import type { PrescriptionTemplate } from "../types";
import { EMPTY_LINE, lineInput, MedicineLine } from "./MedicineLine";

const { templates: words, prescription } = UI_TEXT;

/** A template is no one's prescription: no allergies to warn of. */
const NO_ALLERGIES: readonly PatientAlert[] = [];

/** The fields for a template: nothing typed for a new one. */
const templateInput = (template: PrescriptionTemplate | null): TemplateInput => ({
  name: template?.name ?? "",
  items: template?.items.map(lineInput) ?? [],
  advice: template?.advice ?? "",
});

/**
 * One of a doctor's templates, on a screen of its own (plan §13; D242): a
 * new one (`id` none), or theirs — found among their templates, read as the
 * list is. Only a doctor has templates.
 */
export function TemplateEditor({ id }: { id: string | null }) {
  const { membership } = useAuth();
  const doctorId = membership?.doctorId ?? null;
  const query = useTemplates(id === null ? null : doctorId);
  if (doctorId === null) return <NoAccess />;
  if (id === null) return <Editor template={null} doctorId={doctorId} />;
  const template = query.data?.find((one) => one.id === id);
  if (template) return <Editor key={template.id} template={template} doctorId={doctorId} />;
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={words.title} back={TEMPLATES_ROUTE} />
        </div>
      </CoastHeader>
      <div className="max-w-3xl px-4 pt-4 md:px-8">
        {query.data ? (
          <ScreenNotice>{ERROR_MESSAGES.RECORD_NOT_FOUND}</ScreenNotice>
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="TEMPLATES_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={4} />
          </section>
        )}
      </div>
    </>
  );
}

/**
 * A template's name, its medicines — each a line as on a prescription, with
 * this doctor's lines suggested (D211) — and its advice, then **Save**: a new
 * one under a name in use asks to replace that one (D243); a changed one
 * keeps to a name of its own. **Archive**, asked first, for one in use.
 * Saved or archived, it goes back to the list. In a view-only clinic it is
 * shown, not changed.
 */
function Editor({ template, doctorId }: { template: PrescriptionTemplate | null; doctorId: string }) {
  const router = useRouter();
  const respond = useResponse();
  const { readOnly } = useReadOnly();
  const form = useForm<TemplateInput>({
    resolver: zodResolver(templateSchema),
    defaultValues: templateInput(template),
    resetOptions: FORM_RESET_OPTIONS,
  });
  const lines = useFieldArray({ control: form.control, name: "items" });
  const back = () => router.push(TEMPLATES_ROUTE);

  const adding = useAddTemplate(back);
  const changing = useApiMutation(TemplatesClient.change, {
    revalidate: [apiRoutes.prescriptionTemplates.list],
    onSuccess: (saved) => {
      respond.success({ title: UI_TEXT.catalogues.savedNote(saved.name) });
      back();
    },
    onError: (failure) => respond.failure(failure, { title: words.notChanged }),
  });
  const { archive, archiving } = useTemplateChange();

  const save = () => {
    const typed = form.getValues();
    return template === null ? adding.submit(typed) : changing.submit({ id: template.id, input: { template: typed } });
  };

  const count = lines.fields.length;
  const { errors } = form.formState;
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={template?.name ?? words.newTitle}
            subtitle={template?.active === false ? words.archived : undefined}
            back={TEMPLATES_ROUTE}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <form noValidate onSubmit={form.handleSubmit(save)} className="grid max-w-3xl grid-cols-1 gap-5">
          <ReadOnlyNote />
          <fieldset disabled={readOnly} className="grid min-w-0 grid-cols-1 gap-5">
            <TextField
              label={prescription.templateNameLabel}
              autoComplete="off"
              required
              maxLength={TEXT_LIMITS.templateName}
              error={errors.name?.message}
              {...form.register("name")}
            />
            {/* Its medicines and advice in a card, each medicine a block of its own, as on a visit. */}
            <Panel title={prescription.title}>
              {lines.fields.map((field, index) => (
                <MedicineLine
                  key={field.id}
                  form={form}
                  index={index}
                  count={count}
                  doctorId={doctorId}
                  allergies={NO_ALLERGIES}
                  onMove={(to) => lines.move(index, to)}
                  onRemove={() => lines.remove(index)}
                />
              ))}
              <div>
                {count < PRESCRIPTION_MAX_ITEMS && (
                  <Button
                    label={prescription.addMedicine}
                    icon={Plus}
                    variant="secondary"
                    size="sm"
                    onClick={() => lines.append(EMPTY_LINE, { focusName: `items.${count}.medicine` })}
                  />
                )}
                {/* A template with nothing in it has no lines: its refusal is the list's own. */}
                <FieldError message={errors.items?.message} />
              </div>
              <TextAreaField
                label={prescription.adviceLabel}
                rows={3}
                autoComplete="off"
                maxLength={TEXT_LIMITS.advice}
                error={errors.advice?.message}
                {...form.register("advice")}
              />
            </Panel>
          </fieldset>
          {!readOnly && (
            <div className="grid gap-6">
              <div>
                <Button
                  type="submit"
                  label={UI_TEXT.actions.save}
                  icon={Check}
                  loading={adding.submitting || changing.submitting}
                />
              </div>
              {template?.active && (
                <ArchiveButton
                  archive={() =>
                    archive(template, { title: words.archiveTitle(template.name), message: words.archiveBody })
                  }
                  archiving={archiving}
                  onArchived={back}
                />
              )}
            </div>
          )}
        </form>
      </div>
    </>
  );
}
