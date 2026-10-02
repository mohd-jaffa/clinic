import type { Metadata, Viewport } from "next";

import { UI_TEXT } from "@/constants/messages";

import "./globals.css";

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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
