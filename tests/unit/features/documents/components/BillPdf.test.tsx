import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UI_TEXT } from "@/constants/messages";

const { download, send, state } = vi.hoisted(() => ({
  download: vi.fn(),
  send: vi.fn(),
  state: { downloading: false, sending: false },
}));
vi.mock("@/features/documents/hooks/useBillDownload", () => ({
  useBillDownload: () => ({ download, downloading: state.downloading }),
}));
vi.mock("@/features/documents/hooks/useBillSend", () => ({
  useBillSend: () => ({ send, sending: state.sending }),
}));

const { BillPdf } = await import("@/features/documents/components/BillPdf");

const { bill: words } = UI_TEXT;
const draw = () => render(<BillPdf billId="b-1" patient="Rohan Mehta" number="2026-27/0042" />);

beforeEach(() => {
  vi.clearAllMocks();
  state.downloading = false;
  state.sending = false;
});

describe("BillPdf (plan §15.5; D314)", () => {
  it("prints by opening the PDF itself beside the app — a plain link the router never fetches ahead", () => {
    draw();
    const print = screen.getByRole("link", { name: words.printOf("2026-27/0042") });
    expect(print).toHaveAttribute("href", "/api/bills/b-1/bill.pdf");
    expect(print).toHaveAttribute("target", "_blank");
    expect(print).toHaveTextContent(words.print);
  });

  it("downloads it, busy while it does", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: words.downloadOf("2026-27/0042") }));
    expect(download).toHaveBeenCalled();
    state.downloading = true;
    draw();
    expect(screen.getAllByRole("button", { name: words.downloadOf("2026-27/0042") }).at(-1)).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("sends a live bill on WhatsApp, busy while it does — and offers none for a void one (D327, D341)", async () => {
    const sent = {
      billId: "b-1",
      number: "2026-27/0042",
      day: "2026-10-16",
      patient: "Rohan Mehta",
      phone: "+919876543210",
      totalPaise: 150_000,
      duePaise: 100_000,
    };
    const { unmount } = render(<BillPdf billId="b-1" patient="Rohan Mehta" number="2026-27/0042" sent={sent} />);
    await userEvent.click(screen.getByRole("button", { name: words.whatsAppOf("2026-27/0042") }));
    expect(send).toHaveBeenCalledWith(sent);
    unmount();
    state.sending = true;
    const { unmount: again } = render(<BillPdf billId="b-1" patient="Rohan Mehta" number="2026-27/0042" sent={sent} />);
    expect(screen.getByRole("button", { name: words.whatsAppOf("2026-27/0042") })).toHaveAttribute("aria-busy", "true");
    again();
    draw();
    expect(screen.queryByRole("button", { name: words.whatsAppOf("2026-27/0042") })).not.toBeInTheDocument();
  });
});
