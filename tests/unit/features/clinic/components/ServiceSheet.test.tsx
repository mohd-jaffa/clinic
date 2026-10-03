import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Service } from "@/features/clinic/types";
import { ApiError } from "@/lib/api/client";
import { aService } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn() } }));
vi.mock("@/features/clinic/api.client", () => ({ ServicesClient: client }));

const { ServiceSheet } = await import("@/features/clinic/components/ServiceSheet");

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  client.add.mockImplementation(async ({ name }: { name: string }) => aService({ id: "s-5", name }));
  client.change.mockImplementation(
    async ({ id, details, active }: { id: string; details?: object; active?: boolean }) =>
      aService({ id, ...details, ...(active !== undefined && { active }) }),
  );
});

/** The sheet as a screen holds it: open until it closes itself. */
function Harness({ service }: { service: Service | null }) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return <ServiceSheet open={open} onClose={close} service={service} />;
}

const draw = (service: Service | null) =>
  render(
    <Providers>
      <Harness service={service} />
    </Providers>,
  );

const field = (name: RegExp) => within(screen.getByRole("dialog")).getByRole("textbox", { name });

describe("ServiceSheet (plan §9)", () => {
  it("adds a service: its name, its category and its price in rupees", async () => {
    draw(null);
    const sheet = screen.getByRole("dialog", { name: "Add a service" });
    expect(within(sheet).queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();

    await userEvent.type(field(/^Service name/), "Root canal");
    await userEvent.click(within(sheet).getByRole("combobox", { name: /^Category/ }));
    await userEvent.click(screen.getByRole("option", { name: "Procedure" }));
    await userEvent.type(field(/^Price/), "4,500");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(client.add).toHaveBeenCalledWith({ name: "Root canal", category: "PROCEDURE", price: "4,500" }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Root canal added to the price list");
    // Left empty for the next.
    expect(screen.getByRole("textbox", { name: /^Service name/, hidden: true })).toHaveValue("");
  });

  it("says what is missing, beside each field, and sends nothing", async () => {
    draw(null);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Service name needs a value.")).toBeInTheDocument();
    expect(screen.getByText("Choose category.")).toBeInTheDocument();
    expect(screen.getByText("Price needs a value.")).toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();
  });

  it("changes a service, starting from what it is", async () => {
    draw(aService({ pricePaise: 80050 }));
    expect(field(/^Price/)).toHaveValue("800.50");
    await userEvent.clear(field(/^Price/));
    await userEvent.type(field(/^Price/), "900");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(client.change).toHaveBeenCalledWith({
        id: "s-1",
        details: { name: "Scaling and polishing", category: "PROCEDURE", price: "900" },
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Scaling and polishing saved");
  });

  it("says when another service has the name, and stays open to put it right", async () => {
    client.add.mockRejectedValue(
      new ApiError(409, "SERVICE_ALREADY_EXISTS", "Another service on the price list already has this name."),
    );
    draw(null);
    await userEvent.type(field(/^Service name/), "Scaling");
    await userEvent.click(screen.getByRole("combobox", { name: /^Category/ }));
    await userEvent.click(screen.getByRole("option", { name: "Procedure" }));
    await userEvent.type(field(/^Price/), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alertdialog", { name: "The service wasn’t saved" })).toHaveTextContent(
      "Another service on the price list already has this name.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("archives the service once asked, then closes (D80)", async () => {
    draw(aService());
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    const ask = screen.getByRole("alertdialog", { name: "Archive Scaling and polishing?" });
    expect(ask).toHaveTextContent("New bills won’t offer it.");
    await userEvent.click(within(ask).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.change).toHaveBeenCalledWith({ id: "s-1", active: false });
  });
});
