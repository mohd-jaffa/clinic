import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { getFile, saveFile } = vi.hoisted(() => ({ getFile: vi.fn(), saveFile: vi.fn() }));
vi.mock("@/lib/api/client", async (actual) => ({ ...(await actual()), getFile }));
vi.mock("@/lib/download", () => ({ saveFile }));

const { useBillDownload } = await import("@/features/documents/hooks/useBillDownload");

const { bill: words } = UI_TEXT;
const NAME = "Rohan Mehta - Bill 2026-27-0042.pdf";

function Download() {
  const { download, downloading } = useBillDownload({ billId: "b-1", patient: "Rohan Mehta", number: "2026-27/0042" });
  return (
    <button type="button" aria-busy={downloading} onClick={() => void download()}>
      Download
    </button>
  );
}

/** A notice is shown, and announced: its words are found twice. */
const notice = async (text: string) => (await screen.findAllByText(text))[0];

beforeEach(() => vi.clearAllMocks());

describe("useBillDownload (plan §15.5)", () => {
  it("asks for the PDF to save, saves it under its name, and says so", async () => {
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    getFile.mockResolvedValue(pdf);
    render(<Download />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(getFile).toHaveBeenCalledWith("/api/bills/b-1/bill.pdf?download=1");
    expect(saveFile).toHaveBeenCalledWith(pdf, NAME);
    expect(await notice(words.downloaded)).toBeInTheDocument();
    expect(await notice(words.savedAs(NAME))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toHaveAttribute("aria-busy", "false");
  });

  it("says why when it cannot, in the API's words or its own, and saves nothing", async () => {
    getFile.mockRejectedValue(new ApiError(404, "RECORD_NOT_FOUND", ERROR_MESSAGES.RECORD_NOT_FOUND, "req_1"));
    render(<Download />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(await screen.findByRole("alertdialog", { name: words.notDownloaded })).toHaveTextContent(
      ERROR_MESSAGES.RECORD_NOT_FOUND,
    );
    expect(saveFile).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: UI_TEXT.actions.close }));
    getFile.mockRejectedValue(new Error("boom"));
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(await screen.findByRole("alertdialog", { name: words.notDownloaded })).toHaveTextContent(
      ERROR_MESSAGES.BILL_PDF_FAILED,
    );
  });
});
