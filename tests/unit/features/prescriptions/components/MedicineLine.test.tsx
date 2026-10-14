import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientAlert } from "@/features/patients/types";
import type { PrescriptionItem } from "@/features/prescriptions/types";
import { prescriptionSchema, type PrescriptionInput, type PrescriptionItemInput } from "@/lib/validation";

const { suggest } = vi.hoisted(() => ({ suggest: vi.fn() }));
vi.mock("@/features/prescriptions/hooks/useMedicineSuggestions", () => ({ useMedicineSuggestions: suggest }));

const { EMPTY_LINE, lineInput, MedicineLine } = await import("@/features/prescriptions/components/MedicineLine");

const PENICILLIN: PatientAlert = { id: "al-1", kind: "ALLERGY", label: "Penicillin", note: null, active: true };

/** What the clinic wrote before (D211): one line with everything, one with a typed frequency, one with nothing more. */
const FOUND: PrescriptionItem[] = [
  {
    medicine: "Paracetamol",
    strength: "500 mg",
    dose: "1 tab",
    frequency: "1-0-1",
    timing: "AFTER_FOOD",
    durationDays: 5,
    instructions: "Dissolve in water",
  },
  {
    medicine: "Pantoprazole",
    strength: "40 mg",
    dose: null,
    frequency: "Once a week",
    timing: "EMPTY_STOMACH",
    durationDays: null,
    instructions: null,
  },
  {
    medicine: "Paracip",
    strength: null,
    dose: null,
    frequency: null,
    timing: null,
    durationDays: null,
    instructions: null,
  },
];

/** The lines as the form holds them now. */
function Values({ form }: { form: ReturnType<typeof useForm<PrescriptionInput>> }) {
  const items = useWatch({ control: form.control, name: "items" });
  return <output aria-label="Values">{JSON.stringify(items)}</output>;
}

