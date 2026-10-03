import { Figtree } from "next/font/google";

/**
 * The app's one face (D64), regular and bold, served from the app itself —
 * for the root layout and for the global error screen, which replaces it and
 * brings its own document. The rupee sign is in Figtree's latin-ext subset,
 * so both are loaded.
 */
export const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
});
