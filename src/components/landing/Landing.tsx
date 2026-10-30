import Image, { type StaticImageData } from "next/image";

import { LANDING_SHOTS } from "@/assets/landing";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Wordmark } from "@/components/ui/wordmark";
import { UI_TEXT } from "@/constants/messages";
import { ADMIN_ROUTE, AUTH_ROUTES, HOME_ROUTE } from "@/constants/routes";
import type { AuthSessionView } from "@/features/auth/types";
import { formatPaise } from "@/lib/format/currency";
import type { PublicPricing } from "@/lib/platform/pricing";

import { Contact } from "./Contact";

const { landing: words, appName } = UI_TEXT;

type Theme = "light" | "dark";
type Shot = Record<Theme, StaticImageData>;

/** The class that shows a picture only in its own theme (globals.css; D401). */
const FOR_THEME: Record<Theme, string> = { light: "for-light", dark: "for-dark" };

/**
 * The lake's one hand-drawn shape (`--radius-lake`), turned over: each lake on
 * the page opens a little differently without a new shape being drawn.
 */
const SHAPES = ["", "-scale-x-100", "-scale-y-100", "-scale-100"] as const;
type Shape = 0 | 1 | 2 | 3;

/**
 * How a screen sits in its lake: as large as the lake's curve allows while
 * the screen stays whole and inset from its edge. On a phone the lake runs
 * to the edges of the screen, so the screen in it can be read.
 */
const FRAMES = {
  phone: {
    lake: "aspect-[3/5] sm:aspect-[5/7]",
    shot: "w-[58%] sm:w-1/2",
    sizes: "(min-width: 640px) 304px, 58vw",
  },
  desk: {
    lake: "aspect-square sm:aspect-[5/4]",
    shot: "w-3/4 sm:w-[70%]",
    sizes: "(min-width: 1024px) 672px, 75vw",
  },
} as const;

/** Below 640 px a lake takes the page's side margins too, from edge to edge. */
const BLEED = "max-sm:-mx-(--safe-px) max-sm:w-[calc(100%+2*var(--safe-px))] max-sm:max-w-none";

/** The page's width and its side margins, the device's safe area added. */
const CONTAINER = "mx-auto w-full max-w-[90rem] safe-x [--safe-px:1.25rem] md:[--safe-px:2.5rem] xl:[--safe-px:5rem]";

/**
 * A lake with a real screen in it (D400): the land opens, the ground shows
 * through, and the screen sits in the opening whole — in the theme the page
 * is drawn in, both kept in the page and one shown (D401).
 */
function ShotLake({
  shot,
  alt,
  frame = "phone",
  shape = 0,
  first = false,
  className,
}: {
  shot: Shot;
  alt: string;
  frame?: keyof typeof FRAMES;
  shape?: Shape;
  /** The lake in the first view: its screen is fetched at once. */
  first?: boolean;
  className?: string;
}) {
  const { lake, shot: size, sizes } = FRAMES[frame];
  return (
    <div className={cn("relative grid place-items-center", lake, className, BLEED)}>
      <span aria-hidden="true" className={cn("absolute inset-0 rounded-lake bg-ground", SHAPES[shape])} />
      {(["light", "dark"] as const).map((theme) => (
        <Image
          key={theme}
          src={shot[theme]}
          alt={alt}
          sizes={sizes}
          loading={first ? "eager" : "lazy"}
          fetchPriority={first ? "high" : "auto"}
          className={cn("relative h-auto rounded-row shadow-raised ring-1 ring-line", size, FOR_THEME[theme])}
        />
      ))}
    </div>
  );
}

/**
 * The five parts of the day, in the order it runs (D398), each through its
 * own lake — and the lakes ease off as the day does, the busy morning's the
 * widest and the evening's report the smallest.
 */
const PARTS = [
  { key: "appointments", shape: 1, width: "max-w-[38rem]" },
  { key: "visit", shape: 2, width: "max-w-[36rem]" },
  { key: "bill", shape: 3, width: "max-w-[34rem]" },
  { key: "followUps", shape: 0, width: "max-w-[31rem]" },
  { key: "reports", shape: 1, width: "max-w-[29rem]" },
] as const;

/** Someone signed in is offered their own clinic — or the console, for the DEV — instead of signing up. */
function openFor(session: AuthSessionView | null | undefined): { href: string; label: string } | null {
  if (!session) return null;
  return { href: session.profile.platformRole === "DEV" ? ADMIN_ROUTE : HOME_ROUTE, label: words.openApp(appName) };
}

/**
 * The landing page (plan §21; D397 – D401): one field of land, and the
 * clinic's day showing through lakes cut into it — the queue first, then the
 * day's five parts screen by screen, a phone and a desk, the trial and the
 * two live prices, and who to talk to. Every screen is a real one, of a demo
 * clinic made and deleted by `scripts/landing-shots.mts`. `pricing` is null
 * when the settings could not be read: the prices are left out, never
 * guessed. Someone signed in has one way on — **Open ClinicDesk**, at the
 * top — and is shown the prices without the trial; a trial of no days is
 * never called free.
 */
