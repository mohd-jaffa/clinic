"use client";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import type { PlatformSettings } from "@/constants/platform";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { PlatformSettingsInput, PlatformSettingsPayload } from "@/lib/validation";

import { ConsoleClient } from "../api.client";
import { askLine, changedSettings, changesLine } from "../settings";

const { console: words } = UI_TEXT;

/**
 * Saving a group of settings (plan §6, §20.4; D378, D381): only what
 * changed is sent, after the card asks first — each change, from and to,
 * and when it takes effect. Nothing changed, nothing is asked or sent.
 * Saved, `onDone` gets the settings as saved, the card says what changed,
 * and the settings and the audit are read again.
 */
export function useSaveSettings(now: PlatformSettings, onDone: (saved?: PlatformSettings) => void) {
  const respond = useResponse();
  const saving = useApiMutation(ConsoleClient.saveSettings, {
    revalidate: [apiRoutes.console.settings, apiRoutes.console.audit],
    onError: (failure) => respond.failure(failure, { title: words.settingsNotSaved }),
  });
  return {
    submitting: saving.submitting,
    /** `input` as typed, of which the changed settings are sent; `payload` as read, to compare. */
    save: async (input: PlatformSettingsInput, payload: PlatformSettingsPayload) => {
      const keys = changedSettings(now, payload);
      if (keys.length === 0) return onDone();
      const sure = await respond.confirm({
        title: words.saveAsk,
        message: askLine(keys, now, payload),
        confirmLabel: words.saveConfirm,
      });
      if (!sure) return;
      const saved = await saving.submit(Object.fromEntries(keys.map((key) => [key, input[key]])));
      if (saved === undefined) return;
      onDone(saved);
      respond.success({ title: words.settingsSaved, message: changesLine(keys, now, payload) });
    },
  };
}
