"use client";

import { UsersRound } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { CoastHeader } from "@/components/ui/coast-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { SearchField } from "@/components/ui/search-field";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { CLINIC_ROLE_LABELS, PLATFORM_ROLE_LABELS } from "@/constants/roles";
import { MEMBER_STATUS_LABELS, MEMBER_STATUS_TONES } from "@/constants/statuses";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDaysAgo } from "@/lib/format/date";

import { useConsoleAccounts } from "../hooks/useConsoleAccounts";
import type { ConsoleAccount } from "../types";

const { console: words } = UI_TEXT;

/** Where they belong, and as what: "Smile Care · Doctor", the platform admin as "Developer", or no clinic. */
function placeOf(account: ConsoleAccount): string {
  if (account.membership) {
    return UI_TEXT.nav.membership(account.membership.clinicName, CLINIC_ROLE_LABELS[account.membership.role]);
  }
  return account.platformRole ? PLATFORM_ROLE_LABELS[account.platformRole] : words.noClinic;
}

/**
 * The console's Accounts — `/admin/accounts` (plan §20.5): every profile,
 * the newest first, searched by name, email, mobile or clinic. Each row is
 * who they are, where they belong and as what, their email and when they
 * last signed in — and, when their membership is not active, whether they
 * are invited or deactivated.
 */
export function ConsoleAccounts() {
  const [search, setSearch] = useState("");
  const searched = useDebouncedValue(search.trim());
  const query = useConsoleAccounts(searched);

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={words.places.accounts} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-6">
          <SearchField value={search} onChange={setSearch} placeholder={words.searchAccountsHint} />
          <ListScreen
            query={query}
            loadFailed="CONSOLE_ACCOUNTS_LOAD_FAILED"
            data={query.data}
            empty={<EmptyState icon={UsersRound} title={words.noAccounts} />}
            noMatches={searched && words.noAccountsMatch}
            renderList={(accounts) => (
              <RowList label={words.places.accounts}>
                {accounts.map((account) => (
                  <Row
                    key={account.id}
                    leading={<Avatar name={account.name} />}
                    title={account.name}
                    subtitle={placeOf(account)}
                    note={[
                      account.email,
                      account.lastSignInAt ? words.signedIn(formatDaysAgo(account.lastSignInAt)) : words.neverSignedIn,
                    ]}
                    detail={
                      account.membership &&
                      account.membership.status !== "ACTIVE" && (
                        <StatusPill
                          label={MEMBER_STATUS_LABELS[account.membership.status]}
                          tone={MEMBER_STATUS_TONES[account.membership.status]}
                        />
                      )
                    }
                  />
                ))}
              </RowList>
            )}
          />
        </div>
      </div>
    </>
  );
}
