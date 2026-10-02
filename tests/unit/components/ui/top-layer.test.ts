import { afterEach, describe, expect, it, vi } from "vitest";

import { isOpenLayer, lower, onLayersChange, openLayer, raise, topLayer } from "@/components/ui/top-layer";

const layer = () => {
  const dialog = document.createElement("dialog");
  const notices = document.createElement("div");
  const status = document.createElement("p");
  dialog.append(notices, status);
  document.body.append(dialog);
  return { notices, status };
};

/** A holder whose popover is watched. */
function poppable(holder: HTMLElement) {
  let open = false;
  holder.showPopover = vi.fn(() => void (open = true));
  holder.hidePopover = vi.fn(() => void (open = false));
  const matches = holder.matches.bind(holder);
  holder.matches = (selector: string) => (selector === ":popover-open" ? open : matches(selector));
  return holder;
}

let closers: (() => void)[] = [];
const open = (one = layer()) => {
  closers.push(openLayer(one));
  return one;
};

afterEach(() => {
  closers.forEach((close) => close());
  closers = [];
  document.body.innerHTML = "";
});

describe("the modal layers", () => {
  it("puts the last modal opened on top, and takes each off as it closes", () => {
    const heard = vi.fn();
    const stop = onLayersChange(heard);
    expect(topLayer()).toBeUndefined();

    const sheet = layer();
    const closeSheet = openLayer(sheet);
    const form = open();
    expect(topLayer()).toBe(form);
    expect(isOpenLayer(sheet.notices)).toBe(true);

    closeSheet();
    expect(topLayer()).toBe(form);
    expect(isOpenLayer(sheet.notices)).toBe(false);
    expect(isOpenLayer(null)).toBe(false);
    expect(heard).toHaveBeenCalledTimes(3);

    stop();
    open();
    expect(heard).toHaveBeenCalledTimes(3);
  });
});

describe("raise", () => {
  it("puts a holder in the modal on top, and on the page with none open where there are no popovers", () => {
    const holder = document.createElement("div");
    Object.defineProperty(holder, "showPopover", { value: undefined });
    raise(holder);
    expect(holder.parentElement).toBe(document.body);
    expect(holder).not.toHaveAttribute("popover");

    const sheet = open();
    raise(holder);
    expect(holder.parentElement).toBe(sheet.notices);
    // Already there: nothing moves.
    const append = vi.spyOn(sheet.notices, "append");
    raise(holder);
    expect(append).not.toHaveBeenCalled();
  });

  it("shows it as a popover with no modal open, above a sheet still leaving, and not inside one", () => {
    const holder = poppable(document.createElement("div"));
    raise(holder);
    expect(holder).toHaveAttribute("popover", "manual");
    expect(holder.showPopover).toHaveBeenCalledOnce();
    // Shown already: left as it is.
    raise(holder);
    expect(holder.showPopover).toHaveBeenCalledOnce();

    const sheet = open();
    raise(holder);
    expect(holder.hidePopover).toHaveBeenCalledOnce();
    expect(holder).not.toHaveAttribute("popover");
    expect(holder.parentElement).toBe(sheet.notices);

    lower(holder);
    expect(holder.hidePopover).toHaveBeenCalledOnce();
  });

  it("takes a holder out of the top layer once it holds nothing", () => {
    const holder = poppable(document.createElement("div"));
    raise(holder);
    lower(holder);
    expect(holder.hidePopover).toHaveBeenCalledOnce();
  });

  it("keeps each running animation at the time it had reached, and leaves the rest to start", () => {
    const holder = document.createElement("div");
    const countdown = document.createElement("div");
    const pulse = document.createElement("div");
    holder.append(countdown, pulse);
    raise(holder);

    const animation = (target: Element, name: string, currentTime: number) =>
      ({ effect: { target }, animationName: name, currentTime }) as unknown as CSSAnimation;
    // One played from script with no effect is known by that alone.
    const bare = (currentTime: number) => ({ effect: null, currentTime }) as unknown as CSSAnimation;
    const before = [animation(countdown, "response-countdown", 1200), bare(80)];
    const after = [animation(countdown, "response-countdown", 0), animation(pulse, "pop-in", 0), bare(0)];
    holder.getAnimations = vi.fn().mockReturnValueOnce(before).mockReturnValueOnce(after);

    const sheet = open();
    raise(holder);
    expect(holder.parentElement).toBe(sheet.notices);
    expect(after[0].currentTime).toBe(1200);
    expect(after[1].currentTime).toBe(0);
    expect(after[2].currentTime).toBe(80);
  });

  it("puts a holder that is off the page straight in, as it has played nothing", () => {
    const holder = document.createElement("div");
    holder.getAnimations = vi.fn(() => []);
    raise(holder);
    expect(holder.getAnimations).not.toHaveBeenCalled();
  });

  it("puts a holder in where the browser cannot tell its animations", () => {
    const holder = document.createElement("div");
    document.body.append(holder);
    Reflect.deleteProperty(holder, "getAnimations");
    const sheet = open();
    const getAnimations = Element.prototype.getAnimations;
    Reflect.deleteProperty(Element.prototype, "getAnimations");
    try {
      raise(holder);
    } finally {
      if (getAnimations) Element.prototype.getAnimations = getAnimations;
    }
    expect(holder.parentElement).toBe(sheet.notices);
  });
});
