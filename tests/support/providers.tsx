import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { ResponseProvider } from "@/components/ui/response-card";

/**
 * What a screen has around it in the app, for a component test: a fresh SWR
 * cache, so no test sees another's data, and the response card that reports
 * outcomes (plan §32.2).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      <ResponseProvider>{children}</ResponseProvider>
    </SWRConfig>
  );
}
