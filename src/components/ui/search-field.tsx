"use client";

import { Search, X } from "lucide-react";
import { useId, useRef } from "react";

import { UI_TEXT } from "@/constants/messages";

import { cn } from "./cn";
import { FIELD_WELL } from "./field";

/**
 * The search box over a list (plan §32.2): a capsule with a search mark, and a
 * way to empty it once something is typed. The placeholder names the field for
 * a screen reader too, since a placeholder stops being a name the moment
 * something is typed. Emptying it puts the focus back in it, ready for the
 * next name.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Search
        size={20}
        strokeWidth={2.25}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-muted"
      />
      <input
        ref={input}
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          FIELD_WELL,
          "pl-13 text-ellipsis placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none",
          value && "pr-13",
        )}
      />
      {value && (
        <button
          type="button"
          aria-label={UI_TEXT.fields.clearSearch}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink"
        >
          <X size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
