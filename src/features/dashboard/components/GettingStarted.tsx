"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { cn } from "@/components/ui/cn";
import { Row } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { GETTING_STARTED } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";

import type { Dashboard } from "../types";

const { gettingStarted: words } = UI_TEXT.home;

/**
 * A new clinic's first steps (plan §17; D348, D352), until its first patient:
 * set the prices, add the team, add the first patient — each ticked once
 * done, a round check where its number was and **Done** beside it. A step
 * opens its screen for whoever may take it there; for anyone else it is only
 * words.
 */
export function GettingStarted({ steps }: { steps: NonNullable<Dashboard["gettingStarted"]> }) {
  const { membership } = useAuth();
  const id = useId();
  const done = { prices: steps.prices, team: steps.team, patient: false };
  return (
    <section aria-labelledby={id} className="max-w-3xl">
      <SectionHeading id={id} title={words.title} />
      <p className="mb-3 text-small text-muted">{words.hint(membership?.clinicName ?? "")}</p>
      <ol role="list" className="grid grid-cols-1 gap-2.5">
        {GETTING_STARTED.map((step, index) => {
          const finished = done[step.id];
          const { label, hint } = words.steps[step.id];
          return (
            <Row
              key={step.id}
              leading={
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-9 place-items-center rounded-full text-small font-bold tabular-nums",
                    finished ? "bg-action text-on-action" : "text-muted ring-1 ring-line ring-inset",
                  )}
                >
                  {finished ? <Check size={18} strokeWidth={2.75} /> : index + 1}
                </span>
              }
              title={label}
              subtitle={hint}
              detail={finished && <StatusPill label={words.done} tone="live" />}
              href={membership !== null && hasAccess(membership, step.access) ? step.href : undefined}
            />
          );
        })}
      </ol>
    </section>
  );
}
