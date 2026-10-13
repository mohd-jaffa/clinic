import { Siren } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";

/**
 * **Urgent** (D201): the tag on a patient marked so, wherever they are shown
 * — a waiting or With doctor row, the lake, their appointment, their visit.
 * Coral, with a siren, and the word, which carries it.
 */
export function UrgentTag() {
  return <StatusPill label={UI_TEXT.queue.urgent} tone="attention" icon={Siren} />;
}
