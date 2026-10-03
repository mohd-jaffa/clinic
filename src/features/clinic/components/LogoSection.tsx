"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { useResponse } from "@/components/ui/response-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { LOGO_ACCEPT } from "@/constants/uploads";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { ClinicClient } from "../api.client";
import type { ClinicProfile } from "../types";
import { checkLogoFile } from "../upload";
import { ClinicLogo } from "./ClinicLogo";

const { clinic } = UI_TEXT;

/**
 * The clinic's logo (plan §9, AGENTS.md §20, D79): the logo as it is, or a
 * quiet mark for none; **Add logo** or **Change logo**, which stores the
 * chosen file at once — after the browser's own look at its type and size —
 * and **Remove logo**, which asks first. In a view-only clinic it is shown,
 * not changed, and says why.
 */
export function LogoSection({ profile }: { profile: ClinicProfile }) {
  const { reload } = useAuth();
  const { readOnly } = useReadOnly();
  const respond = useResponse();
  const picker = useRef<HTMLInputElement>(null);
  const changed = (title: string) => async () => {
    await reload();
    respond.success({ title });
  };
  const failed = (failure: unknown) => respond.failure(failure, { title: clinic.logoNotSaved });

  const upload = useApiMutation(ClinicClient.uploadLogo, {
    revalidate: [apiRoutes.clinic.profile],
    onSuccess: changed(clinic.logoSaved),
    onError: failed,
  });
  const remove = useApiMutation(ClinicClient.removeLogo, {
    revalidate: [apiRoutes.clinic.profile],
    onSuccess: changed(clinic.logoRemoved),
    onError: failed,
  });

  const chosen = (file: File | undefined) => {
    // Emptied, so choosing the same file again is still a change.
    picker.current!.value = "";
    if (!file) return;
    const problem = checkLogoFile(file);
    if (problem) {
      respond.error({ title: clinic.logoNotSaved, message: ERROR_MESSAGES[problem] });
      return;
    }
    void upload.submit(file);
  };

  const askToRemove = async () => {
    const sure = await respond.confirm({
      title: clinic.removeLogoTitle,
      message: clinic.removeLogoBody,
      confirmLabel: clinic.removeLogo,
      confirmIcon: Trash2,
      tone: "danger",
    });
    if (sure) await remove.submit(undefined);
  };

  return (
    <section aria-labelledby="clinic-logo">
      <SectionHeading id="clinic-logo" title={clinic.logo} />
      <div className="flex flex-wrap items-center gap-4">
        <ClinicLogo url={profile.logoUrl} clinic={profile.name} size="lg" />
        {readOnly ? (
          !profile.logoUrl && <p className="font-bold text-muted">{clinic.noLogo}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              label={profile.logoUrl ? clinic.changeLogo : clinic.addLogo}
              icon={ImagePlus}
              variant="secondary"
              size="sm"
              loading={upload.submitting}
              onClick={() => picker.current?.click()}
            />
            {profile.logoUrl && (
              <Button
                label={clinic.removeLogo}
                variant="quiet"
                size="sm"
                loading={remove.submitting}
                onClick={() => void askToRemove()}
              />
            )}
          </div>
        )}
      </div>
      {readOnly ? <ReadOnlyNote /> : <p className="mt-2.5 text-small text-muted">{clinic.logoHint}</p>}
      <input
        ref={picker}
        type="file"
        accept={LOGO_ACCEPT}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => chosen(event.target.files?.[0])}
      />
    </section>
  );
}
