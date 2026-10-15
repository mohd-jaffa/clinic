import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UI_TEXT } from "@/constants/messages";

const { download, send, state } = vi.hoisted(() => ({
  download: vi.fn(),
  send: vi.fn(),
  state: { downloading: false, sending: false },
}));
vi.mock("@/features/documents/hooks/usePrescriptionDownload", () => ({
  usePrescriptionDownload: () => ({ download, downloading: state.downloading }),
}));
vi.mock("@/features/documents/hooks/usePrescriptionSend", () => ({
  usePrescriptionSend: () => ({ send, sending: state.sending }),
}));

const { PrescriptionPdf } = await import("@/features/documents/components/PrescriptionPdf");

const { prescription: words } = UI_TEXT;
const draw = () =>
  render(
    <PrescriptionPdf visitId="v-1" patient="Rohan Mehta" phone="+919876543210" day="2026-10-14" doctor="Maya Rao" />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  state.downloading = false;
  state.sending = false;
});

describe("PrescriptionPdf (D221, D222, D244)", () => {
  it("prints by opening the PDF itself beside the app — a plain link the router never fetches ahead", () => {
    draw();
    const print = screen.getByRole("link", { name: words.printOf("Rohan Mehta") });
    expect(print).toHaveAttribute("href", "/api/visits/v-1/prescription.pdf");
    expect(print).toHaveAttribute("target", "_blank");
    expect(print).toHaveAttribute("rel", "noopener noreferrer");
    expect(print).toHaveTextContent(words.print);
  });

  it("downloads it", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: words.downloadOf("Rohan Mehta") }));
    expect(download).toHaveBeenCalledOnce();
  });

  it("is busy while it downloads", () => {
    state.downloading = true;
    draw();
    expect(screen.getByRole("button", { name: words.downloadOf("Rohan Mehta") })).toHaveAttribute("aria-busy", "true");
  });

  it("sends it on WhatsApp, busy while it does (D244)", async () => {
    draw();
    const whatsApp = screen.getByRole("button", { name: words.whatsAppOf("Rohan Mehta") });
    expect(whatsApp).toHaveTextContent(words.whatsApp);
    await userEvent.click(whatsApp);
    expect(send).toHaveBeenCalledOnce();
    state.sending = true;
    draw();
    expect(screen.getAllByRole("button", { name: words.whatsAppOf("Rohan Mehta") })[1]).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
