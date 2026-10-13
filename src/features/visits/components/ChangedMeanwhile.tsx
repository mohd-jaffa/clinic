import { History } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";

const { visit: words } = UI_TEXT;

/**
 * Someone saved this section while it was being typed into (D206): their
 * copy, read out under what is typed — kept — with **Use theirs** to take it.
 * Saving keeps what is typed, over theirs, knowingly. Announced politely.
 */
export function ChangedMeanwhile({ onTake, children }: { onTake: () => void; children: ReactNode }) {
  return (
    <div role="status" className="grid gap-3 rounded-row bg-coral-soft p-4 text-ink">
      <div className="flex items-start gap-2.5">
        <History size={20} strokeWidth={2.25} aria-hidden="true" className="mt-0.5 shrink-0 text-coral" />
        <div className="min-w-0">
          <p className="font-bold">{words.changedMeanwhile}</p>
          <p className="text-small">{words.changedMeanwhileHint}</p>
        </div>
      </div>
      <div className="rounded-row bg-surface p-3">{children}</div>
      <div>
        <Button label={words.useTheirs} variant="secondary" size="sm" onClick={onTake} />
      </div>
    </div>
  );
}
