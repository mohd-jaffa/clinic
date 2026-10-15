"use client";

import { ClipboardList, Plus } from "lucide-react";

import { NoAccess } from "@/components/nav/NoAccess";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Row, RowList } from "@/components/ui/row";
import { UI_TEXT } from "@/constants/messages";
import { MY_ACCOUNT_ROUTE, NEW_TEMPLATE_ROUTE, templateRoute } from "@/constants/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { ArchivedEntries } from "@/features/clinic/components/ArchivedEntries";
import { activeCount, CatalogueScreen } from "@/features/clinic/components/CatalogueScreen";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";

import { templateLine } from "../content";
import { useTemplateChange } from "../hooks/useTemplateChange";
import { useTemplates } from "../hooks/useTemplates";
import type { PrescriptionTemplate } from "../types";

const { templates: words } = UI_TEXT;

/**
 * A doctor's prescription templates, from My account (plan §13; D242): those
 * in use by name, each with its medicines and opening its own screen;
 * **New template** to start one; the archived ones folded under them, each
 * with **Restore** (D80). Only a doctor has templates; anyone else is told
 * the screen is not theirs. In a view-only clinic they are shown, not
 * changed, and it says why.
 */
export function PrescriptionTemplates() {
  const { membership } = useAuth();
  const doctorId = membership?.doctorId ?? null;
  const query = useTemplates(doctorId);
  if (doctorId === null) return <NoAccess />;
  return (
    <CatalogueScreen
      title={words.title}
      subtitle={query.data && words.count(activeCount(query.data))}
      query={query}
      loadFailed="TEMPLATES_LOAD_FAILED"
      back={MY_ACCOUNT_ROUTE}
    >
      {(templates) => <Templates templates={templates} />}
    </CatalogueScreen>
  );
}

function Templates({ templates }: { templates: readonly PrescriptionTemplate[] }) {
  const { readOnly } = useReadOnly();
  const { restore, restoring } = useTemplateChange();
  const inUse = templates.filter((template) => template.active);
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-8">
      <section aria-label={words.title} className="grid gap-5">
        {inUse.length === 0 ? (
          <EmptyState icon={ClipboardList} title={words.emptyTitle} hint={words.emptyHint} />
        ) : (
          <RowList look="menu" label={words.title}>
            {inUse.map((template) => (
              <Row
                key={template.id}
                look="menu"
                title={template.name}
                subtitle={templateLine(template.items)}
                href={templateRoute(template.id)}
              />
            ))}
          </RowList>
        )}
        {readOnly ? (
          <ReadOnlyNote />
        ) : (
          <div>
            <LinkButton href={NEW_TEMPLATE_ROUTE} label={words.add} icon={Plus} />
          </div>
        )}
      </section>
      <ArchivedEntries
        entries={templates.filter((template) => !template.active)}
        describe={(template) => templateLine(template.items)}
        onRestore={readOnly ? undefined : (template) => void restore(template)}
        restoring={restoring}
      />
    </div>
  );
}
