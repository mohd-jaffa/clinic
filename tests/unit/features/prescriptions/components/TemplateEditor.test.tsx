import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionItem, PrescriptionTemplate } from "@/features/prescriptions/types";
import { ApiError } from "@/lib/api/client";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, client, query, router, refresh } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { add: vi.fn(), change: vi.fn() },
  query: { read: vi.fn(), current: {} as Record<string, unknown> },
  router: { push: vi.fn() },
  refresh: vi.fn(),
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/prescriptions/api.client", () => ({ TemplatesClient: client }));
vi.mock("@/features/prescriptions/hooks/useTemplates", () => ({
  useTemplates: (doctorId: string | null) => {
    query.read(doctorId);
    return query.current;
  },
}));
// The suggestions are the line's to test: here, none are ever found.
vi.mock("@/features/prescriptions/hooks/useMedicineSuggestions", () => ({
  useMedicineSuggestions: () => ({ data: undefined }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { TemplateEditor } = await import("@/features/prescriptions/components/TemplateEditor");

const item = (medicine: string): PrescriptionItem => ({
  medicine,
  strength: "10 mg",
  dose: null,
  frequency: null,
  timing: null,
  durationDays: null,
  instructions: null,
});
const cold: PrescriptionTemplate = {
  id: "t-1",
  name: "Cold",
  advice: "Steam",
  active: true,
  items: [item("Cetirizine"), item("Montelukast")],
};

const draw = (id: string | null) =>
  render(
    <Providers>
      <TemplateEditor id={id} />
    </Providers>,
  );
const field = (name: RegExp | string) => screen.getByRole("textbox", { name });
const medicine = (n: number) =>
  within(screen.getByRole("group", { name: `Medicine ${n}` })).getByRole("combobox", { name: "Medicine" });
const save = () => screen.getByRole("button", { name: "Save" });

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "DOCTOR" });
  query.current = { data: [cold], isLoading: false };
  refresh.mockResolvedValue(undefined);
});

