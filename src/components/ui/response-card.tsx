"use client";

import { Check, CircleAlert, CircleHelp, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { UI_TEXT, type ErrorMessageCode } from "@/constants/messages";
import type { StatusTone } from "@/constants/statuses";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors/errorMessage";
import { MAP_MS, canAnimate } from "@/lib/motion";

import { Button, IconButton, LinkButton } from "./button";
import { cn } from "./cn";
import { Dialog } from "./dialog";
import { isOpenLayer, isOpenStatus, lower, onLayersChange, raise, topLayer } from "./top-layer";

export type ResponseKind = "success" | "info" | "warning" | "error" | "confirm";

/** A button on a card: it acts, or goes somewhere; either way the card closes. */
export interface ResponseAction {
  label: string;
  onClick?: () => void;
  href?: string;
  /** `href` is a file the server answers with — a PDF — opened beside the app. */
  file?: boolean;
  /** What its chip holds; an arrow unless it says otherwise. */
  icon?: LucideIcon;
}

/** One of up to three key figures under the message: Bill 2026-27/0042. */
export interface ResponseFact {
  label: string;
  value: string;
}

export interface OutcomeCard {
  title: string;
  message?: string;
  facts?: readonly ResponseFact[];
  primary?: ResponseAction;
  secondary?: ResponseAction;
  /** A success or info card with no next step closes itself; `false` keeps it. */
  autoClose?: boolean;
}

export interface ErrorCard extends OutcomeCard {
  /** The API's own words (errorMessage), never raw text. */
  message: string;
  /** Shown in small type so it can be quoted. */
  requestId?: string;
  /** Offers Try again, which runs this. */
  retry?: () => void;
}

/** The confirm card (plan §32.2): an action that cannot be undone asks first. */
export interface ConfirmCard {
  title: string;
  message?: string;
  confirmLabel: string;
  /** What the confirm button's chip holds; a check unless it says otherwise. */
  confirmIcon?: LucideIcon;
  cancelLabel?: string;
  /**
   * A second way to go ahead, beside the confirm button: "Keep both in" by
   * "Mark done and send in" (D192). Its `onClick` runs, and the card answers
   * `false`, as for Cancel.
   */
  secondary?: ResponseAction;
  /** `danger` for what destroys or voids: a coral card and button, and the focus on Cancel. */
  tone?: "danger";
}

interface Card extends OutcomeCard {
  id: number;
  kind: ResponseKind;
  requestId?: string;
  tone?: "danger";
  cancelLabel?: string;
  resolve?: (answer: boolean) => void;
  /** It has been answered or closed, and is on its way off the screen. */
  leaving?: boolean;
}

export interface Respond {
  success: (card: OutcomeCard) => void;
  info: (card: OutcomeCard) => void;
  warning: (card: OutcomeCard) => void;
  error: (card: ErrorCard) => void;
  /** An error card for a caught failure: its message and request id come from the API's envelope. */
  failure: (failure: unknown, card: Omit<ErrorCard, "message" | "requestId"> & { fallback?: ErrorMessageCode }) => void;
  /** Resolves `true` for the confirm button, `false` for anything else. */
  confirm: (card: ConfirmCard) => Promise<boolean>;
}

// A newer card replaces an older one of lower or equal severity; a lower one
// waits its turn.
const SEVERITY: Record<ResponseKind, number> = { info: 0, success: 1, warning: 2, error: 3, confirm: 4 };

interface MarkLook {
  icon: LucideIcon;
  tone: StatusTone;
}

/** Each kind's mark, in the tones a status takes: coral only where something needs attention. */
const MARKS: Record<ResponseKind, MarkLook> = {
  success: { icon: Check, tone: "live" },
  info: { icon: Info, tone: "neutral" },
  warning: { icon: TriangleAlert, tone: "attention" },
  error: { icon: CircleAlert, tone: "attention" },
  confirm: { icon: CircleHelp, tone: "neutral" },
};

/** A question about something that cannot be undone. */
const DANGER_MARK: MarkLook = { icon: TriangleAlert, tone: "attention" };

const MARK_TONES: Record<StatusTone, string> = {
  neutral: "text-ink",
  live: "text-action",
  attention: "text-coral",
};

/** How long a card with no next step stays up. */
export const AUTO_CLOSE_MS = 3000;

const same = (a: Card, b: Card) => a.kind === b.kind && a.title === b.title && a.message === b.message;

/** A success or info card with nothing to do next, which closes itself. */
const closesItself = (card: Card) =>
  (card.kind === "success" || card.kind === "info") && !card.primary && !card.secondary && card.autoClose !== false;

const ResponseContext = createContext<Respond | null>(null);

/**
 * How the app reports what just happened (plan §32.2), ported from Brio:
 * mounted once in the root layout, reached with `useResponse()`, one card at a
 * time. The confirm card is one of its cards: `confirm()` asks, and answers.
 */
export function ResponseProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);
  const nextId = useRef(0);

  const show = useCallback((card: Omit<Card, "id">) => {
    const next = { ...card, id: nextId.current++ };
    setCards((current) => {
      // A card on its way out has already gone, as far as a new one is concerned.
      const [shown, ...waiting] = current.filter((card) => !card.leaving);
      if (!shown) return [next];
      if (same(shown, next) || waiting.some((card) => same(card, next))) {
        next.resolve?.(false);
        return current;
      }
      if (SEVERITY[next.kind] >= SEVERITY[shown.kind]) {
        shown.resolve?.(false);
        return [next, ...waiting];
      }
      return [shown, ...waiting, next];
    });
  }, []);

  // The answer is given at once; the card then leaves the way it came, on the
  // map's one duration, and the next one waiting follows it. A browser that
  // cannot play the exit takes it off at once.
  const close = useCallback((card: Card, answer = false) => {
    card.resolve?.(answer);
    const remove = () => setCards((current) => current.filter((waiting) => waiting.id !== card.id));
    if (!canAnimate(document.body)) return remove();
    setCards((current) => current.map((shown) => (shown.id === card.id ? { ...shown, leaving: true } : shown)));
    window.setTimeout(remove, MAP_MS);
  }, []);

  const respond = useMemo<Respond>(
    () => ({
      success: (card) => show({ ...card, kind: "success" }),
      info: (card) => show({ ...card, kind: "info" }),
      warning: (card) => show({ ...card, kind: "warning" }),
      error: ({ retry, ...card }) =>
        show({
          ...card,
          kind: "error",
          primary: card.primary ?? (retry ? { label: UI_TEXT.actions.retry, onClick: retry } : undefined),
        }),
      failure: (failure, { fallback, retry, ...card }) =>
        show({
          ...card,
          kind: "error",
          message: errorMessage(failure, fallback),
          requestId: failure instanceof ApiError ? failure.requestId : undefined,
          primary: card.primary ?? (retry ? { label: UI_TEXT.actions.retry, onClick: retry } : undefined),
        }),
      confirm: ({ confirmLabel, confirmIcon, cancelLabel, ...card }) =>
        new Promise<boolean>((resolve) =>
          show({
            ...card,
            kind: "confirm",
            primary: { label: confirmLabel, icon: confirmIcon ?? Check },
            cancelLabel,
            resolve,
          }),
        ),
    }),
    [show],
  );

  const current = cards[0];
  const notice = current && closesItself(current) ? current : undefined;

  // A notice is drawn in a holder of its own, which goes wherever it can be
  // seen and reached (`raise`): inside the modal on top when one is open,
  // since the page outside it is inert, and above the page otherwise. Made in
  // the browser only; there is never a notice while the page is drawn on the
  // server.
  const [holder] = useState(() => {
    if (typeof document === "undefined") return null;
    const div = document.createElement("div");
    div.className = "notice-holder";
    return div;
  });
  useLayoutEffect(() => () => holder?.remove(), [holder]);
  const noticeId = notice?.id;
  useLayoutEffect(() => {
    if (!holder || noticeId === undefined) return;
    // A new notice goes on top — over the sheet that stays open once a form
    // over it has saved and closed.
    raise(holder);
    // It stays there while it lasts, under a sheet opened after it; if its
    // own sheet closes, it steps down to what is open now, clock and all.
    const stop = onLayersChange(() => {
      if (holder.parentElement !== document.body && !isOpenLayer(holder.parentElement)) raise(holder);
    });
    return () => {
      stop();
      lower(holder);
    };
  }, [holder, noticeId]);

  // Announced, as it never takes focus, through the live region on top: the
  // page's own is inert, and silent, while a modal is open. It follows the
  // notice down when the sheet it was said in closes after it — a sheet closed
  // through the browser's history goes a moment later — so it is not left in
  // a region no one can hear.
  const pageStatus = useRef<HTMLParagraphElement>(null);
  const spoken = notice
    ? [notice.title, notice.message, ...(notice.facts ?? []).slice(0, 3).map((fact) => `${fact.label} ${fact.value}`)]
        .filter(Boolean)
        .join(". ")
    : "";
  useLayoutEffect(() => {
    if (!spoken) return;
    // The page's own region is drawn with the provider, so it is there by now.
    const regionOnTop = () => topLayer()?.status ?? pageStatus.current!;
    let region = regionOnTop();
    region.textContent = spoken;
    // Only when the sheet it was said in has closed: under a sheet opened after it, it has been said already.
    const stop = onLayersChange(() => {
      if (region === pageStatus.current || isOpenStatus(region)) return;
      region.textContent = "";
      region = regionOnTop();
      region.textContent = spoken;
    });
    return () => {
      stop();
      region.textContent = "";
    };
  }, [spoken]);

  return (
    <ResponseContext.Provider value={respond}>
      {children}
      {notice &&
        holder &&
        createPortal(<ResponseNotice key={notice.id} card={notice} onClose={() => close(notice)} />, holder)}
      {current && !notice && (
        <ResponseCard key={current.id} card={current} onClose={(answer) => close(current, answer)} />
      )}
      <p ref={pageStatus} role="status" aria-live="polite" className="sr-only" />
    </ResponseContext.Provider>
  );
}

