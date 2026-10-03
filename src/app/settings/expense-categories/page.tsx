import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { expenseCategories } from "@/features/clinic/catalogues";
import { ExpenseCategories } from "@/features/clinic/components/ExpenseCategories";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.settings.items.expenseCategories.label };

export default function ExpenseCategoriesPage() {
  return (
    <AppScreen access="settings.manage" queries={{ [apiRoutes.expenseCategories.list]: expenseCategories.list }}>
      <ExpenseCategories />
    </AppScreen>
  );
}
