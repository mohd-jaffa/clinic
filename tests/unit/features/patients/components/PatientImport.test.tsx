import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportSheet } from "@/features/patients/import-file";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, limits, reader, client } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  limits: { current: {} as Record<string, unknown> },
  reader: { read: vi.fn() },
  client: { matches: vi.fn(), send: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/hooks/useImportLimits", () => ({ useImportLimits: () => limits.current }));
vi.mock("@/features/patients/import-file", async (actual) => ({
  ...(await actual<typeof import("@/features/patients/import-file")>()),
  readImportFile: reader.read,
}));
vi.mock("@/features/patients/api.client", () => ({ ImportClient: client }));

const { PatientImport } = await import("@/features/patients/components/PatientImport");

const SHEET: ImportSheet = {
  name: "patients.csv",
  headers: ["Name", "Mobile", "DOB", "Gender"],
  rows: [
    { line: 2, cells: ["Rohan Mehta", "9876543210", "03/04/1990", "M"] },
    { line: 3, cells: ["Asha Rao", "9811111111", "1991-06-14", "F"] },
    { line: 4, cells: ["Rohan Mehta", "9876543210", "03/04/1990", "M"] },
  ],
};

const draw = () =>
  render(
    <Providers>
      <PatientImport />
    </Providers>,
  );
const current = () =>
  within(screen.getByRole("list", { name: "Import steps" }))
    .getAllByRole("listitem")
    .find((step) => step.getAttribute("aria-current") === "step")?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T06:00:00Z"));
  auth.current = authStub();
  limits.current = { data: { maxRows: 10_000, batchSize: 200 }, isLoading: false };
  reader.read.mockResolvedValue(SHEET);
  client.matches.mockResolvedValue([]);
  client.send.mockImplementation(async (rows: unknown[]) => ({ imported: rows.length, added: rows.length }));
});
afterEach(() => vi.useRealTimers());

describe("PatientImport (plan §10.5, D127 – D133)", () => {
  it("takes the owner from a file to imported patients, a step at a time", async () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Import patients" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/settings");
    expect(current()).toBe("1File");

    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "p.csv")] } });
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(current()).toBe("2Columns");
    expect(screen.getByRole("combobox", { name: /^Gender/ })).toHaveTextContent("D · Gender");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(current()).toBe("3Check");
    const duplicate = await screen.findByRole("checkbox", { name: "Row 4 · Rohan Mehta" });
    expect(client.matches).toHaveBeenCalledWith(["+919876543210", "+919811111111"]);
    await userEvent.click(duplicate);
    expect(duplicate).toBeChecked();
    await userEvent.click(duplicate);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(current()).toBe("4Import");
    await userEvent.click(screen.getByRole("button", { name: "Import 2 patients" }));
    expect(await screen.findByRole("heading", { name: "Import finished" })).toBeInTheDocument();
    expect(client.send).toHaveBeenCalledOnce();
    expect(current()).toBeUndefined();

    await userEvent.click(screen.getByRole("button", { name: "Import another file" }));
    expect(current()).toBe("1File");
    expect(screen.getByRole("button", { name: "Choose file" })).toBeInTheDocument();
  });

  it("goes back a step at a time, keeping the file and its columns", async () => {
    draw();
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "p.csv")] } });
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("checkbox", { name: "Row 4 · Rohan Mehta" });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(current()).toBe("3Check");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(current()).toBe("2Columns");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("patients.csv · 3 rows")).toBeInTheDocument();
  });

  it("stands in while it is set up, and says when it couldn't be", async () => {
    limits.current = { data: undefined, isLoading: true };
    const { unmount } = draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
    unmount();
    const mutate = vi.fn();
    limits.current = { data: undefined, isLoading: false, error: new Error("offline"), mutate };
    draw();
    expect(screen.getByRole("alert")).toHaveTextContent("The import couldn't be set up.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });
});