/** The card for the outcome of an action. Only inside a `ResponseProvider`. */
export function useResponse(): Respond {
  const respond = useContext(ResponseContext);
  if (!respond) throw new Error("useResponse() is used outside a ResponseProvider.");
  return respond;
}

/** A card's mark: a small lobe of its tone, holding what kind of card it is. */
/** A card's mark: its kind's icon, bare beside the title — no tile under it (D75). */
function Mark({ look: { icon: Icon, tone }, size }: { look: MarkLook; size: "md" | "sm" }) {
  return (
    <span aria-hidden="true" className={cn("shrink-0", MARK_TONES[tone])}>
      <Icon size={size === "md" ? 24 : 20} strokeWidth={2.25} className="block" />
    </span>
  );
}

function ActionButton({
  action,
  variant,
  onDone,
  focusRef,
}: {
  action: ResponseAction;
  variant: "primary" | "secondary" | "danger" | "quiet";
  onDone: () => void;
  focusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const onClick = () => {
    action.onClick?.();
    onDone();
  };
  return action.href ? (
    <LinkButton
      href={action.href}
      file={action.file}
      newTab={action.file}
      label={action.label}
      variant={variant}
      icon={action.icon}
      onClick={onClick}
    />
  ) : (
    <Button ref={focusRef} label={action.label} variant={variant} icon={action.icon} onClick={onClick} />
  );
}

/**
 * A card that needs an answer, or offers a next step, on the kit's `Dialog`.
 * Focus goes to the primary action — except on a destructive confirmation,
 * where it goes to the safe answer, so Enter cannot destroy anything by
 * accident. Escape closes a success, info or error card and means No to a
 * confirmation; a warning waits for a choice.
 */
function ResponseCard({ card, onClose }: { card: Card; onClose: (answer?: boolean) => void }) {
  const first = useRef<HTMLButtonElement>(null);
  const safe = useRef<HTMLButtonElement>(null);
  const confirming = card.kind === "confirm";
  const danger = confirming && card.tone === "danger";
  const dismissible = card.kind !== "warning";
  const facts = card.facts?.slice(0, 3) ?? [];

  return (
    <Dialog
      open={!card.leaving}
      onDismiss={dismissible ? () => onClose(false) : undefined}
      title={card.title}
      role={card.kind === "success" || card.kind === "info" ? "dialog" : "alertdialog"}
      initialFocus={danger ? safe : first}
      mark={<Mark look={danger ? DANGER_MARK : MARKS[card.kind]} size="md" />}
      closable={!confirming}
      // Cancel, a second way to go ahead and the main one: a row of three is wider than the card.
      stackActions={confirming && card.secondary !== undefined}
      actions={
        <>
          {confirming && (
            <ActionButton
              action={{ label: card.cancelLabel ?? UI_TEXT.actions.cancel }}
              variant="quiet"
              onDone={() => onClose(false)}
              focusRef={safe}
            />
          )}
          {card.secondary && <ActionButton action={card.secondary} variant="secondary" onDone={() => onClose(false)} />}
          {card.primary && (
            <ActionButton
              action={card.primary}
              variant={danger ? "danger" : "primary"}
              onDone={() => onClose(true)}
              focusRef={first}
            />
          )}
        </>
      }
    >
      {card.message && <p>{card.message}</p>}
      {facts.length > 0 && (
        <dl
          className="mt-3 grid divide-x divide-line rounded-row bg-ground"
          style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}
        >
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0 px-3 py-2.5">
              <dt className="text-caption">{fact.label}</dt>
              <dd className="mt-0.5 truncate font-bold text-ink tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.requestId && (
        <p className="mt-3 text-caption tabular-nums select-all">{UI_TEXT.response.reference(card.requestId)}</p>
      )}
    </Dialog>
  );
}

