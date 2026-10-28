/**
 * An email to write in the person's own mail app, with no integration (plan
 * §22): to the address, and — when given — its subject and the words it
 * starts with, which they may change before sending.
 */
export function mailtoHref(address: string, words?: { subject: string; body: string }): string {
  const mail = `mailto:${address}`;
  return words ? `${mail}?subject=${encodeURIComponent(words.subject)}&body=${encodeURIComponent(words.body)}` : mail;
}
