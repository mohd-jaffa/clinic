import type { Metadata, Viewport } from "next";

import { ResponseProvider } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { FeeCollectionProvider } from "@/features/billing/components/FeeCollection";
import { readInitialSession } from "@/features/auth/session.server";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { THEME_BOOT_SCRIPT, THEME_COLORS } from "@/lib/theme/themes";
import { KeyboardInset } from "@/lib/viewport/KeyboardInset";

import { figtree } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // A screen names itself before the app: "Home · ClinicDesk".
  title: { default: UI_TEXT.appName, template: `%s · ${UI_TEXT.appName}` },
  description: UI_TEXT.appDescription,
  applicationName: UI_TEXT.appName,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the safe-area insets reach the page: without "cover", iOS reports
  // them as 0 (plan §32.2).
  viewportFit: "cover",
  // The keyboard resizes the layout instead of covering it, where supported.
  interactiveWidget: "resizes-content",
  // The toolbar takes the ground of the device's theme; the boot script sets
  // both to the person's own choice before the first paint.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Who is signed in, as the page is drawn: no screen waits for it (AGENTS.md §9).
  const initial = await readInitialSession();
  return (
    <html lang="en" suppressHydrationWarning className={`${figtree.variable} h-full antialiased`}>
      <head>
        {/* Applies a chosen Light or Dark before anything paints (plan §32.2). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      {/* Extensions write attributes onto <body> before React hydrates; this
          ignores only <body>'s own attributes, one level deep. */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <KeyboardInset />
        <ThemeProvider>
          <AuthProvider initial={initial}>
            <ResponseProvider>
              <FeeCollectionProvider>{children}</FeeCollectionProvider>
            </ResponseProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
