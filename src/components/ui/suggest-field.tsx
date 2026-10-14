"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";

import { useAnchoredPopover } from "./anchored-popover";
import { cn } from "./cn";
import { FIELD_WELL, FieldError, FieldHint, FieldLabel, useFieldIds, type FieldShell } from "./field";

/** One suggestion under the field: what it is, and a line about it. */
export interface Suggestion {
  key: string;
  label: string;
  detail?: string;
}

/** The list is never taller than this, nor than the room beside the field. */
const MAX_HEIGHT = 320;

/**
 * Typed text with suggestions under it (D211) — a medicine written before:
 * anything may be typed, and a suggestion taken fills in more than the field.
 *
 * - **Keyboard:** an editable combobox with a list (WAI-ARIA). Focus stays in
 *   the field; Down opens the list and moves through it, Up moves back,
 *   Enter takes the one the keys are on, Escape closes it — not the sheet it
 *   sits in.
 * - **Pointer:** a tap on a suggestion takes it; a tap anywhere else closes
 *   the list. Every suggestion is at least 44 px tall.
 * - **Where it opens:** in the page's top layer, set against the field, as
 *   the select's list is.
 *
 * It opens as the person types and suggestions arrive, and never by itself:
 * a field filled in, or taken from a suggestion, stays closed. It takes
 * react-hook-form's `register()` as a text field does.
 */
export const SuggestField = forwardRef<
  HTMLInputElement,
  FieldShell & {
    suggestions: readonly Suggestion[];
    onPick: (key: string) => void;
    /** What the suggestions are: the list's name. */
    listLabel: string;
    /** More that describes the field — a warning beside it. */
    describedBy?: string;
  } & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id">
>(function SuggestField(
  {
    label,
    error,
    required,
    optional,
    hint,
    suggestions,
    onPick,
    listLabel,
    describedBy,
    onChange,
    onBlur,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const { id, errorId, hintId } = useFieldIds(error, hint);
  const listId = useId();
  const control = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useImperativeHandle(ref, () => control.current!, []);

  // Asked for by typing; shown once there is something to show.
  const [wanted, setWanted] = useState(false);
  const [chosen, setActive] = useState(-1);
  const open = wanted && suggestions.length > 0;
  // The one the keys are on, never past a list that grew shorter.
  const active = Math.min(chosen, suggestions.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;
  const close = () => {
    setWanted(false);
    setActive(-1);
  };

  useAnchoredPopover({ open, panel: list, control, maxHeight: MAX_HEIGHT, onDismiss: close });

  // The suggestion the keys are on stays in view as they move.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
  });

  const take = (index: number) => {
    close();
    onPick(suggestions[index].key);
  };

  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    const last = suggestions.length - 1;
    if (event.key === "ArrowDown" && last >= 0) {
      event.preventDefault();
      setWanted(true);
      setActive(open ? Math.min(active + 1, last) : 0);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      take(active);
    } else if (event.key === "Escape" && open) {
      // Closes the list, not the sheet it sits in.
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} optional={optional} />
      <input
        id={id}
        ref={control}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId, describedBy].filter(Boolean).join(" ") || undefined}
        className={cn(FIELD_WELL, "text-ellipsis placeholder:text-muted")}
        onChange={(event) => {
          onChange?.(event);
          setWanted(true);
          setActive(-1);
        }}
        onBlur={(event) => {
          close();
          onBlur?.(event);
        }}
        onKeyDown={keys}
        {...rest}
      />
      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-label={listLabel}
        popover="manual"
        // The field keeps the focus while a suggestion is tapped.
        onMouseDown={(event) => event.preventDefault()}
        className="animate-drop-in inset-auto m-0 w-max max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-row border border-line bg-surface p-1.5 text-ink shadow-raised"
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.key}
            id={optionId(index)}
            role="option"
            aria-selected={open && index === active}
            data-active={(open && index === active) || undefined}
            onClick={() => take(index)}
            onMouseEnter={() => setActive(index)}
            className="grid min-h-11 cursor-pointer content-center rounded-row px-4 py-2 transition-colors data-[active]:bg-ground"
          >
            <span className="font-bold">{suggestion.label}</span>
            {suggestion.detail && <span className="text-small text-muted">{suggestion.detail}</span>}
          </li>
        ))}
      </ul>
      <FieldHint id={hintId} hint={hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
});
