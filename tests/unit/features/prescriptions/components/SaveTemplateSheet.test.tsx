import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn() } }));
vi.mock("@/features/prescriptions/api.client", () => ({ TemplatesClient: client }));

const { SaveTemplateSheet } = await import("@/features/prescriptions/components/SaveTemplateSheet");

const onClose = vi.fn();
const content = () => ({ items: [], advice: "Rest" });
const view = (open: boolean) => (
  <Providers>
    <SaveTemplateSheet open={open} onClose={onClose} content={content} />
  </Providers>
);
const name = () => within(screen.getByRole("dialog")).getByRole("textbox", { name: /Template name/ });
const submit = () => within(screen.getByRole("dialog")).getByRole("button", { name: "Save as template" });

beforeEach(() => vi.clearAllMocks());

describe("SaveTemplateSheet (D243)", () => {
  it("needs a name, and says what it saves", async () => {
    render(view(true));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Like “Viral fever” or “Post-extraction”. It saves the medicines and advice on the screen.",
    );
    await userEvent.click(submit());
    expect(await screen.findByText("Template name needs a value.")).toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();
  });

  it("saves the name with what is on the screen, closes, and starts blank next time", async () => {
    client.add.mockResolvedValue({ id: "t-1", name: "Cold", advice: "Rest", active: true, items: [] });
    const { rerender } = render(view(true));
    await userEvent.type(name(), "Cold");
    await userEvent.click(submit());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.add).toHaveBeenCalledWith({ template: { name: "Cold", items: [], advice: "Rest" } });
    rerender(view(false));
    rerender(view(true));
    expect(name()).toHaveValue("");
  });
});
