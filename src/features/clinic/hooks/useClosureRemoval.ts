"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { ClosuresClient } from "../api.client";
import type { Closure } from "../types";

const { closures } = UI_TEXT;

/**
 * Removing a holiday or leave not yet over (D84). It is gone for good, so it
 * asks first, on a danger card (AGENTS.md §23); booking opens on its days
 * again. A refusal — it ended meanwhile — is an error card in the API's words.
 */
export function useClosureRemoval() {
  const respond = useResponse();
  // The closure being removed, so only its row shows it.
  const [removing, setRemoving] = useState<string | null>(null);
  const mutation = useApiMutation(ClosuresClient.remove, {
    revalidate: [apiRoutes.closures.list],
    onSuccess: (removed) => respond.success({ title: closures.removed(removed.reason) }),
    onError: (failure) => respond.failure(failure, { title: closures.notRemoved }),
  });

  const remove = async (closure: Closure) => {
    const sure = await respond.confirm({
      title: closures.removeTitle(closure.reason),
      message: closures.removeBody,
      confirmLabel: closures.remove,
      confirmIcon: Trash2,
      tone: "danger",
    });
    if (!sure) return;
    setRemoving(closure.id);
    await mutation.submit(closure.id);
    setRemoving(null);
  };

  return { remove, removing };
}
