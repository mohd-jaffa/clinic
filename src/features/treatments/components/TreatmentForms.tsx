"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, useForm, useWatch, type Resolver, type UseFormRegisterReturn } from "react-hook-form";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { DateField } from "@/components/ui/date-field";
import { DetailList } from "@/components/ui/detail-list";
import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyField } from "@/components/ui/money-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { SuggestField } from "@/components/ui/suggest-field";
import { TextAreaField } from "@/components/ui/text-field";
import { FOLLOW_UP_CHOICES, type FollowUpChoice } from "@/constants/clinical";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { TREATMENT_START_STATUSES } from "@/constants/statuses";
import { useServices } from "@/features/clinic/hooks/useServices";
import type { Service } from "@/features/clinic/types";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { ChangedMeanwhile } from "@/features/visits/components/ChangedMeanwhile";
import { useVisitSection } from "@/features/visits/hooks/useVisitSection";
import { addDaysKey, addMonthsKey, todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { paiseToText } from "@/lib/money";
import {
  FORM_RESET_OPTIONS,
  newTreatmentFormSchema,
  treatmentEditSchema,
  type NewTreatmentInput,
  type TreatmentEditInput,
} from "@/lib/validation";

import { isOpen } from "../api";
import { useNewTreatment } from "../hooks/useNewTreatment";
import { useTreatmentChange } from "../hooks/useTreatmentChange";
import type { Treatment } from "../types";

const { treatments: words, appointments, appointment } = UI_TEXT;

/** How many procedures the name's list offers at once. */
const PROCEDURES_SHOWN = 8;

const START_OPTIONS = TREATMENT_START_STATUSES.map((status) => ({ value: status, label: words.startChoices[status] }));

/** The price list's active procedures whose name holds what is typed (D258). */
function proceduresFor(services: readonly Service[] | undefined, typed: string): Service[] {
  const text = typed.trim().toLowerCase();
  if (text === "") return [];
  return (services ?? [])
    .filter((service) => service.active && service.category === "PROCEDURE")
    .filter((service) => service.name.toLowerCase().includes(text))
    .slice(0, PROCEDURES_SHOWN);
}

/**
 * A treatment's name (D258): typed, with the price list's procedures under it;
 * taking one fills its name and its price as the estimate, both still
 * editable.
 */
function NameField({
  typed,
  field,
  error,
  onPick,
}: {
  typed: string;
  field: UseFormRegisterReturn;
  error?: string;
  onPick: (procedure: Service) => void;
}) {
  const services = useServices();
  const shown = proceduresFor(services.data, typed);
  return (
    <SuggestField
      label={words.nameLabel}
      hint={words.nameHint}
      required
      maxLength={TEXT_LIMITS.treatmentName}
      listLabel={words.procedures}
      suggestions={shown.map((procedure) => ({
        key: procedure.id,
        label: procedure.name,
        detail: formatPaise(procedure.pricePaise),
      }))}
      onPick={(key) => onPick(shown.find((procedure) => procedure.id === key)!)}
      error={error}
      autoComplete="off"
      {...field}
    />
  );
}

/** The doctors to choose from: the clinic's active ones — and this one's own, should they have left. */
function doctorOptions(
  doctors: readonly { id: string; name: string }[],
  current?: { id: string; name: string | null },
) {
  const options = doctors.map(({ id, name }) => ({ value: id, label: name }));
  if (current && !doctors.some((doctor) => doctor.id === current.id)) {
    options.unshift({ value: current.id, label: current.name ?? appointment.formerDoctor });
  }
  return options;
}

/**
 * A new treatment (plan §14.1; D252, D258): its name — a procedure from the
 * price list fills it and its price as the estimate — what it is, the
 * estimate, and when: **Start today** or **Plan it**. In a visit it is the
 * visit's doctor's and begins today, what was done its first session; from
 * the profile a doctor is chosen and it is planned unless begun. Its next
 * sitting may be set at once (D259).
 */
export function NewTreatmentSheet({
  patientId,
  visitId,
  firstDoctor,
  open,
  onClose,
}: {
  patientId: string;
  visitId: string | null;
  /** The doctor chosen at first, from the profile: the caller, or the patient's own. */
  firstDoctor: string;
  open: boolean;
  onClose: () => void;
}) {
  const doctors = useDoctors().data ?? [];
  const today = todayKey();
  const adding = useNewTreatment({ patientId, visitId });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<NewTreatmentInput>({
    resolver: zodResolver(newTreatmentFormSchema(today)) as unknown as Resolver<NewTreatmentInput>,
    defaultValues: {
      patientId,
      visitId,
      doctorId: visitId === null ? firstDoctor : "",
      start: visitId === null ? "PLANNED" : "IN_PROGRESS",
      name: "",
      description: "",
      estimatedCost: "",
      note: "",
      nextDueOn: "",
    },
    resetOptions: FORM_RESET_OPTIONS,
  });
  const [typed, start] = useWatch({ control, name: ["name", "start"] });

  return (
    <FormSheet
      open={open}
      title={words.newTitle}
      onClose={onClose}
      submitLabel={words.add}
      submitIcon={Plus}
      onSubmit={handleSubmit(async () => {
        if ((await adding.add(getValues())) !== undefined) onClose();
      })}
      submitting={adding.adding}
    >
      <NameField
        typed={typed}
        field={register("name")}
        error={errors.name?.message}
        onPick={(procedure) => {
          setValue("name", procedure.name, { shouldDirty: true, shouldValidate: true });
          setValue("estimatedCost", paiseToText(procedure.pricePaise), { shouldDirty: true });
        }}
      />
      <TextAreaField
        label={words.descriptionLabel}
        rows={2}
        autoComplete="off"
        maxLength={TEXT_LIMITS.treatmentDescription}
        error={errors.description?.message}
        {...register("description")}
      />
      <MoneyField
        label={words.estimateLabel}
        optional
        error={errors.estimatedCost?.message}
        {...register("estimatedCost")}
      />
      {visitId === null && (
        <Controller
          control={control}
          name="doctorId"
          render={({ field }) => (
            <SelectField
              ref={field.ref}
              label={appointments.doctorLabel}
              options={doctorOptions(doctors)}
              placeholder={field.value ? undefined : appointments.chooseDoctor}
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.doctorId?.message}
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="start"
        render={({ field }) => (
          <SegmentedControl
            label={words.startLabel}
            value={field.value}
            options={START_OPTIONS}
            onChange={field.onChange}
          />
        )}
      />
      {visitId !== null && start === "IN_PROGRESS" && (
        <TextAreaField
          label={words.firstNoteLabel}
          rows={2}
          autoComplete="off"
          maxLength={TEXT_LIMITS.sessionNote}
          error={errors.note?.message}
          {...register("note")}
        />
      )}
      <NextDueFields control={control} today={today} error={errors.nextDueOn?.message} setValue={setValue} />
    </FormSheet>
  );
}

/** The next sitting's chips and day (D259), in the new treatment's sheet. */
function NextDueFields({
  control,
  today,
  error,
  setValue,
}: {
  control: ReturnType<typeof useForm<NewTreatmentInput>>["control"];
  today: string;
  error?: string;
  setValue: ReturnType<typeof useForm<NewTreatmentInput>>["setValue"];
}) {
  const chosen = useWatch({ control, name: "nextDueOn" });
  const choices = FOLLOW_UP_CHOICES.map((choice) => ({
    value: choice.key as FollowUpChoice | "",
    label: UI_TEXT.visit.followUpChoices[choice.key],
    day: "days" in choice ? addDaysKey(today, choice.days) : addMonthsKey(today, choice.months),
  }));
  return (
    <>
      <ChoiceChips
        label={words.nextDueChoicesLabel}
        value={choices.find((choice) => choice.day === chosen)?.value ?? ""}
        options={choices}
        onChange={(key) =>
          setValue("nextDueOn", choices.find((choice) => choice.value === key)!.day, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        wrap
      />
      <Controller
        control={control}
        name="nextDueOn"
        render={({ field }) => (
          <DateField
            ref={field.ref}
            label={words.nextDueLabel}
            hint={words.nextDueHint}
            optional
            clearable
            min={today}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={error}
          />
        )}
      />
    </>
  );
}

type DetailsCopy = {
  name: string;
  description: string | null;
  estimatedCostPaise: number | null;
  doctorId: string;
};

/** A treatment's details as the screen holds them, in a fixed order. */
const detailsCopy = (treatment: Treatment): DetailsCopy => ({
  name: treatment.name,
  description: treatment.description,
  estimatedCostPaise: treatment.estimatedCostPaise,
  doctorId: treatment.doctorId,
});

/**
 * A treatment's details, edited (D251, D252): its name, what it is, the
 * estimate — correctable after it closes — and, while it is open, its
 * doctor. Saved from the copy the sheet opened on; should someone save it
 * meanwhile, theirs shows beside what is typed.
 */
export function EditTreatmentSheet({
  treatment,
  visitId,
  open,
  onClose,
  onDone,
}: {
  treatment: Treatment;
  visitId: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const doctors = useDoctors().data ?? [];
  const section = useVisitSection<DetailsCopy, TreatmentEditInput>({
    saved: detailsCopy(treatment),
    toInput: (copy) => ({
      name: copy.name,
      description: copy.description ?? "",
      estimatedCost: copy.estimatedCostPaise === null ? "" : paiseToText(copy.estimatedCostPaise),
      doctorId: copy.doctorId,
    }),
    resolver: zodResolver(treatmentEditSchema) as unknown as Resolver<TreatmentEditInput>,
  });
  const change = useTreatmentChange(treatment, visitId, {
    onSaved: (saved) => section.saved({ ...detailsCopy(treatment), ...saved } as DetailsCopy),
    onDone,
  });
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = section.form;
  const typed = useWatch({ control, name: "name" });
  const theirs = section.theirs;

  return (
    <FormSheet
      open={open}
      title={words.editTitle}
      onClose={onClose}
      submitLabel={UI_TEXT.actions.save}
      onSubmit={section.form.handleSubmit(() =>
        change.save({ part: "DETAILS", changes: section.form.getValues(), seen: section.seen }),
      )}
      submitting={change.saving}
    >
      <NameField
        typed={typed}
        field={register("name")}
        error={errors.name?.message}
        onPick={(procedure) => {
          setValue("name", procedure.name, { shouldDirty: true, shouldValidate: true });
          setValue("estimatedCost", paiseToText(procedure.pricePaise), { shouldDirty: true });
        }}
      />
      <TextAreaField
        label={words.descriptionLabel}
        rows={2}
        autoComplete="off"
        maxLength={TEXT_LIMITS.treatmentDescription}
        error={errors.description?.message}
        {...register("description")}
      />
      <MoneyField
        label={words.estimateLabel}
        optional
        error={errors.estimatedCost?.message}
        {...register("estimatedCost")}
      />
      {isOpen(treatment.status) && (
        <Controller
          control={control}
          name="doctorId"
          render={({ field }) => (
            <SelectField
              ref={field.ref}
              label={appointments.doctorLabel}
              options={doctorOptions(doctors, { id: treatment.doctorId, name: treatment.doctorName })}
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.doctorId?.message}
            />
          )}
        />
      )}
      {theirs !== undefined && (
        <ChangedMeanwhile onTake={section.takeTheirs}>
          <DetailList
            details={[
              { label: words.nameLabel, value: theirs.name },
              ...(theirs.description ? [{ label: words.descriptionLabel, value: theirs.description }] : []),
              ...(theirs.estimatedCostPaise === null
                ? []
                : [{ label: words.estimateLabel, value: formatPaise(theirs.estimatedCostPaise) }]),
            ]}
          />
        </ChangedMeanwhile>
      )}
    </FormSheet>
  );
}
