import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToBillVisit } from "@/features/billing/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, list, asked } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  list: {
    current: {} as {
      data?: unknown;
      error?: unknown;
      hasMore?: boolean;
      loadingMore?: boolean;
      loadMore?: () => void;
      mutate?: () => void;
    },
  },
  asked: vi.fn(),
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/billing/hooks/useToBill", () => ({
  useToBill: (...args: unknown[]) => {
    asked(...args);
    return list.current;
  },
}));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: { noCharge: vi.fn() } }));

const { QueueToBill } = await import("@/features/appointments/components/QueueToBill");

const visit = (overrides: Partial<ToBillVisit> = {}): ToBillVisit => ({
  visitId: "v-1",
  day: "2026-10-18",
  completedAt: null,
  patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
  doctor: { id: "d-1", name: "Maya Rao" },
  appointmentId: "a-1",
  token: 4,
  treatments: [],
  feePaid: false,
  ...overrides,
});

const draw = (props: { doctorId?: string; total?: number } = {}) =>
  render(<QueueToBill doctorId={props.doctorId ?? ""} total={props.total} />, { wrapper: Providers });
const heading = () => screen.getByRole("heading", { level: 2, name: /^To bill/ });

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view", "payments.create"] });
  list.current = {
    data: [visit(), visit({ visitId: "v-2", patient: { ...visit().patient, id: "p-2", name: "Kiran Das" } })],
  };
});

describe("QueueToBill (plan §15.6; D318, D340)", () => {
  it("lists every doctor's visits to bill, read again with the queue, counting how many wait — its section the pin's", () => {
    draw({ total: 5 });
    expect(asked).toHaveBeenLastCalledWith(undefined, { beside: true });
    expect(heading()).toHaveTextContent("To bill5");
    expect(heading().closest("section")).toHaveAttribute("id", "to-bill");
    const rows = within(screen.getByRole("list", { name: "To bill" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Maya Rao");
  });

  it("keeps to the doctor whose queue is shown, without naming them, and counts the rows until the count comes", () => {
    draw({ doctorId: "d-1" });
    expect(asked).toHaveBeenLastCalledWith("d-1", { beside: true });
    expect(heading()).toHaveTextContent("To bill2");
    expect(screen.getByRole("list", { name: "To bill" })).not.toHaveTextContent("Maya Rao");
  });

  it("opens a visit's sheet, whose Bill leads back to the queue", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Check out Asha Rao’s visit" }));
    expect(screen.getByRole("link", { name: "Bill Asha Rao’s visit" })).toHaveAttribute(
      "href",
      "/billing/new?visit=v-1&from=queue",
    );
  });

  it("offers no Bill to someone who may only read bills, nor in a view-only clinic", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view"] });
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: /^Check out/ })).not.toBeInTheDocument();
    unmount();
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.queryByRole("button", { name: /^Check out/ })).not.toBeInTheDocument();
  });

  it("says when no one waits, whatever the count last said", () => {
    list.current = { data: [] };
    draw({ total: 2 });
    expect(heading()).toHaveTextContent("To bill0");
    expect(screen.getByText("No one is waiting to be billed")).toBeInTheDocument();
  });

  it("shows more when there are more", async () => {
    const loadMore = vi.fn();
    list.current = { ...list.current, hasMore: true, loadingMore: false, loadMore };
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(loadMore).toHaveBeenCalled();
  });

  it("stands in while it loads, and says when it could not, with Try again", async () => {
    list.current = { data: undefined };
    const { unmount } = draw({ total: 3 });
    expect(heading()).toHaveTextContent(/^To bill$/);
    expect(screen.queryByRole("list", { name: "To bill" })).not.toBeInTheDocument();
    unmount();
    const mutate = vi.fn();
    list.current = { data: undefined, error: new Error("down"), mutate };
    draw();
    expect(screen.getByText("What’s to bill couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
