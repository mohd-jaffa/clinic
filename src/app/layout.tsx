import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";

import { ResponseProvider } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { THEME_BOOT_SCRIPT, THEME_COLORS } from "@/lib/theme/themes";
import { KeyboardInset } from "@/lib/viewport/KeyboardInset";

import "./globals.css";

/**
 * The app's one face (D64), regular and bold, served from the app itself. The
 * rupee sign is in Figtree's latin-ext subset, so both are loaded.
 */
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: UI_TEXT.appName,
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
          <ResponseProvider>{children}</ResponseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
