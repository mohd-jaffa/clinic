import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CheckedRow } from "@/features/patients/import-rows";

const { client } = vi.hoisted(() => ({ client: { matches: vi.fn() } }));
vi.mock("@/features/patients/api.client", () => ({ ImportClient: client }));

const { useImportMatches } = await import("@/features/patients/hooks/useImportMatches");

const row = (line: number, name: string, phone: string | null): CheckedRow => ({
  line,
  cells: [],
  key: String(line),
  input: phone === null ? null : ({} as CheckedRow["input"]),
  name,
  phone,
  problems: [],
});
const ROWS = [
  row(2, "Rohan Mehta", "+919876543210"),
  row(3, "Asha Rao", "+919811111111"),
  row(4, "Rohan Mehta", "+919876543210"),
  row(5, "Bad", null),
];

beforeEach(() => {
  client.matches.mockReset();
});

describe("useImportMatches (D129)", () => {
  it("asks about each mobile once, a batch at a time, then names the duplicates", async () => {
    client.matches
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ phone: "+919811111111", number: 1012, name: "Asha Rao" }]);
    const { result } = renderHook(() => useImportMatches(ROWS, 1));
    expect(result.current.checked).toBeNull();
    await waitFor(() => expect(result.current.checked?.status).toBe("DONE"));
    expect(client.matches.mock.calls).toEqual([[["+919876543210"]], [["+919811111111"]]]);
    expect(result.current.checked).toEqual({
      status: "DONE",
      duplicates: new Map([
        [3, { kind: "PATIENT", number: 1012, name: "Asha Rao" }],
        [4, { kind: "ROW", line: 2 }],
      ]),
    });
  });

  it("says when it could not ask, and asks again", async () => {
    const failure = new Error("offline");
    client.matches.mockRejectedValueOnce(failure).mockResolvedValue([]);
    const { result } = renderHook(() => useImportMatches(ROWS, 200));
    await waitFor(() => expect(result.current.checked).toEqual({ status: "FAILED", failure }));
    act(() => result.current.retry());
    expect(result.current.checked).toBeNull();
    await waitFor(() => expect(result.current.checked?.status).toBe("DONE"));
  });

  it("asks nothing when no row is ready, and drops an answer that came too late", async () => {
    const { result, rerender, unmount } = renderHook(({ rows }) => useImportMatches(rows, 200), {
      initialProps: { rows: [row(5, "Bad", null)] as readonly CheckedRow[] },
    });
    await waitFor(() => expect(result.current.checked).toEqual({ status: "DONE", duplicates: new Map() }));
    expect(client.matches).not.toHaveBeenCalled();

    let answer: (value: unknown[]) => void = () => {};
    client.matches.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    rerender({ rows: ROWS });
    expect(result.current.checked).toBeNull();
    unmount();
    await act(async () => answer([]));
  });
});
