/**
 * An email to write in the person's own mail app, with no integration (plan
 * §22): its subject and the words it starts with, which they may change
 * before sending.
 */
export function mailtoHref(address: string, { subject, body }: { subject: string; body: string }): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
