"use client";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { TemplateInput } from "@/lib/validation";

import { TemplatesClient } from "../api.client";
import type { PrescriptionTemplate } from "../types";

const { prescription: words } = UI_TEXT;

/**
 * Saving a new template of the doctor's own (D240, D243), from a visit or My
 * account: under a name they already use, it asks — "Replace your template
 * 'Viral fever'?" — and saves it over that one only if told to; told not to,
 * nothing is saved and what was typed stays. Once saved, the templates are
 * read again and it says so.
 */
export function useAddTemplate(onSaved: (template: PrescriptionTemplate) => void) {
  const respond = useResponse();
  return useApiMutation(
    async (template: TemplateInput): Promise<PrescriptionTemplate | null> => {
      try {
        return await TemplatesClient.add({ template });
      } catch (failure) {
        if (!(failure instanceof ApiError) || failure.code !== "TEMPLATE_NAME_TAKEN") throw failure;
        const sure = await respond.confirm({
          title: words.replaceTitle(template.name.trim()),
          message: words.replaceBody,
          confirmLabel: words.replace,
        });
        return sure ? TemplatesClient.add({ template, replace: true }) : null;
      }
    },
    {
      revalidate: [apiRoutes.prescriptionTemplates.list],
      onSuccess: (saved) => {
        if (saved === null) return;
        onSaved(saved);
        respond.success({ title: words.templateSaved(saved.name) });
      },
      onError: (failure) => respond.failure(failure, { title: words.templateNotSaved }),
    },
  );
}
