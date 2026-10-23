import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { expenseCategories } from "@/features/clinic/catalogues";
import { getExpenseTotals, listExpenses } from "@/features/expenses/api";
import { Expenses } from "@/features/expenses/components/Expenses";
import { expensesKey, expenseTotalsKey } from "@/features/expenses/keys";
import { monthOf, thisMonth } from "@/features/expenses/month";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.expenses };

export default function ExpensesPage() {
  // This month (D330), as the screen opens on it.
  const range = monthOf(thisMonth());
  return (
    <AppScreen
      access="expenses.view"
      queries={{
        [expenseTotalsKey(range)]: (tenant) => getExpenseTotals(tenant, range),
        [apiRoutes.expenseCategories.list]: expenseCategories.list,
      }}
      pages={{ [expensesKey(range)]: (tenant) => listExpenses(tenant, { ...range, archived: false }) }}
    >
      <Expenses />
    </AppScreen>
  );
}
