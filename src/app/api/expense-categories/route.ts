import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { expenseCategories } from "@/features/clinic/catalogues";
import { readJson } from "@/lib/api/handler";
import { expenseCategorySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Expense categories (plan §9, D40), archived ones too, for any member: the pickers read them. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, (tenant) => expenseCategories.list(tenant));
}

/** A new expense category, for `settings.manage`; it joins the end of the list (D81). */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "settings.manage", successStatus: 201 }, async (context) =>
    expenseCategories.add(context, await readJson(request, expenseCategorySchema), context.requestId),
  );
}
