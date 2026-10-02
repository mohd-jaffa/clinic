"use client";

import { forwardRef } from "react";

import { UI_TEXT } from "@/constants/messages";

import { TextField, type TextFieldProps } from "./text-field";

/**
 * An Indian mobile number (plan §5.1): "+91" fixed before what is typed, the
 * phone's number pad, and the device's own suggestion of the number. What is
 * typed is checked and set in +91 E.164 by the schema (`indianMobile`), never
 * here.
 */
export const PhoneField = forwardRef<HTMLInputElement, Omit<TextFieldProps, "prefix" | "type" | "inputMode">>(
  function PhoneField(props, ref) {
    return (
      <TextField
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={UI_TEXT.fields.phonePlaceholder}
        prefix={UI_TEXT.fields.phonePrefix}
        {...props}
      />
    );
  },
);
