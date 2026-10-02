/**
 * Indian mobile numbers (plan §5.2, D9), stored as E.164 — "+919876543210" —
 * whichever way they were typed, so one number is one account or one patient.
 */
const INDIA_COUNTRY_CODE = "91";

/**
 * Accepts a bare 10-digit number, one already prefixed with 91 or +91, or a
 * leading-0 trunk-prefixed number. Indian mobile numbers start 6-9.
 * Returns null if invalid.
 */
export function toE164India(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  let national: string | null = null;
  if (digits.length === 10) {
    national = digits;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith(INDIA_COUNTRY_CODE)) {
    national = digits.slice(2);
  }

  if (!national || !/^[6-9]\d{9}$/.test(national)) return null;
  return `+${INDIA_COUNTRY_CODE}${national}`;
}

export function formatPhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.slice(1);
  }
  const national = digits.slice(0, 10);
  if (national.length <= 5) return national;
  return `${national.slice(0, 5)} ${national.slice(5)}`;
}

/** A number to dial from a tap: "tel:+919876543210". */
export function callHref(e164: string): string {
  return `tel:${e164}`;
}

/**
 * A chat with the number on WhatsApp, with no integration (plan §22.1): wa.me
 * takes it as digits, the country code first and no +, and an optional message
 * to start the chat with, which the person still sends themselves.
 */
export function whatsAppHref(e164: string, text?: string): string {
  const chat = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${chat}?text=${encodeURIComponent(text)}` : chat;
}
