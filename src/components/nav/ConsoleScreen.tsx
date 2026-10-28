import type { ReactNode } from "react";

import { readConsole, type ConsoleRead } from "@/features/auth/session.server";
import { ServerData } from "@/lib/query/ServerData";

import { ConsoleShell } from "./ConsoleShell";

/**
 * A developer console screen (plan §20; D367), drawn on the server with its
 * first data as `AppScreen` draws a clinic's — read as the server, for the
 * platform admin only — inside the console's frame.
 */
export async function ConsoleScreen({
  queries,
  pages,
  children,
}: {
  queries?: Record<string, ConsoleRead>;
  pages?: Record<string, ConsoleRead>;
  children: ReactNode;
}) {
  const data = await readConsole({ queries, pages });
  return (
    <ServerData queries={data.queries} pages={data.pages}>
      <ConsoleShell>{children}</ConsoleShell>
    </ServerData>
  );
}
