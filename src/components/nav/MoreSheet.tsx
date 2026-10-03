"use client";

import { Avatar } from "@/components/ui/avatar";
import { IconChip } from "@/components/ui/icon-chip";
import { Row, RowList } from "@/components/ui/row";
import { Sheet } from "@/components/ui/sheet";
import { UI_TEXT } from "@/constants/messages";
import { MORE_NAV, MY_ACCOUNT_ROUTE, placesFor } from "@/constants/navigation";
import { CLINIC_ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { SignOutRow } from "@/features/auth/components/SignOutRow";

/**
 * The rest of the app, on a phone (plan §31.1, D68): it opens on who is
 * signed in — their name, clinic and role, leading to My account — then the
 * places the bottom bar does not hold that they may open, each with a line on
 * what it holds, then **Sign out**. It is a `Sheet`, so the page behind is
 * inert while it is open and the focus goes back to More when it closes.
 */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, membership } = useAuth();
  if (!profile || !membership) return null;

  return (
    <Sheet open={open} onClose={onClose} title={UI_TEXT.nav.more}>
      <div className="grid gap-5 pb-2">
        <RowList>
          <Row
            href={MY_ACCOUNT_ROUTE}
            onClick={onClose}
            leading={<Avatar name={profile.fullName} />}
            title={profile.fullName}
            subtitle={UI_TEXT.nav.membership(membership.clinicName, CLINIC_ROLE_LABELS[membership.role])}
          />
        </RowList>
        <nav aria-label={UI_TEXT.nav.more}>
          <RowList>
            {placesFor(membership, MORE_NAV).map(({ id, label, icon, href, hint }) => (
              <Row
                key={id}
                href={href}
                onClick={onClose}
                leading={<IconChip icon={icon} />}
                title={label}
                subtitle={hint}
              />
            ))}
          </RowList>
        </nav>
        <RowList>
          <SignOutRow onSignedOut={onClose} />
        </RowList>
      </div>
    </Sheet>
  );
}
