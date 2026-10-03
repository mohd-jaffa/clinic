import { Lock } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { SystemNotice } from "@/components/ui/system-screen";
import { UI_TEXT } from "@/constants/messages";
import { HOME_ROUTE } from "@/constants/routes";

/**
 * A screen a member is not allowed (plan §31.2): reached by an address, since
 * the shell never offers it. It says so, who can open it for them, and the
 * way home — inside the shell, so everything they may use stays in reach.
 */
export function NoAccess() {
  const { system } = UI_TEXT;
  return (
    <div className="flex min-h-[70dvh] px-6">
      <SystemNotice icon={Lock} tone="land" title={system.noAccessTitle} body={system.noAccessBody}>
        <LinkButton href={HOME_ROUTE} label={system.toHome} fullWidth />
      </SystemNotice>
    </div>
  );
}
