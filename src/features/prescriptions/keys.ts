import { apiRoutes, withQuery } from "@/lib/query/keys";

/**
 * A doctor's templates' key (D241, D242): so My account's first read and the
 * screen's hook ask for the very same thing.
 */
export const templatesKey = (doctorId: string) => withQuery(apiRoutes.prescriptionTemplates.list, { doctorId });
