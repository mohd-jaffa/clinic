import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportSheet } from "@/features/patients/import-file";
import { authStub } from "@tests/support/auth";

const { auth, reader } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  reader: { read: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/patients/import-file", async (actual) => ({
  ...(await actual<typeof import("@/features/patients/import-file")>()),
  readImportFile: reader.read,
}));

const { ImportFileStep } = await import("@/features/patients/components/ImportFileStep");
const { ImportFileError } = await import("@/features/patients/import-file");

const SHEET: ImportSheet = {
  name: "patients.xlsx",
  headers: ["Name"],
  rows: Array.from({ length: 1240 }, (_, index) => ({ line: index + 2, cells: [`P ${index}`] })),
};
const onRead = vi.fn();
const onNext = vi.fn();

const draw = (sheet: ImportSheet | null = null, readOnly = false) =>
  render(<ImportFileStep sheet={sheet} maxRows={10_000} readOnly={readOnly} onRead={onRead} onNext={onNext} />);

/** The hidden picker, as the Choose file button opens it. */
const choose = (file: File) => {
  const picker = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(picker, { target: { files: [file] } });
  return picker;
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
});

describe("ImportFileStep (plan §10.5, D127)", () => {
  it("opens the file picker for a CSV or Excel file, and reads the one chosen", async () => {
    reader.read.mockResolvedValue(SHEET);
    draw();
    const picker = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(picker).toHaveAttribute("accept", expect.stringContaining(".xlsx"));
    const click = vi.spyOn(picker, "click");
    await userEvent.click(screen.getByRole("button", { name: "Choose file" }));
    expect(click).toHaveBeenCalled();

    const file = new File(["x"], "patients.xlsx");
    choose(file);
    await waitFor(() => expect(onRead).toHaveBeenCalledWith(SHEET));
    expect(reader.read).toHaveBeenCalledWith(file);
    expect(picker.value).toBe("");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("says what it found once read, and goes on", async () => {
    draw(SHEET);
    expect(screen.getByText("patients.xlsx · 1,240 rows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose another file" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalled();
  });

  it("says why a file could not be read, or was too long", async () => {
    reader.read.mockRejectedValueOnce(new ImportFileError("IMPORT_FILE_XLS"));
    draw();
    choose(new File(["x"], "old.xls"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That's an older Excel file (.xls).");

    reader.read.mockRejectedValueOnce(new Error("strange"));
    choose(new File(["x"], "odd.csv"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That file couldn't be read."));

    reader.read.mockResolvedValueOnce({ ...SHEET, rows: Array(10_001).fill({ line: 2, cells: [] }) });
    choose(new File(["x"], "big.csv"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That file has 10,001 rows"));
    expect(onRead).not.toHaveBeenCalled();
  });

  it("does nothing when no file was chosen", () => {
    draw();
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [] } });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it("chooses nothing in a view-only clinic, and says why", () => {
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw(SHEET, true);
    expect(screen.getByRole("button", { name: "Choose another file" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
  });
});
