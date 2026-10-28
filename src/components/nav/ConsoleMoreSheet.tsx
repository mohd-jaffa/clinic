"use client";

import { Avatar } from "@/components/ui/avatar";
import { Row, RowIcon, RowList } from "@/components/ui/row";
import { Sheet } from "@/components/ui/sheet";
import { UI_TEXT } from "@/constants/messages";
import { CONSOLE_MORE_NAV } from "@/constants/navigation";
import { PLATFORM_ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { SignOutRow } from "@/features/auth/components/SignOutRow";

/**
 * The rest of the developer console, on a phone (D367): who is signed in —
 * the platform admin, with no clinic and no My account — then Settings, the
 * Error log and the Audit, each with a line on what it holds, then **Sign
 * out**. A `Sheet`, as the app's More is.
 */
export function ConsoleMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  if (!profile) return null;

  return (
    <Sheet open={open} onClose={onClose} title={UI_TEXT.nav.more}>
      <div className="grid gap-5 pb-2">
        <RowList look="menu">
          <Row
            look="menu"
            leading={<Avatar name={profile.fullName} />}
            title={profile.fullName}
            subtitle={PLATFORM_ROLE_LABELS.DEV}
          />
        </RowList>
        <nav aria-label={UI_TEXT.nav.more}>
          <RowList look="menu">
            {CONSOLE_MORE_NAV.map(({ id, label, icon, href, hint }) => (
              <Row
                look="menu"
                key={id}
                href={href}
                onClick={onClose}
                leading={<RowIcon icon={icon} />}
                title={label}
                subtitle={hint}
              />
            ))}
          </RowList>
        </nav>
        <RowList look="menu">
          <SignOutRow onSignedOut={onClose} />
        </RowList>
      </div>
    </Sheet>
  );
}
