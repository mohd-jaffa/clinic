"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRef } from "react";

import { ADD_PARAM, type QuickAddItem } from "@/constants/navigation";

/**
 * A screen's own add form, open while the address says so (D67): the ＋'s
 * action arrives with `?add=` naming it, and the screen's own Add button
 * puts it there too — so Back closes the form, and the outcome is seen in
 * place. Closing a form the screen opened steps back, leaving no extra
 * entry; one that arrived open takes the mark off in place.
 *
 * Only the address changes, through the browser's own history, which the
 * router follows (`useSearchParams`): opening or closing a form asks the
 * server for nothing, so a form closing after a save is gone at once, with
 * its card still up (plan §37.1).
 */
export function useAddForm(form: QuickAddItem["key"]) {
  const pathname = usePathname();
  const open = useSearchParams().get(ADD_PARAM) === form;
  const opened = useRef(false);
  return {
    open,
    show: () => {
      opened.current = true;
      window.history.pushState(null, "", `${pathname}?${ADD_PARAM}=${form}`);
    },
    close: () => {
      if (opened.current) window.history.back();
      else window.history.replaceState(null, "", pathname);
      opened.current = false;
    },
  };
}