/**
 * A success or info card with nothing to do next: it closes itself after
 * three seconds, with a hairline counting down, and stops counting while a
 * pointer rests on it, a finger holds it or focus is in it (WCAG 2.2.1). It
 * does not take focus — focus would stop its clock for good and pull it away
 * from what the person was doing — so the provider announces it instead.
 */
function ResponseNotice({ card, onClose }: { card: Card; onClose: () => void }) {
  const [held, setHeld] = useState(0);
  // Its entrance plays once: taken off when done, so a notice that follows
  // its sheet away does not rise in again.
  const [entered, setEntered] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Escape closes what is on top. Over a sheet the notice is, so it closes
    // and the sheet stays for the next Escape; under a sheet opened after it,
    // the sheet is, and the notice is left alone.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const top = topLayer();
      if (top && !top.notices.contains(root.current)) return;
      if (top) event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hold = () => setHeld((count) => count + 1);
  const letGo = () => setHeld((count) => Math.max(0, count - 1));
  const facts = card.facts?.slice(0, 3) ?? [];

  return (
    <div
      ref={root}
      data-response-notice=""
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setEntered(true);
      }}
      onPointerEnter={hold}
      onPointerLeave={letGo}
      onFocus={hold}
      onBlur={letGo}
      className={cn(
        card.leaving ? "animate-card-out pointer-events-none" : !entered && "animate-card-in",
        "fixed inset-x-3 bottom-[calc(var(--bottom-bar-offset)+var(--safe-bottom)+0.75rem)] z-50 mx-auto max-w-md overflow-hidden",
        "rounded-sheet bg-surface text-ink shadow-raised ring-1 ring-line md:bottom-6",
      )}
    >
      <div className="flex items-start gap-2.5 py-3 pr-1 pl-4">
        <span className="pt-2.5">
          <Mark look={MARKS[card.kind]} size="sm" />
        </span>
        <div className="min-w-0 flex-1 pt-2">
          <p className="font-bold">{card.title}</p>
          {card.message && <p className="mt-0.5 text-small text-muted">{card.message}</p>}
          {facts.length > 0 && (
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-small">
              {facts.map((fact) => (
                <div key={fact.label} className="flex gap-1.5">
                  <dt className="text-muted">{fact.label}</dt>
                  <dd className="font-bold tabular-nums">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <span className="text-muted">
          <IconButton icon={X} label={UI_TEXT.response.closeNotice(card.title)} onClick={onClose} />
        </span>
      </div>
      <div aria-hidden="true" className="h-1 bg-ground">
        <div
          data-countdown=""
          className="h-full bg-action"
          style={
            {
              "--notice-life": `${AUTO_CLOSE_MS}ms`,
              animationPlayState: held > 0 ? "paused" : "running",
            } as CSSProperties
          }
          onAnimationEnd={onClose}
        />
      </div>
    </div>
  );
}
