"use client";

import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";

import { ExpenseCategoriesClient } from "../api.client";
import { useCatalogueChange } from "../hooks/useCatalogueChange";
import { useEntryEditor } from "../hooks/useEntryEditor";
import { useExpenseCategories } from "../hooks/useExpenseCategories";
import type { ExpenseCategory } from "../types";
import { activeCount, CatalogueScreen } from "./CatalogueScreen";
import { ExpenseCategorySheet } from "./ExpenseCategorySheet";
import { OrderedCatalogue } from "./OrderedCatalogue";

const { expenseCategories } = UI_TEXT;
const title = UI_TEXT.settings.items.expenseCategories.label;

/**
 * Expense categories (plan §9, D40), for `settings.manage`: how the clinic's
 * spending is grouped, in its order — new ones join the end (D81). One opens
 * its sheet to be renamed or archived; archived ones can be restored (D80);
 * one is always kept (D83).
 */
export function ExpenseCategories() {
  const query = useExpenseCategories();
  return (
    <CatalogueScreen
      title={title}
      subtitle={query.data && expenseCategories.count(activeCount(query.data))}
      query={query}
      loadFailed="EXPENSE_CATEGORIES_LOAD_FAILED"
    >
      {(categories) => <Categories categories={categories} />}
    </CatalogueScreen>
  );
}

function Categories({ categories }: { categories: readonly ExpenseCategory[] }) {
  const editor = useEntryEditor<ExpenseCategory>();
  const { restore, restoring } = useCatalogueChange({
    change: ExpenseCategoriesClient.change,
    list: apiRoutes.expenseCategories.list,
  });

  return (
    <>
      <OrderedCatalogue
        entries={categories}
        label={title}
        addLabel={expenseCategories.add}
        orderNote={expenseCategories.order}
        onAdd={editor.add}
        onEdit={editor.edit}
        onRestore={(category) => void restore(category)}
        restoring={restoring}
      />
      <ExpenseCategorySheet key={editor.key} open={editor.open} onClose={editor.close} category={editor.entry} />
    </>
  );
}
