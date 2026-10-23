import { withClinicRoute } from "@/features/auth/guard";
import { createExpense, listExpenses } from "@/features/expenses/api";
import { readJson, readQuery } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { expenseSchema, expensesQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of a month's expenses (plan §16; D330 – D332), one category's or all, in use or archived, for `expenses.view`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "expenses.view" }, (tenant) =>
    listExpenses(tenant, readQuery(request, expensesQuerySchema)),
  );
}

/** Add an expense (plan §16; D328, D329), for `expenses.create` — once per Idempotency-Key. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "expenses.create", successStatus: 201 }, async (context) =>
    createExpense(context, await readJson(request, expenseSchema), readIdempotencyKey(request), context.requestId),
  );
}
