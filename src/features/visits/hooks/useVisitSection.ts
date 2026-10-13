"use client";

import { useEffect, useState } from "react";
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";

import { FORM_RESET_OPTIONS } from "@/lib/validation";

/**
 * One of a visit's sections as a form on the screen (D202, D206).
 *
 * Untouched, it follows the visit as it is read again — vitals an assistant
 * took show on the doctor's screen. Once typed into, it keeps what is typed;
 * should someone save the section meanwhile, theirs is held beside it
 * (`theirs`), to be taken (`takeTheirs`) or saved over knowingly. A save is
 * made from what the form started from (`seen`) — theirs, once shown — so the
 * database refuses one made from an older copy (VISIT_CHANGED), and the
 * newer copy then arrives here as theirs.
 */
export function useVisitSection<Saved, Input extends FieldValues>({
  saved,
  toInput,
  resolver,
}: {
  /** The section as last read. */
  saved: Saved;
  /** The form's fields for a copy of it. */
  toInput: (saved: Saved) => Input;
  resolver: Resolver<Input>;
}) {
  const form = useForm<Input>({
    resolver,
    defaultValues: toInput(saved) as DefaultValues<Input>,
    resetOptions: FORM_RESET_OPTIONS,
  });
  const savedKey = JSON.stringify(saved);
  // The copy the form began from — what a save is made from — and the copy
  // read at that moment: until a newer one is read, that one is not news.
  // Just saved, the screen still holds the copy from before the save.
  const [base, setBase] = useState({ key: savedKey, copy: saved, read: savedKey });
  const { isDirty } = form.formState;
  const newer = savedKey !== base.key && savedKey !== base.read;

  // Untouched, a newer copy read becomes the form's; the save read back is the copy now read.
  if (!isDirty && newer) setBase({ key: savedKey, copy: saved, read: savedKey });
  else if (savedKey === base.key && savedKey !== base.read) setBase({ ...base, read: savedKey });
  const theirs = isDirty && newer ? saved : undefined;

  /**
   * The form shows a copy. A reset forgets which fields are on the screen
   * until they register again — and with the React Compiler a typed field's
   * register() is not called again — so a second reset would not reach what
   * the screen shows. Each field is set as well; react-hook-form keeps their
   * refs (FORM_RESET_OPTIONS).
   */
  const show = (copy: Saved) => {
    const values = toInput(copy);
    form.reset(values);
    const set = form.setValue as (name: string, value: unknown) => void;
    for (const [name, value] of Object.entries(values)) set(name, value);
  };

  // The form shows the copy it began from (react-hook-form keeps its own state).
  useEffect(() => {
    show(base.copy);
    // Only a new copy moves it; what is typed never does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.key]);

  /** Starts the form again from a copy: the one just saved, or theirs. */
  const adopt = (copy: Saved) => {
    setBase({ key: JSON.stringify(copy), copy, read: savedKey });
    show(copy);
  };

  return {
    form,
    /** What a save is made from: theirs, once shown — so saving keeps yours knowingly — or what the form began from. */
    seen: theirs !== undefined ? theirs : base.copy,
    theirs,
    takeTheirs: () => adopt(saved),
    /** The section as saved: the form starts again from it. */
    saved: adopt,
    dirty: isDirty,
  };
}
