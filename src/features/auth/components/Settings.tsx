"use client";

import { Avatar } from "@/components/ui/avatar";
import { CoastHeader } from "@/components/ui/coast-header";
import { IconChip } from "@/components/ui/icon-chip";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import { MY_ACCOUNT_ROUTE, SETTINGS_GROUPS, settingsFor, type SettingsGroup } from "@/constants/navigation";

import { useAuth } from "../AuthProvider";
import { SignOutRow } from "./SignOutRow";

const { settings } = UI_TEXT;

function Group({ group }: { group: SettingsGroup }) {
  const id = `settings-${group.id}`;
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={group.title} />
      <RowList>
        {group.items.map(({ id: key, label, hint, icon, href, attention }) => (
          <Row
            key={key}
            href={href}
            leading={<IconChip icon={icon} tone={attention ? "attention" : undefined} />}
            title={label}
            subtitle={hint}
          />
        ))}
      </RowList>
    </section>
  );
}

/**
 * The Settings index (plan §31.2, D71). The land names it and the clinic. On
 * the ground: You — My account — then the clinic's setup for those with
 * `settings.manage`, then the plan and the clinic's records for the owner,
 * each row saying what its screen holds, and Sign out last, asking first.
 * From 1024 px it stands in two columns, so the whole index is seen at once.
 */
export function Settings() {
  const { profile, membership } = useAuth();
  if (!profile || !membership) return null;

  const [first, ...rest] = settingsFor(membership, SETTINGS_GROUPS);

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={UI_TEXT.nav.places.settings} subtitle={membership.clinicName} />
        </div>
      </CoastHeader>

      <div className="grid grid-cols-1 gap-8 px-4 pt-4 md:px-8 lg:grid-cols-2 lg:items-start lg:gap-x-10">
        <div className="grid grid-cols-1 gap-8">
          <section aria-labelledby="settings-you">
            <SectionHeading id="settings-you" title={settings.you} />
            <RowList>
              <Row
                href={MY_ACCOUNT_ROUTE}
                leading={<Avatar name={profile.fullName} />}
                title={profile.fullName}
                subtitle={settings.accountHint}
              />
            </RowList>
          </section>
          {first && <Group group={first} />}
        </div>

        <div className="grid grid-cols-1 gap-8">
          {rest.map((group) => (
            <Group key={group.id} group={group} />
          ))}
          <RowList>
            <SignOutRow />
          </RowList>
        </div>
      </div>
    </>
  );
}
