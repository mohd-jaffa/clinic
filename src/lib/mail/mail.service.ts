import type { MailProvider } from "./mail.provider";
import { accountConfirmationTemplate } from "./templates/account-confirmation";
import { inviteTemplate, type InviteInput } from "./templates/invite";
import { passwordResetTemplate } from "./templates/password-reset";
import { planExtendedTemplate, type PlanExtendedInput } from "./templates/plan-extended";
import { planNoticeTemplate, type PlanNoticeInput } from "./templates/plan-notice";

interface MailServiceOptions {
  provider: MailProvider;
  from: string;
  /** The app's address: where an email's links lead. */
  appUrl: string;
}

/** Every email the app sends, one method each (plan §22); the words are MAIL_TEXT's. */
export class MailService {
  private readonly provider: MailProvider;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(options: MailServiceOptions) {
    this.provider = options.provider;
    this.from = options.from;
    this.appUrl = options.appUrl;
  }

  async sendAccountConfirmation(input: { to: string; name: string; confirmationUrl: string }) {
    const content = accountConfirmationTemplate({ ...input, appUrl: this.appUrl });
    await this.provider.send({ from: this.from, to: input.to, ...content });
  }

  async sendInvite(input: Omit<InviteInput, "appUrl"> & { to: string }) {
    const content = inviteTemplate({ ...input, appUrl: this.appUrl });
    await this.provider.send({ from: this.from, to: input.to, ...content });
  }

  async sendPasswordReset(input: { to: string; name: string; resetUrl: string }) {
    const content = passwordResetTemplate({ ...input, appUrl: this.appUrl });
    await this.provider.send({ from: this.from, to: input.to, ...content });
  }

  async sendPlanExtended(input: Omit<PlanExtendedInput, "appUrl"> & { to: string }) {
    const content = planExtendedTemplate({ ...input, appUrl: this.appUrl });
    await this.provider.send({ from: this.from, to: input.to, ...content });
  }

  async sendPlanNotice(input: Omit<PlanNoticeInput, "appUrl"> & { to: string }) {
    const content = planNoticeTemplate({ ...input, appUrl: this.appUrl });
    await this.provider.send({ from: this.from, to: input.to, ...content });
  }
}
