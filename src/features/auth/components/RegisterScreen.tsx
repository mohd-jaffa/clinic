"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/ui/cn";
import { PhoneField } from "@/components/ui/phone-field";
import { useResponse } from "@/components/ui/response-card";
import { ScreenNotice } from "@/components/ui/screen-notice";
import { optionsFrom, SelectField } from "@/components/ui/select-field";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { UI_TEXT } from "@/constants/messages";
import { AUTH_ROUTES } from "@/constants/routes";
import { CLINIC_TYPE_LABELS, CLINIC_TYPES } from "@/constants/statuses";
import { ApiError } from "@/lib/api/client";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { registerSchema, type RegisterInput, type RegisterPayload } from "@/lib/validation";

import { AuthClient } from "../api.client";
import type { Registration } from "../register";
import { AuthScene, OtherWayIn } from "./AuthScene";
import { PasswordField } from "./PasswordField";
import { ResendConfirmation } from "./ResendConfirmation";

const { auth } = UI_TEXT;

const EMPTY: RegisterInput = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  seesPatients: false,
  clinicName: "",
  clinicType: "" as RegisterInput["clinicType"],
  city: "",
  address: "",
  clinicPhone: "",
};

/** Which fields each step asks for (plan §5.1): you, then your clinic. */
const STEPS = [
  { title: auth.stepYou, fields: ["fullName", "email", "phone", "password", "seesPatients"] },
  { title: auth.stepClinic, fields: ["clinicName", "clinicType", "city", "address", "clinicPhone"] },
] as const satisfies ReadonlyArray<{ title: string; fields: ReadonlyArray<keyof RegisterInput> }>;

/** A refusal about a field of the first step sends the person back to it. */
const TAKEN: Partial<Record<string, "email" | "phone">> = {
  AUTH_EMAIL_ALREADY_EXISTS: "email",
  AUTH_PHONE_ALREADY_EXISTS: "phone",
};

/**
 * Setting up a clinic (plan §5.1): the owner, then the clinic, in two short
 * steps sent as one request, so a half-finished sign-up never makes an
 * account. Once made, the screen becomes **Check your email**, with the link
 * to send again — and, for a mobile that has had a free trial before, why the
 * clinic starts view-only (D42). Nobody is signed in until the email is
 * confirmed (Q17).
 */
export function RegisterScreen() {
  const [registered, setRegistered] = useState<Registration | null>(null);

  if (registered) {
    return (
      <AuthScene
        title={auth.checkEmailTitle}
        intro={auth.checkEmailSent(registered.email)}
        aside={<OtherWayIn label={auth.backToSignIn} href={AUTH_ROUTES.signIn} />}
        announce
      >
        <div className="grid gap-5">
          {!registered.trial && <ScreenNotice tone="info">{auth.noTrial}</ScreenNotice>}
          <ResendConfirmation email={registered.email} />
        </div>
      </AuthScene>
    );
  }

  return (
    <AuthScene
      title={auth.registerTitle}
      intro={auth.registerIntro}
      aside={<OtherWayIn question={auth.haveAccount} label={auth.signIn} href={AUTH_ROUTES.signIn} />}
    >
      <RegisterForm onRegistered={setRegistered} />
    </AuthScene>
  );
}

/**
 * Each step is checked before the next is shown — so the first is whole by
 * the time the second is sent — and the server checks all of it again. Both steps stay mounted, the other hidden, so nothing typed is
 * lost going back and forth; a new step is announced by moving to its heading.
 */
