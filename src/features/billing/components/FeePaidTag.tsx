import { IndianRupee } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";

/** **Fee paid** (D306): on a patient whose consultation fee was collected at arrival — their queue row, their appointment. */
export function FeePaidTag() {
  return <StatusPill label={UI_TEXT.billing.feePaid} tone="live" icon={IndianRupee} />;
}
