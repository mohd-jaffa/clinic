import type { ReactNode } from "react";

import type { RouteAccess } from "@/constants/permissions";
import { readScreen, type ScreenReads } from "@/features/auth/session.server";
import { ServerData } from "@/lib/query/ServerData";

import { AppShell } from "./AppShell";
import { NoAccess } from "./NoAccess";

/**
 * A signed-in screen, drawn on the server with its first data (AGENTS.md §9):
 * the screen's `queries` and `pages`, keyed as its hooks ask for them — or
 * worked out from who is signed in — so the
 * page arrives ready to read rather than as placeholders that fill in after
 * it (`readScreen`, `ServerData`), inside the shell. A member it is not for
 * is told so in its place (`NoAccess`).
 */
export async function AppScreen({
  access,
  queries,
  pages,
  children,
}: {
  /** Who the screen is for (plan §31.2); its first data is read only for them. */
  access?: RouteAccess;
  queries?: ScreenReads;
  pages?: ScreenReads;
  children: ReactNode;
}) {
  const data = await readScreen({ access, queries, pages });
  return (
    <ServerData queries={data.queries} pages={data.pages}>
      <AppShell>{data.refused ? <NoAccess /> : children}</AppShell>
    </ServerData>
  );
}