function RegisterForm({ onRegistered }: { onRegistered: (registration: Registration) => void }) {
  const [step, setStep] = useState(0);
  const headings = useRef<Array<HTMLHeadingElement | null>>([]);
  const moved = useRef(false);
  const ids = [useId(), useId()];
  const respond = useResponse();

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setError,
    getValues,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterPayload>({
    resolver: zodResolver(registerSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (moved.current) headings.current[step]?.focus();
  }, [step]);

  const goTo = (next: number) => {
    moved.current = true;
    setStep(next);
  };

  const { submit, submitting } = useApiMutation(AuthClient.register, {
    onSuccess: onRegistered,
    onError: (failure) => {
      const field = failure instanceof ApiError ? TAKEN[failure.code] : undefined;
      if (field) {
        setError(field, { message: (failure as ApiError).message });
        goTo(0);
      }
      respond.failure(failure, { title: auth.registerFailed });
    },
  });

  const next = async () => {
    if (await trigger([...STEPS[0].fields], { shouldFocus: true })) goTo(1);
  };

  return (
    <form
      method="post"
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        // Enter on the first step means Next, not Create.
        if (step === 0) {
          event.preventDefault();
          void next();
          return;
        }
        // What was typed goes as typed; the route reads it with the same schema.
        void handleSubmit(() => submit(getValues()))(event);
      }}
    >
      <div className="grid gap-2">
        <p aria-live="polite" className="text-small font-bold text-muted">
          {auth.stepOf(step + 1, STEPS.length)}
        </p>
        <div aria-hidden="true" className="flex gap-1.5">
          {STEPS.map(({ title }, index) => (
            <span key={title} className={cn("h-1.5 flex-1 rounded-full", index <= step ? "bg-action" : "bg-line")} />
          ))}
        </div>
      </div>

      {STEPS.map(({ title }, index) => (
        <fieldset key={title} hidden={step !== index} aria-labelledby={ids[index]} className="grid gap-5">
          <h2
            id={ids[index]}
            ref={(element) => {
              headings.current[index] = element;
            }}
            tabIndex={-1}
            className="text-title font-bold outline-none"
          >
            {title}
          </h2>

          {index === 0 ? (
            <>
              <TextField
                label={auth.fullNameLabel}
                autoComplete="name"
                required
                error={errors.fullName?.message}
                {...register("fullName")}
              />
              <TextField
                label={auth.emailLabel}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                error={errors.email?.message}
                {...register("email")}
              />
              <PhoneField
                label={auth.phoneLabel}
                hint={auth.phoneHint}
                required
                error={errors.phone?.message}
                {...register("phone")}
              />
              <PasswordField
                label={auth.passwordLabel}
                autoComplete="new-password"
                hint={auth.newPasswordHint}
                required
                error={errors.password?.message}
                {...register("password")}
              />
              <div className="-mx-3">
                <Checkbox label={auth.seesPatients} hint={auth.seesPatientsHint} {...register("seesPatients")} />
              </div>
              <Button label={auth.next} fullWidth onClick={() => void next()} />
            </>
          ) : (
            <>
              <TextField
                label={auth.clinicNameLabel}
                autoComplete="organization"
                required
                error={errors.clinicName?.message}
                {...register("clinicName")}
              />
              <Controller
                control={control}
                name="clinicType"
                render={({ field }) => (
                  <SelectField
                    ref={field.ref}
                    label={auth.clinicTypeLabel}
                    placeholder={auth.clinicTypePlaceholder}
                    options={optionsFrom(CLINIC_TYPES, CLINIC_TYPE_LABELS)}
                    required
                    error={errors.clinicType?.message}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <TextField
                label={auth.cityLabel}
                autoComplete="address-level2"
                required
                error={errors.city?.message}
                {...register("city")}
              />
              <TextAreaField
                label={auth.addressLabel}
                autoComplete="street-address"
                required
                error={errors.address?.message}
                {...register("address")}
              />
              <TextField
                label={auth.clinicPhoneLabel}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                optional
                error={errors.clinicPhone?.message}
                {...register("clinicPhone")}
              />
              {/* On a phone, the main action on top, nearest the thumb and read first. */}
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button label={auth.back} icon={ArrowLeft} variant="secondary" onClick={() => goTo(0)} />
                <div className="sm:flex-1">
                  <Button type="submit" label={auth.createClinic} icon={Check} loading={submitting} fullWidth />
                </div>
              </div>
            </>
          )}
        </fieldset>
      ))}
    </form>
  );
}
