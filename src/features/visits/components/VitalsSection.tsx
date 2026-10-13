"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import type { Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useRevalidate } from "@/lib/query/useRevalidate";
import { vitalsSchema, type VitalsInput } from "@/lib/validation";

import { VisitsClient } from "../api.client";
import { useVisitSection } from "../hooks/useVisitSection";
import type { Visit } from "../types";
import { vitalsInput } from "../vitals";
import { ChangedMeanwhile } from "./ChangedMeanwhile";
import { VitalsFields } from "./VitalsFields";
import { VitalsReadout } from "./VitalsReadout";

const { visit: words } = UI_TEXT;

/**
 * A visit's vitals (plan §12.2; D202): the fields on the screen for whoever
 * may write them — `visits.create` while it is open, `visits.edit` once done
 * (D208) — saved alone with **Save vitals**, shown once something is typed;
 * read out in big numerals for whoever may only read.
 */
export function VitalsSection({ visit, writes, className }: { visit: Visit; writes: boolean; className?: string }) {
  if (!writes) {
    return (
      <Panel title={words.vitalsTitle} className={className}>
        <VitalsReadout vitals={visit.vitals} />
      </Panel>
    );
  }
  return <VitalsForm visit={visit} className={className} />;
}

function VitalsForm({ visit, className }: { visit: Visit; className?: string }) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const formId = useId();
  const route = apiRoutes.visits.one(visit.id);
  const section = useVisitSection({
    saved: visit.vitals,
    toInput: vitalsInput,
    resolver: zodResolver(vitalsSchema) as unknown as Resolver<VitalsInput>,
  });
  const saving = useApiMutation(
    async (input: VitalsInput) => {
      const result = await VisitsClient.saveVitals({ id: visit.id, input: { vitals: input, seen: section.seen } });
      section.saved(result.vitals);
      return result;
    },
    {
      revalidate: [route],
      onSuccess: () => respond.success({ title: words.vitalsSaved }),
      onError: (failure) => {
        // Someone saved them meanwhile: theirs is read, to show beside what is typed.
        if (failure instanceof ApiError && failure.code === "VISIT_CHANGED") void refresh([route]);
        respond.failure(failure, { title: words.notSaved });
      },
    },
  );

  return (
    <Panel
      title={words.vitalsTitle}
      className={className}
      footer={
        section.dirty && (
          <Button type="submit" form={formId} label={words.saveVitals} size="sm" loading={saving.submitting} />
        )
      }
    >
      <form
        id={formId}
        noValidate
        // What was typed is sent, to be read once more by the route.
        onSubmit={section.form.handleSubmit(() => saving.submit(section.form.getValues()))}
      >
        <VitalsFields form={section.form} />
      </form>
      {section.theirs !== undefined && (
        <ChangedMeanwhile onTake={section.takeTheirs}>
          <VitalsReadout vitals={section.theirs} />
        </ChangedMeanwhile>
      )}
    </Panel>
  );
}
