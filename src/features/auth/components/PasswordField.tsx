"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import { IconButton } from "@/components/ui/button";
import { TextField, type TextFieldProps } from "@/components/ui/text-field";
import { UI_TEXT } from "@/constants/messages";

/**
 * A password, with a way to see what has been typed (ported from Brio): on a
 * phone a mistyped password is the commonest reason a sign-in fails. The
 * reveal button says what pressing it will do.
 *
 * Shown, it is a text box, and a phone's keyboard would capitalise the first
 * letter and correct the rest; the password chosen would then not be the one
 * typed at sign-in. The keyboard is told to leave it as typed — and nothing
 * here trims or changes it (AGENTS.md §24).
 */
export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, "type" | "trailing">>(
  function PasswordField(props, ref) {
    const [shown, setShown] = useState(false);
    return (
      <TextField
        {...props}
        ref={ref}
        type={shown ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        trailing={
          <IconButton
            icon={shown ? EyeOff : Eye}
            label={shown ? UI_TEXT.auth.hidePassword : UI_TEXT.auth.showPassword}
            tone="plain"
            onClick={() => setShown((visible) => !visible)}
          />
        }
      />
    );
  },
);