describe("TemplateEditor for a new template (D242, D243)", () => {
  it("starts blank, asks for a name and a medicine or advice, and reads nothing", async () => {
    draw(null);
    expect(query.read).toHaveBeenCalledWith(null);
    expect(screen.getByRole("heading", { level: 1, name: "New template" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/settings/account/templates");
    expect(screen.queryByRole("group", { name: "Medicine 1" })).not.toBeInTheDocument();
    await userEvent.click(save());
    expect(await screen.findByText("Template name needs a value.")).toBeInTheDocument();
    await userEvent.type(field(/Template name/), "Empty");
    await userEvent.click(save());
    expect(await screen.findByText("Add a medicine or advice to it first.")).toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();
  });

  it("saves the name, medicines and advice as the doctor's own, then goes back to the list", async () => {
    client.add.mockResolvedValue({ ...cold, id: "t-9", name: "Allergy", items: [item("Cetirizine")] });
    draw(null);
    await userEvent.type(field(/Template name/), "Allergy");
    await userEvent.click(screen.getByRole("button", { name: "Add medicine" }));
    expect(medicine(1)).toHaveFocus();
    await userEvent.type(medicine(1), "Cetirizine");
    await userEvent.type(field("Advice"), "Avoid dust");
    await userEvent.click(save());
    await waitFor(() =>
      expect(client.add).toHaveBeenCalledWith({
        template: {
          name: "Allergy",
          items: [expect.objectContaining({ medicine: "Cetirizine", strength: "" })],
          advice: "Avoid dust",
        },
      }),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings/account/templates"));
    expect((await screen.findAllByText("Saved as the template “Allergy”"))[0]).toBeInTheDocument();
  });
});

describe("TemplateEditor for one of the doctor's templates (D242)", () => {
  it("holds it in its fields, saves it changed, says so and goes back to the list", async () => {
    client.change.mockResolvedValue({ ...cold, name: "Common cold" });
    draw("t-1");
    expect(query.read).toHaveBeenCalledWith("doctor-1");
    expect(screen.getByRole("heading", { level: 1, name: "Cold" })).toBeInTheDocument();
    expect(field(/Template name/)).toHaveValue("Cold");
    expect(medicine(2)).toHaveValue("Montelukast");
    expect(field("Advice")).toHaveValue("Steam");
    await userEvent.clear(field(/Template name/));
    await userEvent.type(field(/Template name/), "Common cold");
    await userEvent.click(save());
    await waitFor(() =>
      expect(client.change).toHaveBeenCalledWith({
        id: "t-1",
        input: {
          template: {
            name: "Common cold",
            items: [
              expect.objectContaining({ medicine: "Cetirizine", strength: "10 mg" }),
              expect.objectContaining({ medicine: "Montelukast" }),
            ],
            advice: "Steam",
          },
        },
      }),
    );
    expect((await screen.findAllByText("Common cold saved"))[0]).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith("/settings/account/templates");
  });

  it("moves and removes a medicine", async () => {
    draw("t-1");
    await userEvent.click(screen.getByRole("button", { name: "Move medicine 2 up" }));
    expect(medicine(1)).toHaveValue("Montelukast");
    await userEvent.click(screen.getByRole("button", { name: "Remove medicine 1" }));
    expect(medicine(1)).toHaveValue("Cetirizine");
    expect(screen.queryByRole("group", { name: "Medicine 2" })).not.toBeInTheDocument();
  });

  it("says why a change was refused, and stays", async () => {
    client.change.mockRejectedValue(new ApiError(409, "TEMPLATE_NAME_TAKEN", "Taken"));
    draw("t-1");
    await userEvent.click(save());
    expect(await screen.findByRole("alertdialog", { name: "The template wasn’t changed" })).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("archives it once asked, then goes back to the list", async () => {
    client.change.mockResolvedValue({ ...cold, active: false });
    draw("t-1");
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    const ask = await screen.findByRole("alertdialog", { name: "Archive “Cold”?" });
    expect(ask).toHaveTextContent("It’s no longer offered on prescriptions. Show archived brings it back.");
    await userEvent.click(within(ask).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(client.change).toHaveBeenCalledWith({ id: "t-1", input: { active: false } }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings/account/templates"));
  });

  it("says an archived one is archived, and offers no Archive", () => {
    query.current = { data: [{ ...cold, active: false }], isLoading: false };
    draw("t-1");
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("offers no more medicines than a template holds", () => {
    query.current = { data: [{ ...cold, items: Array.from({ length: 30 }, () => item("Dolo")) }], isLoading: false };
    draw("t-1");
    expect(screen.queryByRole("button", { name: "Add medicine" })).not.toBeInTheDocument();
  });

  it("in a view-only clinic, shows it and changes nothing, saying why", () => {
    auth.current = {
      ...authStub({ role: "DOCTOR" }),
      subscription: { ...authStub().subscription!, state: "READ_ONLY" },
    };
    draw("t-1");
    expect(field(/Template name/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
  });
});

describe("TemplateEditor without a template to show", () => {
  it("says one not among the doctor's is not found", () => {
    draw("t-404");
    expect(screen.getByRole("heading", { level: 1, name: "Prescription templates" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("That record could not be found. Refresh and try again.");
  });

  it("stands rows in while they load, and says why they could not", () => {
    query.current = { isLoading: true };
    const { unmount } = draw("t-1");
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
    unmount();

    query.current = { isLoading: false, error: new Error("down") };
    draw("t-1");
    expect(screen.getByText("The templates couldn't be loaded.")).toBeInTheDocument();
  });

  it("is a doctor's alone", () => {
    const stub = authStub({ role: "STAFF" });
    auth.current = { ...stub, membership: { ...stub.membership!, doctorId: null } };
    draw(null);
    expect(screen.getByText("This screen isn’t open to you")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
