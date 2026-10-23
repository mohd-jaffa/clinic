import { withClinicRoute } from "@/features/auth/guard";
import { archiveExpense } from "@/features/expenses/api";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { archiveExpenseSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Archive an expense — it leaves the totals — or restore it (plan §16; D331), for `expenses.edit`. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "expenses.edit" }, async (context) =>
    archiveExpense(context, (await params).id, await readJson(request, archiveExpenseSchema), context.requestId),
  );
}
