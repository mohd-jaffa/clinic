"use client";

import { ScrollText } from "lucide-react";

import { CoastHeader } from "@/components/ui/coast-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { UI_TEXT } from "@/constants/messages";
import { formatDateTime } from "@/lib/format/date";

import { describeAudit } from "../describe";
import { useConsoleAudit } from "../hooks/useConsoleAudit";

const { console: words } = UI_TEXT;

/**
 * The console's Audit — `/admin/audit` (plan §20.7): the console's own
 * actions, the latest first — a plan extended, for which clinic and how, or
 * the settings changed, each from and to — with who did it and when. Never a
 * clinic's activity.
 */
export function ConsoleAudit() {
  const query = useConsoleAudit();

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={words.places.audit} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-6">
          <ListScreen
            query={query}
            loadFailed="CONSOLE_AUDIT_LOAD_FAILED"
            data={query.data}
            empty={<EmptyState icon={ScrollText} title={words.noAudit} />}
            renderList={(entries) => (
              <RowList label={words.places.audit}>
                {entries.map((entry) => {
                  const { title, line } = describeAudit(entry);
                  return (
                    <Row
                      key={entry.id}
                      title={title}
                      subtitle={line}
                      note={words.byWhom(entry.actorName ?? words.someone, formatDateTime(entry.at))}
                      wrap
                    />
                  );
                })}
              </RowList>
            )}
          />
        </div>
      </div>
    </>
  );
}
