"use client";

import { apiRoutes, withQuery } from "@/lib/query/keys";
import { useApiPages } from "@/lib/query/useApiPages";

import type { ConsoleAccount } from "../types";

/** A page at a time of every account (plan §20.5), the newest first, searched. */
export function useConsoleAccounts(search: string) {
  return useApiPages<ConsoleAccount>(withQuery(apiRoutes.console.accounts, { search }), { list: "accounts" });
}
