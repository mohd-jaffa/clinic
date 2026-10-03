"use client";

import { Building2, Clock, Hash, MapPin, Phone, Stethoscope } from "lucide-react";
import { useState } from "react";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { useResponse } from "@/components/ui/response-card";
import { Row, RowIcon, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { SETTINGS_ROUTE } from "@/constants/navigation";
import {
  CLINIC_TYPE_LABELS,
  FEE_TIMING_LABELS,
  FEE_TIMINGS,
  PAPER_SIZE_LABELS,
  PAPER_SIZES,
  type FeeTiming,
  type PaperSize,
} from "@/constants/statuses";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { ClinicClient } from "../api.client";
import { useClinic } from "../hooks/useClinic";
import type { ClinicProfile } from "../types";
import { ClinicDetailsSheet } from "./ClinicDetailsSheet";
import { LogoSection } from "./LogoSection";

const { clinic } = UI_TEXT;

const PAPER_OPTIONS = PAPER_SIZES.map((value) => ({ value, label: PAPER_SIZE_LABELS[value] }));
const FEE_OPTIONS = FEE_TIMINGS.map((value) => ({ value, label: FEE_TIMING_LABELS[value] }));

/** One line of a clinic's phone and email, or that it has neither. */
const contactOf = ({ phone, email }: ClinicProfile) => [phone, email].filter(Boolean).join(" · ") || clinic.noContact;

/**
 * Clinic details (plan §9, D78), for `settings.manage`. The land names it and
 * the clinic. On the ground: the logo; the details as rows, each opening the
 * one sheet that changes them; and how bills and prescriptions are made —
 * the paper size (D28) and when the consultation fee is collected (D44) —
 * each saved the moment it is picked. From 1024 px it stands in two columns.
 * In a view-only clinic everything is shown and nothing changes, and it says
 * why (plan §7.2).
 */
export function ClinicDetails() {
  const query = useClinic();
  const profile = query.data;

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={UI_TEXT.settings.items.clinic.label} subtitle={profile?.name} back={SETTINGS_ROUTE} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        {profile ? (
          <Profile profile={profile} />
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="CLINIC_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={4} />
          </section>
        )}
      </div>
    </>
  );
}

function Profile({ profile }: { profile: ClinicProfile }) {
  const { readOnly } = useReadOnly();
  const [editing, setEditing] = useState(false);
  const edit = readOnly ? undefined : () => setEditing(true);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-x-10">
      <div className="grid grid-cols-1 gap-8">
        <LogoSection profile={profile} />
        <section aria-labelledby="clinic-details">
          <SectionHeading id="clinic-details" title={clinic.details} />
          <RowList look="menu">
            <Row
              look="menu"
              leading={<RowIcon icon={Building2} />}
              title={clinic.nameLabel}
              subtitle={profile.name}
              onClick={edit}
            />
            <Row
              look="menu"
              leading={<RowIcon icon={Stethoscope} />}
              title={clinic.typeLabel}
              subtitle={CLINIC_TYPE_LABELS[profile.clinicType]}
              onClick={edit}
            />
            <Row
              look="menu"
              leading={<RowIcon icon={MapPin} />}
              title={clinic.addressLabel}
              subtitle={`${profile.address}, ${profile.city}`}
              onClick={edit}
            />
            <Row
              look="menu"
              leading={<RowIcon icon={Phone} />}
              title={clinic.contact}
              subtitle={contactOf(profile)}
              onClick={edit}
            />
            <Row
              look="menu"
              leading={<RowIcon icon={Hash} />}
              title={clinic.gstinLabel}
              subtitle={profile.gstin ?? clinic.noGstin}
              onClick={edit}
            />
            <Row
              look="menu"
              leading={<RowIcon icon={Clock} />}
              title={clinic.timezone}
              subtitle={clinic.timezoneValue}
            />
          </RowList>
          <ReadOnlyNote />
        </section>
      </div>

      <Documents profile={profile} readOnly={readOnly} />
      <ClinicDetailsSheet open={editing} onClose={() => setEditing(false)} profile={profile} />
    </div>
  );
}

/**
 * How bills and prescriptions are made (D28, D44): each choice is saved as it
 * is picked, shown at once and put back if the save fails. View-only, each is
 * a plain line.
 */
function Documents({ profile, readOnly }: { profile: ClinicProfile; readOnly: boolean }) {
  const respond = useResponse();
  const [paper, setPaper] = useState<PaperSize | null>(null);
  const [fee, setFee] = useState<FeeTiming | null>(null);
  const failed = (failure: unknown) => respond.failure(failure, { title: clinic.choiceNotSaved });

  const paperSize = useApiMutation(ClinicClient.update, {
    revalidate: [apiRoutes.clinic.profile],
    onSuccess: (saved) => respond.success({ title: clinic.paperSizeSaved(PAPER_SIZE_LABELS[saved.paperSize]) }),
    onError: failed,
  });
  const feeTiming = useApiMutation(ClinicClient.update, {
    revalidate: [apiRoutes.clinic.profile],
    onSuccess: (saved) => respond.success({ title: clinic.feeTimingSaved(FEE_TIMING_LABELS[saved.feeTiming]) }),
    onError: failed,
  });

  // Shown at once; once the save is answered, the clinic as it now is — the new choice, or the old one back.
  const choosePaper = async (value: PaperSize) => {
    if (value === profile.paperSize) return;
    setPaper(value);
    await paperSize.submit({ paperSize: value });
    setPaper(null);
  };
  const chooseFee = async (value: FeeTiming) => {
    if (value === profile.feeTiming) return;
    setFee(value);
    await feeTiming.submit({ feeTiming: value });
    setFee(null);
  };

  return (
    <section aria-labelledby="clinic-documents" className="grid grid-cols-1 gap-6">
      <SectionHeading id="clinic-documents" title={clinic.documents} />
      {readOnly ? (
        <RowList look="menu">
          <Row look="menu" title={clinic.paperSize} subtitle={PAPER_SIZE_LABELS[profile.paperSize]} />
          <Row look="menu" title={clinic.feeTiming} subtitle={FEE_TIMING_LABELS[profile.feeTiming]} />
        </RowList>
      ) : (
        <>
          <div>
            <p className="mb-2 font-bold">{clinic.paperSize}</p>
            <SegmentedControl
              label={clinic.paperSize}
              value={paper ?? profile.paperSize}
              options={PAPER_OPTIONS}
              onChange={(value) => void choosePaper(value)}
            />
            <p className="mt-2 text-small text-muted">{clinic.paperSizeHint}</p>
          </div>
          <div>
            <p className="mb-2 font-bold">{clinic.feeTiming}</p>
            <ChoiceChips
              label={clinic.feeTiming}
              value={fee ?? profile.feeTiming}
              options={FEE_OPTIONS}
              onChange={(value) => void chooseFee(value)}
              wrap
            />
            <p className="mt-2 text-small text-muted">{clinic.feeTimingHint}</p>
          </div>
        </>
      )}
    </section>
  );
}
