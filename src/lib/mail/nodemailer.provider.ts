import nodemailer, { type Transporter } from "nodemailer";

import { getServerEnv, type ServerEnv } from "@/lib/env/server";
import { externalServiceError } from "@/lib/errors";

import type { MailMessage, MailProvider } from "./mail.provider";
import { MailService } from "./mail.service";

interface NodemailerProviderOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

/** SMTP, through nodemailer: Gmail in production (D20), Mailpit locally. */
export class NodemailerProvider implements MailProvider {
  private readonly transporter: Transporter;

  constructor(options: NodemailerProviderOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user && options.password ? { user: options.user, pass: options.password } : undefined,
    });
  }

  async send(message: MailMessage) {
    await this.transporter.sendMail(message);
  }
}

/**
 * The app's mail, as the environment sets it up. With no SMTP host or sender
 * there is no mail, and saying so is the answer: a person waiting is told it
 * could not be sent, and nothing it was for is undone (plan §22).
 */
export function createConfiguredMailService(env: ServerEnv = getServerEnv()) {
  if (!env.SMTP_HOST || !env.SMTP_FROM) throw externalServiceError("MAIL_NOT_CONFIGURED");

  return new MailService({
    from: env.SMTP_FROM,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    provider: new NodemailerProvider({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
    }),
  });
}
