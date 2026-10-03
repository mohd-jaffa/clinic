"use client";

import { WifiOff } from "lucide-react";

import { UI_TEXT } from "@/constants/messages";
import { useOnline } from "@/hooks/useOnline";

/**
 * The connection dropped (plan §21, §32.1, D55): a slim coral band across the
 * top of the screen, the same kind as the plan banner (D73), saying so — and
 * that what is being typed stays until it can be saved. It goes by itself
 * when the connection comes back. Its place is always there and polite, so
 * the words are read out as they arrive; the server draws it empty.
 */
export function OfflineBanner() {
  const online = useOnline();
  return (
    <div role="status" data-band={online ? undefined : ""}>
      {!online && (
        <p className="safe-top flex items-start gap-3 bg-coral-soft px-4 pb-4 text-small font-bold text-ink [--safe-pt:1rem] md:px-8">
          <WifiOff size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-coral" />
          {UI_TEXT.offline.banner}
        </p>
      )}
    </div>
  );
}
