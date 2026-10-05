import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CheckedRow } from "@/features/patients/import-rows";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, refresh } = vi.hoisted(() => ({ client: { send: vi.fn() }, refresh: vi.fn() }));
vi.mock("@/features/patients/api.client", () => ({ ImportClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { useImportSend } = await import("@/features/patients/hooks/useImportSend");

const row = (line: number): CheckedRow => ({
  line,
  cells: [`Patient ${line}`],
  key: `k-${line}`,
  input: { key: `k-${line}`, fullName: `Patient ${line}` } as CheckedRow["input"],
  name: `Patient ${line}`,
  phone: "+919876543210",
  problems: [],
});
const ROWS = [row(2), row(3), row(4), row(5), row(6)];

const renderSend = () => renderHook(() => useImportSend(2), { wrapper: Providers }).result;

beforeEach(() => {
  vi.clearAllMocks();
  client.send.mockImplementation(async (rows: unknown[]) => ({ imported: rows.length, added: rows.length }));
});

describe("useImportSend (plan §10.5)", () => {
  it("sends the rows a batch at a time, one after another, then reads the patients again", async () => {
    const hook = renderSend();
    expect(hook.current.state).toEqual({ status: "IDLE" });
    await act(() => hook.current.send(ROWS));
    expect(client.send.mock.calls.map(([rows]) => rows.map((input: { key: string }) => input.key))).toEqual([
      ["k-2", "k-3"],
      ["k-4", "k-5"],
      ["k-6"],
    ]);
    expect(refresh).toHaveBeenCalledWith(["/api/patients/search", "/api/patients/matches"]);
    expect(hook.current.state).toEqual({ status: "DONE", imported: 5, refused: [] });
  });

  it("shows how far it has got, and asks before the page is left while it sends", async () => {
    let finish: (value: unknown) => void = () => {};
    client.send.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const hook = renderSend();
    act(() => void hook.current.send(ROWS.slice(0, 2)));
    await waitFor(() => expect(hook.current.state).toEqual({ status: "SENDING", done: 0, total: 2 }));
    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    await act(async () => finish({ imported: 2, added: 2 }));
    await waitFor(() => expect(hook.current.state.status).toBe("DONE"));
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("leaves out a batch whose rows were refused, with why, and goes on", async () => {
    client.send.mockRejectedValueOnce(new ApiError(400, "VALIDATION_ERROR", "Mobile number must be real.", "req_1"));
    const hook = renderSend();
    await act(() => hook.current.send(ROWS));
    expect(hook.current.state).toEqual({
      status: "DONE",
      imported: 3,
      refused: [
        { row: ROWS[0], problem: "Mobile number must be real." },
        { row: ROWS[1], problem: "Mobile number must be real." },
      ],
    });
  });

  it("stops at anything else, says so, and carries on from the same batch, adding no one twice", async () => {
    client.send
      .mockResolvedValueOnce({ imported: 2, added: 2 })
      .mockRejectedValueOnce(new ApiError(0, "NETWORK_OFFLINE", "You're offline.", undefined));
    const hook = renderSend();
    await act(() => hook.current.send(ROWS));
    expect(hook.current.state).toEqual({ status: "STOPPED", done: 2, total: 5 });
    const card = await screen.findByRole("alertdialog", {
      name: "The import stopped at 2 of 5. No one is added twice, so try again to carry on.",
    });
    expect(card).toHaveTextContent("You're offline.");

    await act(async () => within(card).getByRole("button", { name: "Try again" }).click());
    await waitFor(() => expect(hook.current.state).toEqual({ status: "DONE", imported: 5, refused: [] }));
    expect(client.send.mock.calls.map(([rows]) => rows[0].key)).toEqual(["k-2", "k-4", "k-4", "k-6"]);
  });

  it("starts over for another file", async () => {
    const hook = renderSend();
    await act(() => hook.current.send(ROWS.slice(0, 1)));
    act(() => hook.current.reset());
    expect(hook.current.state).toEqual({ status: "IDLE" });
    await act(() => hook.current.retry());
    expect(hook.current.state).toEqual({ status: "DONE", imported: 0, refused: [] });
  });
});
