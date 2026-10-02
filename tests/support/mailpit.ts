/**
 * The local mail server (Mailpit, started with the local Supabase): the
 * integration tests read what the app sent from it, as a person reads their
 * inbox, and follow the links in it as a person taps them.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";

interface MailpitSummary {
  ID: string;
  Subject: string;
}

/** Every email sent to an address, newest first. */
export async function messagesTo(email: string): Promise<MailpitSummary[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const body = (await response.json()) as { messages: MailpitSummary[] };
  return body.messages;
}

/** The newest email to an address, waiting a little for it to arrive. */
export async function latestMessageTo(email: string): Promise<{ subject: string; text: string; html: string }> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const [latest] = await messagesTo(email);
    if (latest) {
      const response = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
      const message = (await response.json()) as { Subject: string; Text: string; HTML: string };
      return { subject: message.Subject, text: message.Text, html: message.HTML };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email arrived for ${email}`);
}

/** The Supabase Auth link in an email's text. */
export function authLinkIn(text: string): string {
  const link = text.match(/https?:\/\/\S+\/auth\/v1\/verify\?\S+/)?.[0];
  if (!link) throw new Error("The email holds no sign-in link");
  return link;
}

/**
 * Taps a Supabase Auth link: Supabase checks it and sends the browser on to
 * the app's screen with the session's tokens in the address's fragment —
 * which is what that screen reads and posts back.
 */
export async function followAuthLink(
  link: string,
): Promise<{ landing: string; accessToken: string; refreshToken: string }> {
  const response = await fetch(link, { redirect: "manual" });
  const location = response.headers.get("location");
  if (!location) throw new Error(`The link was refused (${response.status})`);
  const url = new URL(location);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return {
    landing: `${url.origin}${url.pathname}`,
    accessToken: fragment.get("access_token") ?? "",
    refreshToken: fragment.get("refresh_token") ?? "",
  };
}
