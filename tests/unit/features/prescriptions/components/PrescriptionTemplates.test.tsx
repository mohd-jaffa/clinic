import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionItem, PrescriptionTemplate } from "@/features/prescriptions/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, client, query } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { add: vi.fn(), change: vi.fn() },
  query: { read: vi.fn(), current: {} as Record<string, unknown> },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/prescriptions/api.client", () => ({ TemplatesClient: client }));
vi.mock("@/features/prescriptions/hooks/useTemplates", () => ({
  useTemplates: (doctorId: string | null) => {
    query.read(doctorId);
    return query.current;
  },
}));

const { PrescriptionTemplates } = await import("@/features/prescriptions/components/PrescriptionTemplates");

const item = (medicine: string): PrescriptionItem => ({
  medicine,
  strength: null,
  dose: null,
  frequency: null,
  timing: null,
  durationDays: null,
  instructions: null,
});
const templates: PrescriptionTemplate[] = [
  { id: "t-1", name: "Cold", advice: null, active: true, items: [item("Cetirizine")] },
  {
    id: "t-2",
    name: "Viral fever",
    advice: "Rest",
    active: true,
    items: [item("Paracetamol"), item("Dolo"), item("ORS")],
  },
  { id: "t-3", name: "Old fever", advice: "Rest", active: false, items: [] },
];

const draw = () =>
  render(
    <Providers>
      <PrescriptionTemplates />
    </Providers>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "DOCTOR" });
  query.current = { data: templates, isLoading: false };
  client.change.mockImplementation(async ({ id, input }: { id: string; input: { active: boolean } }) => ({
    ...templates.find((template) => template.id === id)!,
    active: input.active,
  }));
});

describe("PrescriptionTemplates (D242)", () => {
  it("lists the doctor's own in use, each with its medicines and opening its screen, and leads back to My account", () => {
    draw();
    expect(query.read).toHaveBeenCalledWith("doctor-1");
    expect(screen.getByRole("heading", { level: 1, name: "Prescription templates" })).toBeInTheDocument();
    expect(screen.getByText("2 templates")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/settings/account");
    const list = within(screen.getByRole("list", { name: "Prescription templates" }));
    expect(list.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "ColdCetirizine",
      "Viral feverParacetamol, Dolo +1",
    ]);
    expect(list.getAllByRole("link").map((row) => row.getAttribute("href"))).toEqual([
      "/settings/account/templates/t-1",
      "/settings/account/templates/t-2",
    ]);
    expect(screen.getByRole("link", { name: "New template" })).toHaveAttribute(
      "href",
      "/settings/account/templates/new",
    );
  });

  it("restores an archived one (D80)", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    expect(screen.getByRole("list", { name: "Archived" })).toHaveTextContent("Old feverAdvice only");
    await userEvent.click(screen.getByRole("button", { name: "Restore Old fever" }));
    expect(client.change).toHaveBeenCalledWith({ id: "t-3", input: { active: true } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Old fever restored"));
  });

  it("says when there are none yet, and where one comes from", () => {
    query.current = { data: [{ ...templates[0], active: false }], isLoading: false };
    draw();
    expect(screen.getByText("0 templates")).toBeInTheDocument();
    expect(screen.getByText("No templates yet")).toBeInTheDocument();
    expect(screen.getByText("Start one here, or save a prescription as a template on a visit.")).toBeInTheDocument();
  });

  it("in a view-only clinic, shows them and changes nothing, saying why", async () => {
    auth.current = {
      ...authStub({ role: "DOCTOR" }),
      subscription: { ...authStub().subscription!, state: "READ_ONLY" },
    };
    query.current = { data: [templates[0], templates[2]], isLoading: false };
    draw();
    expect(screen.getByText("1 template")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New template" })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    expect(screen.queryByRole("button", { name: "Restore Old fever" })).not.toBeInTheDocument();
  });

  it("is a doctor's alone", () => {
    const stub = authStub({ role: "STAFF" });
    auth.current = { ...stub, membership: { ...stub.membership!, doctorId: null } };
    draw();
    expect(screen.queryByRole("heading", { name: "Prescription templates" })).not.toBeInTheDocument();
    expect(query.read).toHaveBeenCalledWith(null);
  });

  it("says why when they cannot load", () => {
    query.current = { isLoading: false, error: new Error("down") };
    draw();
    expect(screen.getByText("The templates couldn't be loaded.")).toBeInTheDocument();
  });
});
