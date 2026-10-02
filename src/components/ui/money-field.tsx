"use client";

import { forwardRef } from "react";

import { CURRENCY_SYMBOL } from "@/lib/format/currency";
import { UI_TEXT } from "@/constants/messages";

import { TextField, type TextFieldProps } from "./text-field";

/**
 * An amount in rupees: "₹" fixed before what is typed, and the phone's
 * decimal pad. The field holds the text as typed ("1,500.50"); the schema
 * (`paiseText`) reads it into whole paise, so no float is ever made here
 * (AGENTS.md §16).
 */
export const MoneyField = forwardRef<HTMLInputElement, Omit<TextFieldProps, "prefix" | "type" | "inputMode">>(
  function MoneyField(props, ref) {
    return (
      <TextField
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={UI_TEXT.fields.amountPlaceholder}
        prefix={CURRENCY_SYMBOL}
        {...props}
      />
    );
  },
);
