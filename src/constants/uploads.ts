/**
 * The one file a user uploads: the clinic's logo (plan §9, AGENTS.md §20).
 * The bucket repeats both limits, so a write that skips the app is held to
 * them too (0009_clinic_profile.sql).
 */

/** 500 KB. */
export const MAX_LOGO_BYTES = 500 * 1024;

/** Read from the file's own first bytes on the server, never from what the browser says it is. */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoMimeType = (typeof LOGO_MIME_TYPES)[number];

/** What the file picker offers. */
export const LOGO_ACCEPT = LOGO_MIME_TYPES.join(",");

/** The private bucket it lives in. */
export const LOGO_BUCKET = "clinic-logos";
