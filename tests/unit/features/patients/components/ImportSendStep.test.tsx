import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportSendState } from "@/features/patients/hooks/useImportSend";
import type { ImportSheet } from "@/features/patients/import-file";
import type { CheckedRow } from "@/features/patients/import-rows";
import { authStub } from "@tests/support/auth";

const { auth, download } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  download: { saveCsv: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/lib/download", () => download);

const { ImportSendStep } = await import("@/features/patients/components/ImportSendStep");

const SHEET: ImportSheet = { name: "patients.csv", headers: ["Name", "Mobile"], rows: [] };
const row = (line: number, name: string, problems: string[] = []): CheckedRow => ({
  line,
  cells: [name, "123"],
  key: String(line),
  input: problems.length ? null : ({} as CheckedRow["input"]),
  name,
  phone: null,
  problems,
});
const TO_SEND = [row(2, "Rohan"), row(3, "Asha")];
const PROBLEMS = [row(5, "Kiran", ["Mobile number must be real."])];
const sender = (state: ImportSendState) => ({ state, send: vi.fn(), retry: vi.fn(), reset: vi.fn() });
const onBack = vi.fn();
const onRestart = vi.fn();

const draw = (state: ImportSendState, readOnly = false, problems = PROBLEMS) => {
  const sending = sender(state);
  render(
    <ImportSendStep
      sheet={SHEET}
      toSend={TO_SEND}
      skipped={1}
      problems={problems}
      sender={sending}
      readOnly={readOnly}
      onBack={onBack}
      onRestart={onRestart}
    />,
  );
  return sending;
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
});

describe("ImportSendStep (plan §10.5, D133)", () => {
  it("says what will be added and left out, then imports them", async () => {
    const sending = draw({ status: "IDLE" });
    expect(screen.getByText("2 patients will be added, numbered after the clinic's last.")).toBeInTheDocument();
    expect(screen.getByText("1 skipped as duplicates, 1 left out with problems.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Import 2 patients" }));
    expect(sending.send).toHaveBeenCalledWith(TO_SEND);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("imports nothing in a view-only clinic, and says why", () => {
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw({ status: "IDLE" }, true);
    expect(screen.getByRole("button", { name: "Import 2 patients" })).toBeDisabled();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
  });

  it("shows how far it has got while it sends, with no way back", () => {
    draw({ status: "SENDING", done: 200, total: 800 });
    const progress = screen.getByRole("progressbar", { name: "Import progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "200");
    expect(progress).toHaveAttribute("aria-valuemax", "800");
    expect(screen.getByRole("status")).toHaveTextContent("Importing… 200 of 800");
    expect(screen.getByText("Keep this page open until it finishes.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says where it stopped, and carries on from there", async () => {
    const sending = draw({ status: "STOPPED", done: 200, total: 800 });
    expect(screen.getByRole("status")).toHaveTextContent("The import stopped at 200 of 800.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(sending.retry).toHaveBeenCalled();
  });

  it("counts what came of it, hands back the rows not imported as a CSV, and leads to the patients", async () => {
    draw({ status: "DONE", imported: 1, refused: [{ row: row(3, "Asha"), problem: "Refused by the server." }] });
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["1", "1", "2"]);
    expect(screen.getByRole("link", { name: "Open patients" })).toHaveAttribute("href", "/patients");
    await userEvent.click(screen.getByRole("button", { name: "Download rows not imported" }));
    expect(download.saveCsv).toHaveBeenCalledWith(
      "patients-not-imported.csv",
      "Name,Mobile,Problem\r\nAsha,123,Refused by the server.\r\nKiran,123,Mobile number must be real.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Import another file" }));
    expect(onRestart).toHaveBeenCalled();
  });

  it("offers no download when every row was imported", () => {
    draw({ status: "DONE", imported: 2, refused: [] }, false, []);
    expect(screen.queryByRole("button", { name: "Download rows not imported" })).not.toBeInTheDocument();
  });
});
