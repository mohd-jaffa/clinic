import { withClinicRoute } from "@/features/auth/guard";
import { changeExpense } from "@/features/expenses/api";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { expenseSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Correct an expense of any month (plan §16; D333), for `expenses.edit`. */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "expenses.edit" }, async (context) =>
    changeExpense(context, (await params).id, await readJson(request, expenseSchema), context.requestId),
  );
}
