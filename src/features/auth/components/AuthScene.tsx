"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { LinkButton } from "@/components/ui/button";
import { Coastline } from "@/components/ui/coast-header";
import { Wordmark } from "@/components/ui/wordmark";
import { UI_TEXT } from "@/constants/messages";

/**
 * The frame every account screen shares (D70): the land leads, holding the
 * app's name and its line. On a phone it sits above the form, its lower edge
 * a coastline; from 1024 px it fills the left half, its right edge a
 * coastline, and the form stands on the right in the height's middle, so a
 * long form such as sign-up is seen whole. The screen's title is its one
 * first-level heading; `aside` is the other way in, under the form.
 * `announce` takes the focus to the title, for a screen that has just become
 * another — "Check your email" once a clinic is set up.
 */
export function AuthScene({
  title,
  intro,
  aside,
  announce = false,
  children,
}: {
  title: string;
  intro?: string;
  aside?: ReactNode;
  announce?: boolean;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (announce) heading.current?.focus();
  }, [announce]);

  return (
    <main className="min-h-dvh bg-ground text-ink lg:grid lg:grid-cols-2">
      <div className="lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <section className="safe-top safe-x flex flex-col gap-8 bg-land pb-4 text-land-ink [--safe-pt:1.5rem] [--safe-px:1.5rem] md:[--safe-px:2rem] lg:flex-1 lg:justify-between lg:pb-12 lg:[--safe-pt:3rem] lg:[--safe-px:3rem]">
          <Wordmark size="lg" />
          <p className="max-w-lg text-title font-bold text-balance lg:text-display lg:tracking-[-0.02em]">
            {UI_TEXT.appDescription}
          </p>
        </section>
        <div className="lg:hidden">
          <div className="md:hidden">
            <Coastline name="phone" />
          </div>
          <div className="hidden md:block">
            <Coastline name="wide" />
          </div>
        </div>
        <div className="hidden lg:block">
          <Coastline name="side" />
        </div>
      </div>

      <div className="safe-bottom safe-x [--safe-pb:2.5rem] [--safe-px:1.5rem] lg:flex lg:items-center lg:justify-center lg:[--safe-px:4rem]">
        <div className="mx-auto w-full max-w-md pt-4 lg:py-12">
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-heading font-bold tracking-[-0.01em] outline-none md:text-display"
          >
            {title}
          </h1>
          {intro && <p className="mt-2 text-muted text-pretty">{intro}</p>}
          <div className="mt-8">{children}</div>
          {aside && <div className="mt-8 border-t border-line pt-6">{aside}</div>}
        </div>
      </div>
    </main>
  );
}

/** The other way in, under a form: "New here?" — Set up your clinic. */
export function OtherWayIn({ question, label, href }: { question?: string; label: string; href: string }) {
  return (
    <div className="grid gap-3">
      {question && <p className="text-muted">{question}</p>}
      <LinkButton href={href} label={label} variant="secondary" fullWidth />
    </div>
  );
}
