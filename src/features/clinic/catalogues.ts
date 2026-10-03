import type { ErrorMessageCode } from "@/constants/messages";
import { tenantRecords, type OrderBy } from "@/lib/supabase/records";
import type { Tenant } from "@/lib/supabase/tenant";
import type { AppointmentTypePayload, ExpenseCategoryPayload, ServicePayload } from "@/lib/validation";

import type {
  AppointmentType,
  AppointmentTypeRow,
  ExpenseCategory,
  ExpenseCategoryRow,
  Service,
  ServiceRow,
} from "./types";

/**
 * The clinic's catalogues (plan §9, §28.2): the price list, appointment types
 * and expense categories. Every member reads them — the pickers need them —
 * and whoever holds `settings.manage` changes them while the clinic can
 * write, under the 0007 policies; 0010 keeps one of each and puts a new one
 * last. Nothing is deleted: an entry is archived and may be restored (D80).
 * Every change is audited with its values, none of them clinical.
 */

/** A change to one entry: its details, or archiving (`false`) or restoring (`true`) it. */
export interface CatalogueChange<Details> {
  details?: Details;
  active?: boolean;
}

interface Catalogue<Row, Entry, Details> {
  table: string;
  columns: string;
  order: readonly OrderBy[];
  taken: ErrorMessageCode;
  toEntry: (row: Row) => Entry;
  toColumns: (details: Details) => Record<string, unknown>;
}

/** Archiving or restoring is audited as that; anything else is an update. */
const actionOf = (active: boolean | undefined) =>
  active === undefined ? "UPDATE" : active ? ("RESTORE" as const) : ("ARCHIVE" as const);

function catalogue<Row extends { id: string }, Entry, Details>(spec: Catalogue<Row, Entry, Details>) {
  const records = (tenant: Tenant) => tenantRecords<Row>(tenant, spec.table, spec);
  return {
    /** Every entry, archived ones too, in the order the clinic sees them. */
    list: async (tenant: Tenant): Promise<Entry[]> => (await records(tenant).list(spec.order)).map(spec.toEntry),

    add: async (tenant: Tenant, details: Details, requestId?: string): Promise<Entry> =>
      spec.toEntry(await records(tenant).insert(spec.toColumns(details), { requestId })),

    change: async (
      tenant: Tenant,
      id: string,
      { details, active }: CatalogueChange<Details>,
      requestId?: string,
    ): Promise<Entry> => {
      const patch = { ...(details && spec.toColumns(details)), ...(active !== undefined && { active }) };
      return spec.toEntry(await records(tenant).update(id, patch, { action: actionOf(active), requestId }));
    },
  };
}

/** The price list, by name; the screen groups it by category (D82). */
export const services = catalogue<ServiceRow, Service, ServicePayload>({
  table: "services",
  columns: "id, name, category, price_paise, active",
  order: [{ column: "name" }],
  taken: "SERVICE_ALREADY_EXISTS",
  toEntry: (row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    pricePaise: row.price_paise,
    active: row.active,
  }),
  toColumns: ({ name, category, price }) => ({ name, category, price_paise: price }),
});

/** Appointment types in the clinic's order: the seeds', then each new one last (D81). */
export const appointmentTypes = catalogue<AppointmentTypeRow, AppointmentType, AppointmentTypePayload>({
  table: "appointment_types",
  columns: "id, name, default_minutes, position, active",
  order: [{ column: "position" }, { column: "name" }],
  taken: "APPOINTMENT_TYPE_ALREADY_EXISTS",
  toEntry: (row) => ({ id: row.id, name: row.name, minutes: row.default_minutes, active: row.active }),
  toColumns: ({ name, minutes }) => ({ name, default_minutes: minutes }),
});

/** Expense categories in the clinic's order, as appointment types are. */
export const expenseCategories = catalogue<ExpenseCategoryRow, ExpenseCategory, ExpenseCategoryPayload>({
  table: "expense_categories",
  columns: "id, name, position, active",
  order: [{ column: "position" }, { column: "name" }],
  taken: "EXPENSE_CATEGORY_ALREADY_EXISTS",
  toEntry: (row) => ({ id: row.id, name: row.name, active: row.active }),
  toColumns: ({ name }) => ({ name }),
});
