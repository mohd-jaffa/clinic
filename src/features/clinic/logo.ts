import { LOGO_MIME_TYPES, type LogoMimeType } from "@/constants/uploads";
import { apiRoutes } from "@/lib/query/keys";

/**
 * What a logo file really is, read from its first bytes (AGENTS.md §20). The
 * type a browser declares is only the file's name talking, so it is never
 * trusted: a script renamed `logo.png` is not a PNG here. Ported from Brio.
 */
const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  bytes.length >= at + signature.length && signature.every((byte, index) => bytes[at + index] === byte);

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG = [0xff, 0xd8, 0xff] as const;
const RIFF = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF"
const WEBP = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP", after the chunk size

/** How many of a file's first bytes say what it is. */
export const SIGNATURE_BYTES = 12;

export function sniffLogoType(bytes: Uint8Array): LogoMimeType | null {
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  return null;
}

export function isLogoMimeType(type: string): type is LogoMimeType {
  return (LOGO_MIME_TYPES as readonly string[]).includes(type);
}

/** The folder every logo a clinic has had is kept in (plan §28.8). */
export function logoFolder(clinicId: string): string {
  return `clinics/${clinicId}/logo`;
}

/**
 * Where a clinic's logo is stored: `clinics/{clinic}/logo/{logo id}`. The
 * database refuses a reference outside the clinic's own folder, and the
 * bucket's policies refuse to read or write one.
 */
export function logoPath(clinicId: string, logoId: string): string {
  return `${logoFolder(clinicId)}/${logoId}`;
}

/** The id at the end of a logo's path, which is also its version. */
export function logoVersion(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Where the browser reads the logo: a new logo, a new address, so no screen shows the old one. */
export function logoUrl(path: string | null): string | null {
  return path ? `${apiRoutes.clinic.logo}?v=${logoVersion(path)}` : null;
}

/**
 * How the logo is answered: as the image it was read to be and nothing else
 * — the browser runs nothing in it — and, like every API answer, never kept
 * (AGENTS.md §26).
 */
export function logoResponse(file: Blob, { type, requestId }: { type: LogoMimeType; requestId: string }): Response {
  return new Response(file, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "x-request-id": requestId,
    },
  });
}
