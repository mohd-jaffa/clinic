import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportCheckStep } from "@/features/patients/components/ImportCheckStep";
import type { CheckedRow, DuplicateOf } from "@/features/patients/import-rows";

const row = (line: number, name: string, problems: string[] = []): CheckedRow => ({
  line,
  cells: [name],
  key: String(line),
  input: problems.length ? null : ({} as CheckedRow["input"]),
  name,
  phone: problems.length ? null : "+919876543210",
  problems,
});
const ROWS = [
  row(2, "Rohan Mehta"),
  row(3, "Asha Rao"),
  row(4, "", ["Full name needs a value.", "Mobile number must be real."]),
  row(5, "Rohan Mehta"),
  row(6, "Asha Rao"),
];
const DUPLICATES = new Map<number, DuplicateOf>([
  [5, { kind: "ROW", line: 2 }],
  [6, { kind: "PATIENT", number: 1012, name: "Asha Rao" }],
]);
const done = { checked: { status: "DONE" as const, duplicates: DUPLICATES }, retry: vi.fn() };
const onToggle = vi.fn();
const onBack = vi.fn();
const onNext = vi.fn();

const draw = (
  matches: Parameters<typeof ImportCheckStep>[0]["matches"] = done,
  rows: readonly CheckedRow[] = ROWS,
  included: ReadonlySet<number> = new Set(),
) =>
  render(
    <ImportCheckStep
      rows={rows}
      matches={matches}
      included={included}
      onToggle={onToggle}
      onBack={onBack}
      onNext={onNext}
    />,
  );

beforeEach(() => vi.clearAllMocks());

describe("ImportCheckStep (plan §10.5, D129)", () => {
  it("counts what is ready, what may be a duplicate and what has a problem", () => {
    draw();
    const counts = within(screen.getByRole("region", { name: "The rows" }));
    expect(counts.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Ready",
      "Possible duplicates",
      "With problems",
    ]);
    expect(counts.getAllByRole("definition").map((value) => value.textContent)).toEqual(["2", "2", "1"]);
  });

  it("lists each problem row with why, left out", () => {
    draw();
    const problems = within(screen.getByRole("list", { name: "With problems" })).getAllByRole("listitem");
    expect(problems.map((item) => item.textContent)).toEqual([
      "Row 4Full name needs a value. Mobile number must be real.",
    ]);
  });

  it("lists each possible duplicate with what it matched, skipped unless ticked", async () => {
    draw(done, ROWS, new Set([6]));
    const duplicates = screen.getByRole("list", { name: "Possible duplicates" });
    const rohan = within(duplicates).getByRole("checkbox", { name: "Row 5 · Rohan Mehta" });
    expect(rohan).not.toBeChecked();
    expect(rohan).toHaveAccessibleDescription("Same mobile and name as row 2");
    const asha = within(duplicates).getByRole("checkbox", { name: "Row 6 · Asha Rao" });
    expect(asha).toBeChecked();
    expect(asha).toHaveAccessibleDescription("Same mobile and name as P-1012 Asha Rao");
    await userEvent.click(rohan);
    expect(onToggle).toHaveBeenCalledWith(5);
  });

  it("goes back, and on once there is anything to import", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect([onBack, onNext].map((fn) => fn.mock.calls.length)).toEqual([1, 1]);
  });

  it("goes no further when nothing is ready, and says what to do", () => {
    draw(done, [row(4, "", ["Full name needs a value."]), row(5, "Rohan Mehta")]);
    expect(screen.getByText(/No row is ready to import/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("shows a long list a page at a time", async () => {
    const many = Array.from({ length: 45 }, (_, index) => row(index + 2, `P ${index}`, ["Gender needs to say Male."]));
    draw({ checked: { status: "DONE", duplicates: new Map() }, retry: vi.fn() }, many);
    const problems = () => within(screen.getByRole("list", { name: "With problems" })).getAllByRole("listitem");
    expect(problems()).toHaveLength(20);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(problems()).toHaveLength(45);
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Possible duplicates" })).not.toBeInTheDocument();
  });

  it("stands in while the clinic's patients are asked about, and says when they couldn't be", async () => {
    const { unmount } = draw({ checked: null, retry: vi.fn() });
    expect(screen.getByRole("region", { name: "Checking against the clinic's patients…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    unmount();
    const retry = vi.fn();
    draw({ checked: { status: "FAILED", failure: new Error("offline") }, retry });
    expect(screen.getByRole("alert")).toHaveTextContent("The rows couldn't be checked against the clinic's patients.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});
