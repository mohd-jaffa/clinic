"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { expenseCategorySchema, type ExpenseCategoryInput, type ExpenseCategoryPayload } from "@/lib/validation";

import { ExpenseCategoriesClient } from "../api.client";
import { useCatalogueChange } from "../hooks/useCatalogueChange";
import type { ExpenseCategory } from "../types";
import { ArchiveEntryButton } from "./ArchiveEntryButton";

const { expenseCategories, catalogues } = UI_TEXT;

/** What the sheet holds: the category's name, or nothing yet for a new one. */
const formOf = (category: ExpenseCategory | null): ExpenseCategoryInput => ({ name: category?.name ?? "" });

/**
 * One expense category (plan §9, D40): a new one, or one being renamed —
 * every expense filed under it then shows the new name. A category being
 * renamed can be archived from here (D80), asked first; the last one cannot
 * (D83).
 */
export function ExpenseCategorySheet({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  /** The category being renamed; none adds one. */
  category: ExpenseCategory | null;
}) {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ExpenseCategoryInput, unknown, ExpenseCategoryPayload>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: formOf(category),
  });

  const { submit, submitting } = useApiMutation(
    (input: ExpenseCategoryInput) =>
      category
        ? ExpenseCategoriesClient.change({ id: category.id, details: input })
        : ExpenseCategoriesClient.add(input),
    {
      revalidate: [apiRoutes.expenseCategories.list],
      onSuccess: (saved) => {
        // A new one's sheet is left empty for the next; a renamed one's holds what was saved.
        reset(formOf(category && saved));
        onClose();
        respond.success({ title: category ? catalogues.savedNote(saved.name) : expenseCategories.added(saved.name) });
      },
      onError: (failure) => respond.failure(failure, { title: expenseCategories.notSaved }),
    },
  );

  const { archive, archiving } = useCatalogueChange({
    change: ExpenseCategoriesClient.change,
    list: apiRoutes.expenseCategories.list,
  });

  return (
    <FormSheet
      open={open}
      title={category ? expenseCategories.editTitle : expenseCategories.addTitle}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit(getValues()))}
      submitting={submitting}
    >
      <TextField
        label={expenseCategories.nameLabel}
        autoComplete="off"
        maxLength={TEXT_LIMITS.catalogueName}
        required
        error={errors.name?.message}
        {...register("name")}
      />
      {category && (
        <ArchiveEntryButton
          archive={() =>
            archive(category, {
              title: expenseCategories.archiveTitle(category.name),
              message: expenseCategories.archiveBody,
            })
          }
          archiving={archiving}
          onArchived={onClose}
        />
      )}
    </FormSheet>
  );
}
