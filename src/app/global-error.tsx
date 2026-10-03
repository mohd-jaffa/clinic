"use client";

import { CircleAlert, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SystemScreen } from "@/components/ui/system-screen";
import { UI_TEXT } from "@/constants/messages";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/themes";

import { figtree } from "./fonts";
import "./globals.css";

/**
 * The last line (plan §31.2): the root layout itself failed. It replaces that
 * layout, so it brings its own document, title, face, styles and the
 * person's theme. Going home would meet the same layout, so it only tries again.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { system } = UI_TEXT;
  return (
    <html lang="en" suppressHydrationWarning className={`${figtree.variable} h-full antialiased`}>
      <head>
        <title>{`${system.errorTitle} · ${UI_TEXT.appName}`}</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <SystemScreen
          icon={CircleAlert}
          tone="attention"
          title={system.errorTitle}
          body={system.errorBody}
          reference={error.digest && UI_TEXT.response.reference(error.digest)}
        >
          <Button label={UI_TEXT.actions.retry} icon={RotateCcw} fullWidth onClick={retry} />
        </SystemScreen>
      </body>
    </html>
  );
}
