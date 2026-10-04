"use client";

import { BellOff, ChevronDown, Info, Pencil, Plus, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AlertChip } from "@/components/ui/alert-chip";
import { Button, IconButton } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadFailed } from "@/components/ui/list-screen";
import { useResponse } from "@/components/ui/response-card";
import { Row, RowIcon, RowList } from "@/components/ui/row";
import { Sheet } from "@/components/ui/sheet";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { ALERT_KIND_LABELS, ALERT_KINDS } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { AlertsClient } from "../api.client";
import { useAlerts } from "../hooks/useAlerts";
import type { Patient, PatientAlert } from "../types";
import { AlertSheet } from "./AlertSheet";

const { alerts: words } = UI_TEXT;

/** Allergies first, then conditions, then medications; oldest first within each, as they came. */
const byKind = (a: PatientAlert, b: PatientAlert) => ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind);

/** "Allergy · Rash, 2019". */
const lineOf = (alert: PatientAlert) => [ALERT_KIND_LABELS[alert.kind], alert.note].filter(Boolean).join(" · ");

/**
 * A patient's alerts in their profile header (plan §10.3, §10.4, D117): a chip
 * for each active one — allergies first, in the danger tone — and **Alerts**,
 * opening the sheet that lists them with their notes. Only for `visits.view`;
 * changed with `visits.edit`, never while the patient is archived (D103) or
 * the clinic is view-only.
 */
export function PatientAlerts({ patient }: { patient: Patient }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const [open, setOpen] = useState(false);
  const mayRead = membership !== null && hasAccess(membership, "visits.view");
  const mayEdit = membership !== null && hasAccess(membership, "visits.edit");
  const query = useAlerts(patient.id, mayRead);
  if (!mayRead) return null;

  const active = (query.data ?? []).filter((alert) => alert.active).sort(byKind);
  const edits = mayEdit && !readOnly && patient.archivedAt === null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.length > 0 ? (
        // Its own items in the row, so Alerts follows the last chip rather than taking a line.
        <ul aria-label={words.title} className="contents">
          {active.map((alert) => (
            <li key={alert.id} className="max-w-full">
              <AlertChip
                label={alert.label}
                kind={ALERT_KIND_LABELS[alert.kind]}
                tone={alert.kind === "ALLERGY" ? "danger" : "note"}
              />
            </li>
          ))}
        </ul>
      ) : (
        query.data && <span className="text-small text-land-muted">{words.none}</span>
      )}
      {query.error != null && query.data === undefined && (
        <span className="text-small text-land-muted">{ERROR_MESSAGES.ALERTS_LOAD_FAILED}</span>
      )}
      <Button
        label={words.open}
        icon={edits ? Pencil : undefined}
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      />
      <AlertsSheet
        open={open}
        onClose={() => setOpen(false)}
        patientId={patient.id}
        query={query}
        edits={edits}
        mayEdit={mayEdit}
      />
    </div>
  );
}

/**
 * The alerts sheet (D117 – D120): each active alert with its note, with
 * **Edit** and **Turn off** (asked first) for those who may; **Add alert**;
 * and the turned-off ones folded at the foot, read only.
 */
function AlertsSheet({
  open,
  onClose,
  patientId,
  query,
  edits,
  mayEdit,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  query: ReturnType<typeof useAlerts>;
  /** Whether alerts may be changed here and now. */
  edits: boolean;
  /** Whether they could be, but for a view-only clinic — which is then said. */
  mayEdit: boolean;
}) {
  const respond = useResponse();
  // The alert the add sheet opens on, and a count so a fresh add starts blank.
  const [form, setForm] = useState<{ open: boolean; alert?: PatientAlert; count: number }>({ open: false, count: 0 });
  const all = query.data ?? [];
  const active = all.filter((alert) => alert.active).sort(byKind);
  const off = all.filter((alert) => !alert.active).sort(byKind);

  const turnedOff = useApiMutation(AlertsClient.update, {
    revalidate: [apiRoutes.patients.alerts(patientId)],
    onSuccess: (saved) => respond.success({ title: words.turnedOff(saved.label) }),
    onError: (failure) => respond.failure(failure, { title: words.notTurnedOff }),
  });
  const turnOff = async (alert: PatientAlert) => {
    const sure = await respond.confirm({
      title: words.turnOffTitle(alert.label),
      message: words.turnOffBody,
      confirmLabel: words.turnOff,
      confirmIcon: BellOff,
      tone: "danger",
    });
    if (sure) await turnedOff.submit({ patientId, alertId: alert.id, active: false });
  };
  const edit = (alert?: PatientAlert) => setForm(({ count }) => ({ open: true, alert, count: count + 1 }));

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={words.title}
        footer={edits && <Button label={words.add} icon={Plus} fullWidth onClick={() => edit()} />}
      >
        <div className="grid gap-5">
          {mayEdit && <ReadOnlyNote />}
          {query.data === undefined && query.error != null ? (
            <LoadFailed query={query} loadFailed="ALERTS_LOAD_FAILED" />
          ) : active.length > 0 ? (
            <RowList look="menu" label={words.title}>
              {active.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  actions={
                    edits && (
                      <>
                        <IconButton icon={Pencil} label={words.edit(alert.label)} onClick={() => edit(alert)} />
                        <IconButton
                          icon={BellOff}
                          label={words.turnOffName(alert.label)}
                          tone="danger"
                          onClick={() => void turnOff(alert)}
                        />
                      </>
                    )
                  }
                />
              ))}
            </RowList>
          ) : (
            query.data && <EmptyState icon={TriangleAlert} title={words.emptyTitle} hint={words.emptyHint} />
          )}
          {off.length > 0 && (
            <Disclosure
              label={words.turnedOffSection}
              showLabel={words.showTurnedOff(off.length)}
              hideLabel={words.hideTurnedOff}
              icon={ChevronDown}
            >
              <RowList look="menu" label={words.turnedOffSection}>
                {off.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} />
                ))}
              </RowList>
            </Disclosure>
          )}
        </div>
      </Sheet>
      {edits && (
        <AlertSheet
          key={form.count}
          open={form.open}
          onClose={() => setForm((current) => ({ ...current, open: false }))}
          patientId={patientId}
          alert={form.alert}
        />
      )}
    </>
  );
}

/** One alert: its mark, its name, its kind and note, and what may be done with it. */
function AlertRow({ alert, actions }: { alert: PatientAlert; actions?: ReactNode }) {
  const allergy = alert.kind === "ALLERGY";
  return (
    <Row
      look="menu"
      leading={
        <RowIcon icon={allergy ? TriangleAlert : Info} tone={allergy && alert.active ? "attention" : undefined} />
      }
      title={alert.label}
      subtitle={lineOf(alert)}
      trailing={actions || undefined}
    />
  );
}
