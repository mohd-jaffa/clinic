import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Closure } from "@/features/clinic/types";
import { ApiError } from "@/lib/api/client";
import { aClosure } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { remove: vi.fn() } }));
vi.mock("@/features/clinic/api.client", () => ({ ClosuresClient: client }));

const { useClosureRemoval } = await import("@/features/clinic/hooks/useClosureRemoval");

const diwali = aClosure();
let hook: { current: ReturnType<typeof useClosureRemoval> };

beforeEach(() => {
  client.remove.mockReset();
  hook = renderHook(() => useClosureRemoval(), { wrapper: Providers }).result;
});

const ask = () => screen.findByRole("alertdialog", { name: "Remove Diwali?" });

describe("useClosureRemoval (D84)", () => {
  it("removes only once asked, on a danger card, marks which one meanwhile, and says so", async () => {
    let finish: (value: Closure) => void = () => {};
    client.remove.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    let done: Promise<void>;
    act(() => {
      done = hook.current.remove(diwali);
    });
    const card = await ask();
    expect(card).toHaveTextContent("Booking opens on those days again.");
    expect(hook.current.removing).toBeNull();
    await userEvent.click(within(card).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(hook.current.removing).toBe("h-1"));
    await act(async () => {
      finish(diwali);
      await done;
    });
    expect(client.remove).toHaveBeenCalledWith("h-1");
    expect(hook.current.removing).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Diwali removed");
  });

  it("does nothing when the question is put aside", async () => {
    let done: Promise<void>;
    act(() => {
      done = hook.current.remove(diwali);
    });
    await userEvent.click(within(await ask()).getByRole("button", { name: "Cancel" }));
    await act(() => done);
    expect(client.remove).not.toHaveBeenCalled();
  });

  it("says why it could not, in the API's words", async () => {
    client.remove.mockRejectedValue(new ApiError(422, "CLOSURE_OVER", "That’s already over — it stays as a record."));
    act(() => {
      void hook.current.remove(diwali);
    });
    await userEvent.click(within(await ask()).getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t removed" })).toHaveTextContent(
      "That’s already over",
    );
  });
});
