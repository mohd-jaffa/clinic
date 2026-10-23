import { withClinicRoute } from "@/features/auth/guard";
import { getExpenseTotals } from "@/features/expenses/api";
import { readQuery } from "@/lib/api/handler";
import { expenseTotalsQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A month's totals — the whole and each category's (plan §16; D330, D331), for `expenses.view`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "expenses.view" }, (tenant) =>
    getExpenseTotals(tenant, readQuery(request, expenseTotalsQuerySchema)),
  );
}
