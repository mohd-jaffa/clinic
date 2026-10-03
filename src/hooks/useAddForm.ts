"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

import { ADD_PARAM, type QuickAddItem } from "@/constants/navigation";

/**
 * A screen's own add form, open while the address says so (D67): the ＋'s
 * action arrives with `?add=` naming it, and the screen's own Add button
 * puts it there too — so Back closes the form, and the outcome is seen in
 * place. Closing a form the screen opened steps back, leaving no extra
 * entry; one that arrived open takes the mark off in place.
 */
export function useAddForm(form: QuickAddItem["key"]) {
  const router = useRouter();
  const pathname = usePathname();
  const open = useSearchParams().get(ADD_PARAM) === form;
  const opened = useRef(false);
  return {
    open,
    show: () => {
      opened.current = true;
      router.push(`${pathname}?${ADD_PARAM}=${form}`, { scroll: false });
    },
    close: () => {
      if (opened.current) router.back();
      else router.replace(pathname, { scroll: false });
      opened.current = false;
    },
  };
}
