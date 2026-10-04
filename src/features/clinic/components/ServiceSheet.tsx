"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { ArchiveButton } from "@/components/ui/archive-button";
import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyField } from "@/components/ui/money-field";
import { useResponse } from "@/components/ui/response-card";
import { optionsFrom, SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS } from "@/constants/statuses";
import { paiseToText } from "@/lib/money";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { FORM_RESET_OPTIONS, serviceSchema, type ServiceInput, type ServicePayload } from "@/lib/validation";

import { ServicesClient } from "../api.client";
import { useCatalogueChange } from "../hooks/useCatalogueChange";
import type { Service } from "../types";

const { priceList, catalogues } = UI_TEXT;

/** What the sheet holds: the service as it is, or nothing yet for a new one. */
const formOf = (service: Service | null): ServiceInput => ({
  name: service?.name ?? "",
  category: service?.category ?? ("" as ServiceInput["category"]),
  price: service ? paiseToText(service.pricePaise) : "",
});

/**
 * One line of the price list (plan §9): a new service, or one being changed —
 * its name, its category and its price. A service being changed can be
 * archived from here (D80), asked first; the last Consultation cannot (D83).
 */
export function ServiceSheet({
  open,
  onClose,
  service,
}: {
  open: boolean;
  onClose: () => void;
  /** The service being changed; none adds one. */
  service: Service | null;
}) {
  const respond = useResponse();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ServiceInput, unknown, ServicePayload>({
    resolver: zodResolver(serviceSchema),
    defaultValues: formOf(service),
    resetOptions: FORM_RESET_OPTIONS,
  });

  const { submit, submitting } = useApiMutation(
    (input: ServiceInput) =>
      service ? ServicesClient.change({ id: service.id, details: input }) : ServicesClient.add(input),
    {
      revalidate: [apiRoutes.services.list],
      onSuccess: (saved) => {
        // A new one's sheet is left empty for the next; a changed one's holds what was saved.
        reset(formOf(service && saved));
        onClose();
        respond.success({ title: service ? catalogues.savedNote(saved.name) : priceList.added(saved.name) });
      },
      onError: (failure) => respond.failure(failure, { title: priceList.notSaved }),
    },
  );

  const { archive, archiving } = useCatalogueChange({
    change: ServicesClient.change,
    list: apiRoutes.services.list,
  });

  return (
    <FormSheet
      open={open}
      title={service ? priceList.editTitle : priceList.addTitle}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit(getValues()))}
      submitting={submitting}
    >
      <TextField
        label={priceList.nameLabel}
        autoComplete="off"
        maxLength={TEXT_LIMITS.serviceName}
        required
        error={errors.name?.message}
        {...register("name")}
      />
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <SelectField
            ref={field.ref}
            label={priceList.categoryLabel}
            placeholder={priceList.categoryPlaceholder}
            options={optionsFrom(SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS)}
            required
            error={errors.category?.message}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <MoneyField
        label={priceList.priceLabel}
        hint={priceList.priceHint}
        required
        error={errors.price?.message}
        {...register("price")}
      />
      {service && (
        <ArchiveButton
          archive={() =>
            archive(service, { title: priceList.archiveTitle(service.name), message: priceList.archiveBody })
          }
          archiving={archiving}
          onArchived={onClose}
        />
      )}
    </FormSheet>
  );
}
