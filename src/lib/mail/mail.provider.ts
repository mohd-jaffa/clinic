/** One email, as a provider sends it. */
export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Whatever delivers mail (plan §22, D20): SMTP through nodemailer — Gmail in
 * production, Mailpit locally. Changing provider is an env change, or one new
 * implementation of this, and nothing else.
 */
export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}
