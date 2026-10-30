"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldErrors, type Resolver, type UseFormRegister } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyField } from "@/components/ui/money-field";
import { PhoneField } from "@/components/ui/phone-field";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import {
  PLATFORM_SETTING_GROUPS,
  type EditableSettingKey,
  type PlatformSettingGroup,
  type PlatformSettings,
} from "@/constants/platform";
import {
  FORM_RESET_OPTIONS,
  platformSettingsSchema,
  type PlatformSettingsInput,
  type PlatformSettingsPayload,
} from "@/lib/validation";

import { useSaveSettings } from "../hooks/useSaveSettings";
import { SETTING_KINDS, settingHint, settingText } from "../settings";

const { console: words } = UI_TEXT;

/** A group's fields as they start: each setting as it would be typed. */
const formOf = (group: PlatformSettingGroup, settings: PlatformSettings) =>
  Object.fromEntries(
    PLATFORM_SETTING_GROUPS[group].map((key) => [key, settingText(key, settings)]),
  ) as PlatformSettingsInput;

/** One setting's field, as its kind is typed, with its default and bounds under it (plan §20.4). */
function SettingField({
  name,
  register,
  errors,
}: {
  name: EditableSettingKey;
  register: UseFormRegister<PlatformSettingsInput>;
  errors: FieldErrors<PlatformSettingsInput>;
}) {
  const shared = {
    label: words.settingNames[name],
    hint: settingHint(name),
    error: errors[name]?.message,
    autoComplete: "off",
    ...register(name),
  };
  switch (SETTING_KINDS[name]) {
    case "price":
      return <MoneyField required {...shared} />;
    case "days":
    case "rows":
      return <TextField required inputMode="numeric" {...shared} />;
    case "mobile":
      return <PhoneField {...shared} />;
    case "email":
      return <TextField type="email" maxLength={TEXT_LIMITS.email} {...shared} />;
    case "upi":
      return <TextField maxLength={TEXT_LIMITS.upiId} autoCapitalize="none" spellCheck={false} {...shared} />;
    case "name":
      return <TextField maxLength={TEXT_LIMITS.personName} {...shared} />;
    default:
      return <TextField {...shared} />;
  }
}

/**
 * A group of the platform settings, changed in a sheet of its own (plan
 * §20.4; D378): each setting's field with its default and bounds; Save asks
 * first, saying each change and when it takes effect (D381). Saved, the
 * sheet keeps what was saved.
 */
export function SettingsSheet({
  group,
  settings,
  open,
  onClose,
}: {
  group: PlatformSettingGroup;
  settings: PlatformSettings;
  open: boolean;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<PlatformSettingsInput, unknown, PlatformSettingsPayload>({
    resolver: zodResolver(platformSettingsSchema) as Resolver<PlatformSettingsInput, unknown, PlatformSettingsPayload>,
    defaultValues: formOf(group, settings),
    resetOptions: FORM_RESET_OPTIONS,
  });
  const saving = useSaveSettings(settings, (saved) => {
    if (saved) reset(formOf(group, saved));
    onClose();
  });

  return (
    <FormSheet
      open={open}
      title={words.settingGroups[group]}
      onClose={onClose}
      onSubmit={handleSubmit((payload) => saving.save(getValues(), payload))}
      submitting={saving.submitting}
    >
      {PLATFORM_SETTING_GROUPS[group].map((key) => (
        <SettingField key={key} name={key} register={register} errors={errors} />
      ))}
    </FormSheet>
  );
}