export function Landing({
  session,
  pricing,
}: {
  session: AuthSessionView | null | undefined;
  pricing: PublicPricing | null;
}) {
  const open = openFor(session);
  const prices = pricing && {
    ...pricing,
    trialDays: open ? 0 : pricing.trialDays,
    monthly: formatPaise(pricing.monthlyPaise),
    yearly: formatPaise(pricing.yearlyPaise),
  };
  const start = !open && (
    <LinkButton href={AUTH_ROUTES.register} label={prices?.trialDays === 0 ? words.setUp : words.startTrial} />
  );

  return (
    <div className="min-h-dvh overflow-x-clip bg-land text-land-ink">
      <header className={cn(CONTAINER, "safe-top [--safe-pt:1.25rem] md:[--safe-pt:1.75rem]")}>
        <div className="flex min-h-12 items-center justify-between gap-4">
          <Wordmark size="lg" />
          <LinkButton href={open?.href ?? AUTH_ROUTES.signIn} label={open?.label ?? words.signIn} variant="secondary" />
        </div>
      </header>

      <main className="pb-20">
        <section
          aria-labelledby="landing-title"
          className={cn(
            CONTAINER,
            "grid items-center gap-10 pt-10 md:pt-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pt-4",
          )}
        >
          <div className="grid justify-items-start">
            <h1
              id="landing-title"
              className="max-w-[15ch] text-display font-bold tracking-[-0.03em] lg:text-display-lg"
            >
              {words.headline}
            </h1>
            <p className="mt-5 max-w-[34rem] text-body text-land-muted">{words.lede}</p>
            <div className="mt-7 grid justify-items-start gap-3">
              {start}
              {prices && (
                <p className="text-small text-land-muted tabular-nums">
                  {words.terms(prices.trialDays, prices.monthly, prices.yearly)}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-3">
            <ShotLake
              shot={LANDING_SHOTS.queue}
              alt={words.queueAlt}
              first
              className="w-full max-w-[37.5rem] justify-self-center lg:justify-self-end"
            />
            <p className="text-center text-caption text-land-muted lg:text-right">{words.demoNote}</p>
          </div>
        </section>

        <div className={cn(CONTAINER, "mt-16 grid gap-20 lg:mt-20 lg:gap-12 xl:mt-0 xl:gap-0")}>
          {PARTS.map(({ key, shape, width }, index) => {
            const part = words.parts[key];
            const lakeRight = index % 2 === 1;
            return (
              <section
                key={key}
                aria-labelledby={`landing-${key}`}
                className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10 xl:-mt-40 xl:first:-mt-56"
              >
                <div
                  className={cn("lg:row-start-1", lakeRight ? "lg:col-start-1 lg:justify-self-end" : "lg:col-start-2")}
                >
                  <h2 id={`landing-${key}`} className="text-heading font-bold tracking-[-0.02em]">
                    {part.title}
                  </h2>
                  <p className="mt-2 max-w-[28rem] text-body text-land-muted">{part.body}</p>
                </div>
                <ShotLake
                  shot={LANDING_SHOTS[key]}
                  alt={part.alt}
                  shape={shape}
                  className={cn(
                    "w-full justify-self-center lg:row-start-1",
                    width,
                    lakeRight ? "lg:col-start-2 lg:justify-self-end" : "lg:col-start-1 lg:justify-self-start",
                  )}
                />
              </section>
            );
          })}
        </div>

        <section aria-labelledby="landing-devices" className={cn(CONTAINER, "mt-24 grid gap-8 lg:mt-32")}>
          <div className="max-w-[40rem]">
            <h2 id="landing-devices" className="text-heading font-bold tracking-[-0.02em]">
              {words.devices.title}
            </h2>
            <p className="mt-2 text-body text-land-muted">{words.devices.body}</p>
          </div>
          <ShotLake
            shot={LANDING_SHOTS.desktop}
            alt={words.devices.alt}
            frame="desk"
            shape={2}
            className="w-full max-w-[60rem] justify-self-center"
          />
        </section>

        {/* Nothing to say here to someone signed in when the prices could not be read. */}
        {(prices || start) && (
          <div
            className={cn(
              CONTAINER,
              "mt-24 grid gap-14 lg:mt-32 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-20",
            )}
          >
            <section aria-labelledby="landing-pricing" className="grid content-start justify-items-start">
              <h2
                id="landing-pricing"
                className="max-w-[16ch] text-display font-bold tracking-[-0.03em] tabular-nums lg:text-display-lg"
              >
                {prices ? words.pricing.title(prices.monthly, prices.yearly) : words.pricing.titleUnread}
              </h2>
              {prices && (
                <p className="mt-4 max-w-[34rem] text-body text-land-muted">
                  {prices.trialDays > 0
                    ? words.pricing.trial(prices.trialDays, appName)
                    : words.pricing.noTrial(appName)}
                </p>
              )}
              {start && <div className="mt-7">{start}</div>}
            </section>
            {prices && <Contact contact={prices.contact} />}
          </div>
        )}
      </main>

      <footer className={cn(CONTAINER, "safe-bottom [--safe-pb:2rem]")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-land-muted/30 pt-6">
          <Wordmark />
          <p className="text-small text-land-muted">{UI_TEXT.appDescription}</p>
        </div>
      </footer>
    </div>
  );
}
