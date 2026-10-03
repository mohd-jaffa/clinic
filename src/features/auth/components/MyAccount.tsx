"use client";

import { KeyRound, Mail, Smartphone, UserRound } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { CoastHeader } from "@/components/ui/coast-header";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowIcon, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UI_TEXT } from "@/constants/messages";
import { SETTINGS_ROUTE } from "@/constants/navigation";
import { CLINIC_ROLE_LABELS } from "@/constants/roles";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { formatPhoneDigits } from "@/lib/phone";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { THEME_PREFERENCE_LABELS, THEME_PREFERENCES } from "@/lib/theme/themes";

import { useAuth } from "../AuthProvider";
import { ChangePasswordSheet } from "./ChangePasswordSheet";
import { NameSheet } from "./NameSheet";
import { PhoneSheet } from "./PhoneSheet";
import { SignOutRow } from "./SignOutRow";

const { account } = UI_TEXT;

type Changing = "name" | "phone" | "password";

const THEME_OPTIONS = THEME_PREFERENCES.map((value) => ({ value, label: THEME_PREFERENCE_LABELS[value] }));

/**
 * My account (plan §5.4, D72). The land holds who they are — initials, name,
 * where they work and as what. On the ground: their details, each opening a
 * sheet of its own — the email only shown, since changing the sign-in email
 * comes later — the password, the theme for this device (D36), and Sign out,
 * which asks first. From 1024 px the details and the password stand beside
 * the theme and Sign out. In a view-only clinic the name and mobile cannot be
 * changed, and say why; the password, the theme and Sign out still work
 * (plan §7.2).
 */
export function MyAccount() {
  const { profile, membership } = useAuth();
  const { preference, setPreference } = useTheme();
  const { readOnly } = useReadOnly();
  const [changing, setChanging] = useState<Changing | null>(null);
  const close = () => setChanging(null);

  if (!profile) return null;

  return (
    <>
      <CoastHeader>
        <div className="grid gap-5 pb-6">
          <PageHeader title={UI_TEXT.nav.myAccount} back={SETTINGS_ROUTE} />
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={profile.fullName} size="lg" on="land" />
            <div className="min-w-0">
              <p className="truncate text-title font-bold">{profile.fullName}</p>
              {membership && (
                <p className="truncate text-land-muted">
                  {UI_TEXT.nav.membership(membership.clinicName, CLINIC_ROLE_LABELS[membership.role])}
                </p>
              )}
            </div>
          </div>
        </div>
      </CoastHeader>

      <div className="grid grid-cols-1 gap-8 px-4 pt-4 md:px-8 lg:grid-cols-2 lg:items-start lg:gap-x-10">
        <div className="grid grid-cols-1 gap-8">
          <section aria-labelledby="account-details">
            <SectionHeading id="account-details" title={account.details} />
            <RowList look="menu">
              <Row
                look="menu"
                leading={<RowIcon icon={UserRound} />}
                title={account.nameLabel}
                subtitle={profile.fullName}
                onClick={readOnly ? undefined : () => setChanging("name")}
              />
              <Row
                look="menu"
                leading={<RowIcon icon={Smartphone} />}
                title={account.phoneLabel}
                subtitle={
                  profile.phone ? `${UI_TEXT.fields.phonePrefix} ${formatPhoneDigits(profile.phone)}` : account.noPhone
                }
                onClick={readOnly ? undefined : () => setChanging("phone")}
              />
              <Row look="menu" leading={<RowIcon icon={Mail} />} title={account.emailLabel} subtitle={profile.email} />
            </RowList>
            <ReadOnlyNote />
          </section>

          <section aria-labelledby="account-password">
            <SectionHeading id="account-password" title={account.password} />
            <RowList look="menu">
              <Row
                look="menu"
                leading={<RowIcon icon={KeyRound} />}
                title={account.changePassword}
                subtitle={account.changePasswordHint}
                onClick={() => setChanging("password")}
              />
            </RowList>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <section aria-labelledby="account-theme">
            <SectionHeading id="account-theme" title={UI_TEXT.theme.label} />
            <SegmentedControl
              label={UI_TEXT.theme.label}
              value={preference}
              options={THEME_OPTIONS}
              onChange={setPreference}
            />
            <p className="mt-2 text-small text-muted">{UI_TEXT.theme.hint}</p>
          </section>

          <RowList look="menu">
            <SignOutRow />
          </RowList>
        </div>
      </div>

      <NameSheet open={changing === "name"} onClose={close} />
      <PhoneSheet open={changing === "phone"} onClose={close} />
      <ChangePasswordSheet open={changing === "password"} onClose={close} />
    </>
  );
}
