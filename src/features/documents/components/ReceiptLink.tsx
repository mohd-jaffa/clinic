"use client";

import { ReceiptText } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";

const { plan: words } = UI_TEXT;

/**
 * A plan payment's receipt (plan §7.5; D393, D395): a small capsule that
 * opens the PDF itself in the browser's own viewer, beside the app, to print
 * or save — on the owner's Plan screen and the console's clinic page alike.
 */
export function ReceiptLink({ href, number }: { href: string; number: string }) {
  return (
    <LinkButton
      href={href}
      file
      newTab
      label={words.receipt}
      accessibleName={words.receiptOf(number)}
      icon={ReceiptText}
      variant="secondary"
      size="sm"
    />
  );
}
