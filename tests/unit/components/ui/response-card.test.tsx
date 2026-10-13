import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "@/components/ui/modal";
import { ResponseProvider, useResponse, type Respond } from "@/components/ui/response-card";
import { ERROR_MESSAGES } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { MAP_MS } from "@/lib/motion";

// Hands the test the respond object, with a button to hand focus back to.
function Harness({ onReady }: { onReady: (respond: Respond) => void }) {
  const respond = useResponse();
  const [ready] = useState(() => {
    onReady(respond);
    return true;
  });
  return <button type="button">Screen {String(ready)}</button>;
}

function mount() {
  let respond!: Respond;
  render(
    <ResponseProvider>
      <Harness onReady={(value) => (respond = value)} />
    </ResponseProvider>,
  );
  return respond;
}

const notice = () => document.querySelector<HTMLElement>("[data-response-notice]");
const countdown = () => document.querySelector<HTMLElement>("[data-countdown]")!;

describe("useResponse", () => {
  it("is only for inside a ResponseProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness onReady={() => {}} />)).toThrow(/ResponseProvider/);
    vi.restoreAllMocks();
  });
});

describe("a card with nothing to do next", () => {
  it("is announced, not focused, and closes itself when its clock runs out", () => {
    const respond = mount();
    act(() => respond.success({ title: "Patient saved", message: "Meena Gupta is in your patients." }));
    expect(notice()).toHaveTextContent("Patient saved");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Patient saved. Meena Gupta is in your patients.");
    expect(countdown().style.getPropertyValue("--notice-life")).toBe("3000ms");

    fireEvent.animationEnd(countdown());
    expect(notice()).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("shows up to three facts, and says them", () => {
    const respond = mount();
    act(() =>
      respond.success({
        title: "Payment recorded",
        facts: [
          { label: "Paid", value: "₹500" },
          { label: "Due", value: "₹250" },
          { label: "By", value: "UPI" },
          { label: "Note", value: "Kept out" },
        ],
      }),
    );
    expect(notice()).toHaveTextContent("Paid₹500Due₹250ByUPI");
    expect(notice()).not.toHaveTextContent("Kept out");
    expect(screen.getByRole("status")).toHaveTextContent("Payment recorded. Paid ₹500. Due ₹250. By UPI");
  });

  it("stops its clock while a pointer or focus rests on it", () => {
    const respond = mount();
    act(() => respond.info({ title: "You were signed out" }));
    fireEvent.pointerEnter(notice()!);
    expect(countdown().style.animationPlayState).toBe("paused");
    fireEvent.pointerLeave(notice()!);
    expect(countdown().style.animationPlayState).toBe("running");
    const close = screen.getByRole("button", { name: "Close “You were signed out”" });
    fireEvent.focus(close);
    expect(countdown().style.animationPlayState).toBe("paused");
    fireEvent.blur(close);
    fireEvent.blur(close);
    expect(countdown().style.animationPlayState).toBe("running");
  });

  it("closes from its close button, named for it, and on Escape", async () => {
    const respond = mount();
    act(() => respond.success({ title: "Expense saved" }));
    await userEvent.click(screen.getByRole("button", { name: "Close “Expense saved”" }));
    expect(notice()).toBeNull();

    act(() => respond.success({ title: "Expense saved" }));
    await userEvent.keyboard("{Escape}");
    expect(notice()).toBeNull();
    await userEvent.keyboard("{Enter}");
  });

  it("stays, as a dialog, when told not to close itself", () => {
    const respond = mount();
    act(() => respond.success({ title: "Payment recorded", autoClose: false }));
    expect(screen.getByRole("dialog", { name: "Payment recorded" })).toBeInTheDocument();
    expect(notice()).toBeNull();
  });
});

describe("a card with a next step", () => {
  it("is a dialog with its facts, focused on its primary action", async () => {
    const respond = mount();
    const onNew = vi.fn();
    act(() =>
      respond.success({
        title: "Bill issued",
        message: "2026-27/0042 is saved and ready to share.",
        facts: [
          { label: "Bill", value: "2026-27/0042" },
          { label: "Patient", value: "Meena G." },
          { label: "Total", value: "₹1,800" },
          { label: "Ignored", value: "a fourth" },
        ],
        primary: { label: "View bill", href: "/bills/1" },
        secondary: { label: "New bill", onClick: onNew },
      }),
    );
    const card = screen.getByRole("dialog", { name: "Bill issued" });
    expect(within(card).getByText("2026-27/0042 is saved and ready to share.")).toBeInTheDocument();
    expect(
      within(card)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(["Bill", "Patient", "Total"]);
    expect(within(card).getByRole("link", { name: "View bill" })).toHaveAttribute("href", "/bills/1");

    await userEvent.click(within(card).getByRole("button", { name: "New bill" }));
    expect(onNew).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("puts focus on its primary action, which closes it", async () => {
    const respond = mount();
    const onView = vi.fn();
    act(() => respond.success({ title: "Patient saved", primary: { label: "View patient", onClick: onView } }));
    const view = screen.getByRole("button", { name: "View patient" });
    expect(view).toHaveFocus();
    await userEvent.click(view);
    expect(onView).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when its link is followed", async () => {
    const respond = mount();
    act(() => respond.info({ title: "Signed out", primary: { label: "Sign in", href: "/login" } }));
    const link = screen.getByRole("link", { name: "Sign in" });
    link.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("an error card", () => {
  it("is an alertdialog with the API's words, the request id and Try again", async () => {
    const respond = mount();
    const retry = vi.fn();
    act(() =>
      respond.failure(new ApiError(503, "INTERNAL_ERROR", "We couldn't reach the server.", "req_42"), {
        title: "Patient not saved",
        retry,
      }),
    );
    const card = screen.getByRole("alertdialog", { name: "Patient not saved" });
    expect(card).toHaveTextContent("We couldn't reach the server.");
    expect(card).toHaveTextContent("Reference: req_42");
    await userEvent.click(within(card).getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("never shows a raw failure's text, and closes on Escape", async () => {
    const respond = mount();
    act(() =>
      respond.failure(new TypeError("fetch failed at 10.0.0.3"), {
        title: "Not saved",
        fallback: "EXTERNAL_SERVICE_ERROR",
      }),
    );
    const card = screen.getByRole("alertdialog", { name: "Not saved" });
    expect(card).toHaveTextContent(ERROR_MESSAGES.EXTERNAL_SERVICE_ERROR);
    expect(card).not.toHaveTextContent("10.0.0.3");
    expect(card).not.toHaveTextContent("Reference");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("takes its words directly, with Try again when it can retry", () => {
    const respond = mount();
    act(() => respond.error({ title: "Slot taken", message: "Dr Meera Nair has 10:15 booked.", retry: vi.fn() }));
    expect(screen.getByRole("alertdialog", { name: "Slot taken" })).toHaveTextContent("10:15 booked");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("keeps its own actions when it has them", () => {
    const respond = mount();
    act(() =>
      respond.error({
        title: "Mobile already used",
        message: "It belongs to Meena Gupta.",
        primary: { label: "Use that patient" },
      }),
    );
    expect(screen.getByRole("button", { name: "Use that patient" })).toBeInTheDocument();
    act(() => respond.failure(new Error("x"), { title: "Other", primary: { label: "Edit" } }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});

describe("a warning", () => {
  it("waits for a choice: no Escape, no close button", async () => {
    const respond = mount();
    act(() => respond.warning({ title: "Plan ends in 3 days", primary: { label: "See plan" } }));
    const card = screen.getByRole("alertdialog", { name: "Plan ends in 3 days" });
    expect(within(card).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(card).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "See plan" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("a confirmation", () => {
  it("answers yes from its confirm button", async () => {
    const respond = mount();
    let answer: Promise<boolean>;
    act(() => {
      answer = respond.confirm({
        title: "Void bill 2026-27/0042?",
        message: "Its payments stay recorded.",
        confirmLabel: "Void bill",
        tone: "danger",
      });
    });
    const card = screen.getByRole("alertdialog", { name: "Void bill 2026-27/0042?" });
    // A destructive question starts on the safe answer.
    expect(within(card).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(within(card).getByRole("button", { name: "Void bill" })).toHaveClass("bg-coral");
    await userEvent.click(within(card).getByRole("button", { name: "Void bill" }));
    await expect(answer!).resolves.toBe(true);
  });

  it("marks a destructive question in coral, and a plain one without", () => {
    const respond = mount();
    act(() => {
      void respond.confirm({ title: "Sign out?", confirmLabel: "Sign out", confirmIcon: LogOut });
    });
    // The mark is the icon beside the title, bare (D75).
    const mark = (name: string) =>
      screen.getByRole("heading", { name }).previousElementSibling!.querySelector("[aria-hidden='true']");
    expect(mark("Sign out?")).toHaveClass("text-ink");
    act(() => {
      void respond.confirm({ title: "Void this bill?", confirmLabel: "Void bill", tone: "danger" });
    });
    expect(mark("Void this bill?")).toHaveClass("text-coral");
  });

  it("answers no from its cancel button, and to Escape", async () => {
    const respond = mount();
    let first: Promise<boolean>;
    act(() => {
      first = respond.confirm({ title: "Sign out?", confirmLabel: "Sign out", cancelLabel: "Stay" });
    });
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveClass("bg-action");
    await userEvent.click(screen.getByRole("button", { name: "Stay" }));
    await expect(first!).resolves.toBe(false);

    let second: Promise<boolean>;
    act(() => {
      second = respond.confirm({ title: "Sign out?", confirmLabel: "Sign out" });
    });
    await userEvent.keyboard("{Escape}");
    await expect(second!).resolves.toBe(false);
  });
});

describe("a confirmation with a second way to go ahead (D192)", () => {
  it("runs the second action and answers no, so the screen goes on its own way", async () => {
    const respond = mount();
    const keep = vi.fn();
    let answer: Promise<boolean>;
    act(() => {
      answer = respond.confirm({
        title: "Rahul Mehta is still with Maya Rao",
        confirmLabel: "Mark done and send in",
        secondary: { label: "Keep both in", onClick: keep },
      });
    });
    const card = screen.getByRole("alertdialog", { name: "Rahul Mehta is still with Maya Rao" });
    expect(within(card).getByRole("button", { name: "Mark done and send in" })).toHaveFocus();
    await userEvent.click(within(card).getByRole("button", { name: "Keep both in" }));
    expect(keep).toHaveBeenCalledOnce();
    await expect(answer!).resolves.toBe(false);
  });
});

describe("one card at a time", () => {
  it("lets a graver card replace a lighter one, and a lighter one wait", async () => {
    const respond = mount();
    act(() => respond.success({ title: "Patient saved", autoClose: false }));
    act(() => respond.error({ title: "Payment not recorded", message: "Try again later." }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Payment not recorded" })).toBeInTheDocument();

    act(() => respond.success({ title: "Expense saved" }));
    act(() => respond.success({ title: "Expense saved" }));
    expect(notice()).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(notice()).toHaveTextContent("Expense saved");
    fireEvent.animationEnd(countdown());
    expect(notice()).toBeNull();
  });

  it("does not stack the same card twice, and answers no to a question it replaced", async () => {
    const respond = mount();
    let question: Promise<boolean>;
    act(() => {
      question = respond.confirm({ title: "Cancel?", confirmLabel: "Yes" });
    });
    let repeat: Promise<boolean>;
    act(() => {
      repeat = respond.confirm({ title: "Cancel?", confirmLabel: "Yes" });
    });
    await expect(repeat!).resolves.toBe(false);
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);

    act(() => {
      void respond.confirm({ title: "Delete?", confirmLabel: "Delete" });
    });
    await expect(question!).resolves.toBe(false);
    expect(screen.getByRole("alertdialog", { name: "Delete?" })).toBeInTheDocument();
  });
});

describe("a card on its way out", () => {
  const leaveWithMotion = () => {
    vi.useFakeTimers();
    HTMLElement.prototype.animate = vi.fn();
  };
  const settle = () => {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
    vi.useRealTimers();
  };

  it("drops away before it is taken off, a notice and a card alike", async () => {
    leaveWithMotion();
    const respond = mount();
    act(() => respond.success({ title: "Visit saved" }));
    fireEvent.click(screen.getByRole("button", { name: "Close “Visit saved”" }));
    expect(notice()).toHaveClass("animate-card-out", "pointer-events-none");
    act(() => vi.advanceTimersByTime(MAP_MS));
    expect(notice()).toBeNull();

    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = respond.confirm({ title: "Cancel this appointment?", confirmLabel: "Cancel appointment" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel appointment" }));
    // The answer is given at once; the card closes, and is gone once it has left.
    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(document.querySelector("dialog")).not.toBeNull();
    act(() => vi.advanceTimersByTime(MAP_MS));
    expect(document.querySelector("dialog")).toBeNull();
    settle();
  });

  it("lets the card waiting behind it follow once it has gone", () => {
    leaveWithMotion();
    const respond = mount();
    act(() => respond.error({ title: "Appointment not booked", message: "Try again." }));
    act(() => respond.success({ title: "Visit saved" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Close" }));
    expect(notice()).toBeNull();
    act(() => vi.advanceTimersByTime(MAP_MS));
    expect(notice()).toHaveTextContent("Visit saved");
    settle();
  });

  it("gives way at once to a new card, even one just like it", () => {
    leaveWithMotion();
    const respond = mount();
    act(() => respond.success({ title: "Visit saved" }));
    fireEvent.click(screen.getByRole("button", { name: "Close “Visit saved”" }));
    act(() => respond.success({ title: "Visit saved" }));
    expect(notice()).not.toHaveClass("animate-card-out");
    expect(notice()).toHaveTextContent("Visit saved");
    act(() => vi.advanceTimersByTime(MAP_MS));
    expect(notice()).toHaveTextContent("Visit saved");
    settle();
  });
});

// A patient's visits, and Record vitals over them, as a profile opens them.
interface Stage {
  respond: Respond;
  history: (open: boolean) => void;
  form: (open: boolean) => void;
}

function Sheets({ onReady }: { onReady: (stage: Stage) => void }) {
  const respond = useResponse();
  const [history, setHistory] = useState(false);
  const [form, setForm] = useState(false);
  useState(() => onReady({ respond, history: setHistory, form: setForm }));
  return (
    <>
      <Modal open={history} onDismiss={() => setHistory(false)} labelledBy="history" motion="sheet">
        <h2 id="history">Visits</h2>
        <button type="button">Record vitals</button>
      </Modal>
      <Modal open={form} onDismiss={() => setForm(false)} labelledBy="form" motion="sheet">
        <h2 id="form">Record vitals for Meena Gupta</h2>
        <button type="button">Save</button>
      </Modal>
    </>
  );
}

function stage() {
  let ready!: Stage;
  const view = render(
    <ResponseProvider>
      <Sheets onReady={(value) => (ready = value)} />
    </ResponseProvider>,
  );
  return { ...ready, unmount: view.unmount };
}

const dialog = (name: string) => screen.getByRole("dialog", { name });
const said = (element: HTMLElement) => within(element).getByRole("status").textContent;
const page = () => document.querySelector<HTMLElement>("body > div > p[role=status]")!;

describe("a notice over a sheet", () => {
  it("is drawn inside the sheet on top, where it can be seen and reached, and said from there", () => {
    const { respond, history } = stage();
    act(() => history(true));
    act(() => respond.success({ title: "Visit saved" }));
    expect(dialog("Visits")).toContainElement(notice());
    expect(said(dialog("Visits"))).toBe("Visit saved");
    // The page's own region is inert under the sheet, and says nothing.
    expect(page()).toHaveTextContent("");

    fireEvent.animationEnd(countdown());
    expect(said(dialog("Visits"))).toBe("");
  });

  it("goes over the sheet that stays when a form over it closes as it saves", () => {
    const { respond, history, form } = stage();
    act(() => history(true));
    act(() => form(true));
    act(() => {
      form(false);
      respond.success({ title: "Visit saved" });
    });
    expect(dialog("Visits")).toContainElement(notice());
    expect(said(dialog("Visits"))).toBe("Visit saved");
  });

  it("is said again where it goes when the sheet it was said in closes after it, as one closed through history does", () => {
    const { respond, history, form } = stage();
    act(() => history(true));
    act(() => form(true));
    act(() => respond.success({ title: "Vitals saved" }));
    expect(said(dialog("Record vitals for Meena Gupta"))).toBe("Vitals saved");

    act(() => form(false));
    expect(said(dialog("Visits"))).toBe("Vitals saved");
    act(() => history(false));
    expect(page()).toHaveTextContent("Vitals saved");
    fireEvent.animationEnd(countdown());
    expect(page()).toHaveTextContent("");
  });

  it("stays under a sheet opened after it; when its own closes, it goes to what is open, and then the page", () => {
    const { respond, history, form } = stage();
    act(() => history(true));
    act(() => respond.success({ title: "Visit saved" }));
    act(() => form(true));
    expect(dialog("Visits")).toContainElement(notice());

    act(() => history(false));
    expect(dialog("Record vitals for Meena Gupta")).toContainElement(notice());
    act(() => form(false));
    expect(notice()!.closest("dialog")).toBeNull();
    expect(notice()).toHaveTextContent("Visit saved");
  });

  it("is on the page, and said there, with no sheet open", () => {
    const { respond, history } = stage();
    act(() => respond.success({ title: "Patient saved" }));
    expect(notice()!.closest("dialog")).toBeNull();
    expect(page()).toHaveTextContent("Patient saved");
    // A sheet opened after it leaves it where it was, said once.
    act(() => history(true));
    expect(notice()!.closest("dialog")).toBeNull();
    expect(page()).toHaveTextContent("Patient saved");
    expect(said(dialog("Visits"))).toBe("");
  });

  it("closes first on Escape, and the sheet under it on the next", async () => {
    const { respond, history } = stage();
    act(() => history(true));
    act(() => respond.success({ title: "Visit saved" }));
    await userEvent.keyboard("{Shift}");
    expect(notice()).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(notice()).toBeNull();
    expect(dialog("Visits")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Visits" })).not.toBeInTheDocument();
  });

  it("leaves Escape to a sheet opened over it", async () => {
    const { respond, history, form } = stage();
    act(() => history(true));
    act(() => respond.success({ title: "Visit saved" }));
    act(() => form(true));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Record vitals for Meena Gupta" })).not.toBeInTheDocument();
    expect(notice()).toHaveTextContent("Visit saved");
  });

  it("rises in once, and not again when it follows its sheet away", () => {
    const { respond, history } = stage();
    act(() => history(true));
    act(() => respond.success({ title: "Visit saved" }));
    expect(notice()).toHaveClass("animate-card-in");
    // The countdown's own end is not the entrance's.
    fireEvent.animationEnd(countdown(), { bubbles: true });
    act(() => respond.success({ title: "Visit saved again" }));
    expect(notice()).toHaveClass("animate-card-in");
    fireEvent.animationEnd(notice()!);
    expect(notice()).not.toHaveClass("animate-card-in");
    act(() => history(false));
    expect(notice()).not.toHaveClass("animate-card-in");
  });

  it("draws on the server, where there is no page to hold a notice", () => {
    vi.stubGlobal("document", undefined);
    try {
      expect(renderToString(<ResponseProvider>Screen</ResponseProvider>)).toContain('role="status"');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("takes its holder off the page when it goes", () => {
    const { respond, unmount } = stage();
    act(() => respond.success({ title: "Patient saved" }));
    const holder = notice()!.parentElement!;
    unmount();
    expect(holder).not.toBeInTheDocument();
  });
});
