"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";
import { mailtoHref } from "@/lib/mail/mailto";
import { callHref, whatsAppHref } from "@/lib/phone";
import type { PublicPricing } from "@/lib/platform/pricing";

const { landing: words, appName } = UI_TEXT;

/**
 * The renewal contact (plan §6): only once the DEV has set a phone or an
 * email to reach — Call, WhatsApp and Email, the words already typed. Drawn
 * in the browser, as the kit's buttons are: their icons cannot be handed
 * across from the server-drawn page.
 */
export function Contact({ contact }: { contact: PublicPricing["contact"] }) {
  const { name, phone, email } = contact;
  if (!phone && !email) return null;
  const message = words.contact.message(appName);
  const to = (named: (name: string) => string) => (name ? named(name) : undefined);
  return (
    <section aria-labelledby="landing-contact" className="grid content-start gap-2">
      <h2 id="landing-contact" className="text-heading font-bold tracking-[-0.02em]">
        {words.contact.title}
      </h2>
      <p className="text-body text-land-muted">{name ? words.contact.talkTo(name) : words.contact.talkToUs}</p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {phone && (
          <>
            <LinkButton
              href={callHref(phone)}
              label={words.contact.call}
              accessibleName={to(words.contact.callTo)}
              icon={Phone}
              variant="secondary"
            />
            <LinkButton
              href={whatsAppHref(phone, message)}
              label={words.contact.whatsApp}
              accessibleName={to(words.contact.whatsAppTo)}
              icon={MessageCircle}
              variant="secondary"
              newTab
            />
          </>
        )}
        {email && (
          <LinkButton
            href={mailtoHref(email, { subject: words.contact.subject(appName), body: message })}
            label={words.contact.email}
            accessibleName={to(words.contact.emailTo)}
            icon={Mail}
            variant="secondary"
          />
        )}
      </div>
    </section>
  );
}