/** A prescription form holding `items`, each a MedicineLine, with a submit that checks them. */
function Harness({
  items,
  allergies = [],
  onMove = () => {},
  onRemove = () => {},
}: {
  items: PrescriptionItemInput[];
  allergies?: PatientAlert[];
  onMove?: (to: number) => void;
  onRemove?: () => void;
}) {
  const form = useForm<PrescriptionInput>({
    defaultValues: { items, advice: "", printDiagnosis: false },
    resolver: zodResolver(prescriptionSchema) as unknown as Resolver<PrescriptionInput>,
  });
  return (
    <form noValidate onSubmit={form.handleSubmit(() => {})}>
      {items.map((_, index) => (
        <MedicineLine
          key={index}
          form={form}
          index={index}
          count={items.length}
          doctorId="d-1"
          allergies={allergies}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}
      <button type="submit">Check</button>
      <Values form={form} />
    </form>
  );
}

const line = (n = 1) => screen.getByRole("group", { name: `Medicine ${n}` });
const name = (n = 1) => within(line(n)).getByRole("combobox", { name: "Medicine" });
const chip = (label: string, n = 1) => within(line(n)).getByRole("radio", { name: label });
const values = () => JSON.parse(screen.getByRole("status", { name: "Values" }).textContent!) as PrescriptionItemInput[];
const checked = (n = 1) =>
  within(line(n))
    .queryAllByRole("radio", { checked: true })
    .map((radio) => radio.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  suggest.mockImplementation((typed: string) => ({ data: typed.startsWith("pa") ? FOUND : undefined }));
});

describe("lineInput and EMPTY_LINE", () => {
  it("are a medicine's fields: blank for none, the days as typed", () => {
    expect(lineInput(FOUND[1])).toEqual({
      medicine: "Pantoprazole",
      strength: "40 mg",
      dose: "",
      frequency: "Once a week",
      timing: "EMPTY_STOMACH",
      durationDays: "",
      instructions: "",
    });
    expect(lineInput(FOUND[0]).durationDays).toBe("5");
    expect(Object.values(EMPTY_LINE).every((value) => value === "")).toBe(true);
  });
});

describe("MedicineLine (plan §13; D210 – D217)", () => {
  it("asks for suggestions only while the name is typed, each with how it was taken (D211)", async () => {
    render(<Harness items={[{ ...EMPTY_LINE }]} />);
    expect(suggest).toHaveBeenLastCalledWith("", "d-1");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    await userEvent.type(name(), "zz");
    expect(suggest).toHaveBeenLastCalledWith("zz", "d-1");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    await userEvent.clear(name());
    await userEvent.type(name(), "pa");
    expect(suggest).toHaveBeenLastCalledWith("pa", "d-1");
    const list = screen.getByRole("listbox", { name: "Medicines written before" });
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Paracetamol 500 mg1 tab · 1-0-1 · After food · 5 days",
      "Pantoprazole 40 mgOnce a week · Empty stomach",
      "Paracip",
    ]);

    await userEvent.tab();
    expect(suggest).toHaveBeenLastCalledWith("", "d-1");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("fills the whole line from a suggestion taken, as last written (D211)", async () => {
    render(<Harness items={[{ ...EMPTY_LINE }]} />);
    await userEvent.type(name(), "pa");
    await userEvent.click(screen.getByRole("option", { name: /Paracetamol 500 mg/ }));
    expect(name()).toHaveValue("Paracetamol");
    expect(within(line()).getByRole("textbox", { name: "Strength" })).toHaveValue("500 mg");
    expect(within(line()).getByRole("textbox", { name: "Dose" })).toHaveValue("1 tab");
    expect(within(line()).getByRole("textbox", { name: "Days" })).toHaveValue("5");
    expect(within(line()).getByRole("textbox", { name: "Instructions" })).toHaveValue("Dissolve in water");
    expect(checked()).toEqual(["1-0-1", "After food"]);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(suggest).toHaveBeenLastCalledWith("", "d-1");

    // One with its frequency typed opens Other with it.
    await userEvent.clear(name());
    await userEvent.type(name(), "pa");
    await userEvent.click(screen.getByRole("option", { name: /Pantoprazole 40 mg/ }));
    expect(checked()).toEqual(["Other", "Empty stomach"]);
    expect(within(line()).getByRole("textbox", { name: "Frequency, in words" })).toHaveValue("Once a week");
    expect(values()[0]).toEqual({
      medicine: "Pantoprazole",
      strength: "40 mg",
      dose: "",
      frequency: "Once a week",
      timing: "EMPTY_STOMACH",
      durationDays: "",
      instructions: "",
    });
  });

  it("takes a frequency from its chips, or typed under Other; a chip tapped again is none (D214)", async () => {
    render(<Harness items={[{ ...EMPTY_LINE }]} />);
    expect(checked()).toEqual([]);
    await userEvent.click(chip("1-1-1"));
    expect(values()[0].frequency).toBe("1-1-1");
    expect(checked()).toEqual(["1-1-1"]);
    await userEvent.click(chip("1-1-1"));
    expect(values()[0].frequency).toBe("");
    expect(checked()).toEqual([]);

    // Other, from a chip: the chip's words go, and the field opens empty.
    await userEvent.click(chip("SOS"));
    await userEvent.click(chip("Other"));
    expect(checked()).toEqual(["Other"]);
    const typed = within(line()).getByRole("textbox", { name: "Frequency, in words" });
    expect(typed).toHaveValue("");
    expect(values()[0].frequency).toBe("");
    await userEvent.type(typed, "Once a week");
    // Other again keeps what is typed.
    await userEvent.click(chip("Other"));
    expect(values()[0].frequency).toBe("Once a week");
    expect(checked()).toEqual(["Other"]);

    await userEvent.click(chip("0-0-1"));
    expect(values()[0].frequency).toBe("0-0-1");
    expect(within(line()).queryByRole("textbox", { name: "Frequency, in words" })).not.toBeInTheDocument();
  });

  it("takes a timing from its chips; one tapped again is none", async () => {
    render(<Harness items={[{ ...EMPTY_LINE }]} />);
    await userEvent.click(chip("Bedtime"));
    expect(values()[0].timing).toBe("BEDTIME");
    expect(checked()).toEqual(["Bedtime"]);
    await userEvent.click(chip("Bedtime"));
    expect(values()[0].timing).toBe("");
    expect(checked()).toEqual([]);
  });

  it("reads a line holding no frequency or timing at all as none chosen", () => {
    render(<Harness items={[{ medicine: "Paracetamol" }]} />);
    expect(checked()).toEqual([]);
  });

  it("moves up and down, dimmed at its ends, and is removed", async () => {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    render(<Harness items={[{ ...EMPTY_LINE }, { ...EMPTY_LINE }]} onMove={onMove} onRemove={onRemove} />);
    expect(within(line(1)).getByRole("button", { name: "Move medicine 1 up" })).toBeDisabled();
    expect(within(line(2)).getByRole("button", { name: "Move medicine 2 down" })).toBeDisabled();
    await userEvent.click(within(line(1)).getByRole("button", { name: "Move medicine 1 down" }));
    expect(onMove).toHaveBeenLastCalledWith(1);
    await userEvent.click(within(line(2)).getByRole("button", { name: "Move medicine 2 up" }));
    expect(onMove).toHaveBeenLastCalledWith(0);
    await userEvent.click(within(line(2)).getByRole("button", { name: "Remove medicine 2" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("warns on its line of a medicine naming an allergy, read with the name (D212)", async () => {
    render(<Harness items={[{ ...EMPTY_LINE }]} allergies={[PENICILLIN]} />);
    expect(name()).not.toHaveAttribute("aria-describedby");
    await userEvent.type(name(), "Penicillin V");
    const warning = within(line()).getByText("Allergy: Penicillin");
    expect(name()).toHaveAttribute("aria-describedby", warning.id);
    expect(name()).toHaveAccessibleDescription("Allergy: Penicillin");
  });

  it("shows what is wrong beside each field once checked, and checks again as the line changes", async () => {
    render(<Harness items={[{ ...EMPTY_LINE }]} />);
    await userEvent.type(within(line()).getByRole("textbox", { name: "Days" }), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await within(line()).findByText("Medicine needs a value.")).toBeInTheDocument();
    expect(within(line()).getByText("Days must be a whole number.")).toBeInTheDocument();

    // Taken from a suggestion, the line is checked again at once.
    await userEvent.type(name(), "pa");
    await userEvent.click(screen.getByRole("option", { name: /Paracetamol 500 mg/ }));
    expect(within(line()).queryByText("Medicine needs a value.")).not.toBeInTheDocument();
    expect(within(line()).queryByText("Days must be a whole number.")).not.toBeInTheDocument();
  });
});
