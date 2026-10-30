import type { ActivityKind } from "@/constants/statuses";
import { apiRoutes, withQuery } from "@/lib/query/keys";

/** The activity log's key (plan §19): kept to a person and a kind, as the route reads them. */
export const activityKey = (person: string | null, kind: ActivityKind | null) =>
  withQuery(apiRoutes.activity.list, { person, kind });
