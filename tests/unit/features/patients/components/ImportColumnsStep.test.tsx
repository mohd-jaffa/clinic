import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportColumnsStep } from "@/features/patients/components/ImportColumnsStep";
import { guessColumns, type ColumnMap } from "@/features/patients/import-columns";
import type { ImportSheet } from "@/features/patients/import-file";

const SHEET: ImportSheet = {
  name: "patients.csv",
  headers: ["Patient", "Phone", "Born", ""],
  rows: [{ line: 2, cells: ["Rohan Mehta", 9876543210, "03/04/1990", null] }],
};
const onBack = vi.fn();
const onNext = vi.fn();
const changes = vi.fn();

function Harness({ initial }: { initial: ColumnMap }) {
  const [map, setMap] = useState(initial);
  return (
    <ImportColumnsStep
      sheet={SHEET}
      map={map}
      onChange={(next) => {
        changes(next);
        setMap(next);
      }}
      onBack={onBack}
      onNext={onNext}
    />
  );
}

const field = (name: RegExp) => screen.getByRole("combobox", { name });

beforeEach(() => vi.clearAllMocks());

describe("ImportColumnsStep (plan §10.5)", () => {
  it("shows each field with the column guessed for it, and that column's first value", () => {
    render(<Harness initial={guessColumns(SHEET.headers)} />);
    expect(field(/^Full name/)).toHaveTextContent("A · Patient");
    expect(field(/^Mobile/)).toHaveTextContent("B · Phone");
    expect(field(/^Date of birth/)).toHaveTextContent("C · Born");
    expect(field(/^Gender/)).toHaveTextContent("Not in the file");
    expect(screen.getByText("First row: Rohan Mehta")).toBeInTheDocument();
    expect(screen.getByText("First row: 9876543210")).toBeInTheDocument();
  });

  it("asks for what a row cannot do without before going on", async () => {
    render(<Harness initial={{ ...guessColumns(SHEET.headers), dateOfBirth: null }} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByText("Choose the column for gender.")).toBeInTheDocument();
    expect(screen.getByText("Choose the column for the date of birth or the age.")).toBeInTheDocument();
    expect(screen.queryByText("Choose the column for full name.")).not.toBeInTheDocument();
  });

  it("takes another column for a field, or none, and goes on once nothing is missing", async () => {
    render(<Harness initial={guessColumns(SHEET.headers)} />);
    await userEvent.click(field(/^Gender/));
    await userEvent.click(screen.getByRole("option", { name: "Column D" }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ gender: 3 }));
    await userEvent.click(field(/^Mobile/));
    await userEvent.click(screen.getByRole("option", { name: "Not in the file" }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ phone: null }));
    await userEvent.click(field(/^Mobile/));
    await userEvent.click(screen.getByRole("option", { name: "B · Phone" }));

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
