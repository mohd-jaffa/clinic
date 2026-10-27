import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { Providers } from "@tests/support/providers";

const { getFile, saveFile } = vi.hoisted(() => ({ getFile: vi.fn(), saveFile: vi.fn() }));
vi.mock("@/lib/api/client", async (actual) => ({ ...(await actual()), getFile }));
vi.mock("@/lib/download", () => ({ saveFile }));

const { useCollectionsDownload } = await import("@/features/documents/hooks/useCollectionsDownload");

const { reports: words } = UI_TEXT;
const NAME = "Collections - 27 Oct 2026.pdf";

function Download() {
  const { download, downloading } = useCollectionsDownload("2026-10-27");
  return (
    <button type="button" aria-busy={downloading} onClick={() => void download()}>
      Download
    </button>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("useCollectionsDownload (plan §18; D359)", () => {
  it("asks for the day's PDF to save, saves it under its name, and says so", async () => {
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    getFile.mockResolvedValue(pdf);
    render(<Download />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(getFile).toHaveBeenCalledWith("/api/reports/daily/collections.pdf?day=2026-10-27&download=1");
    expect(saveFile).toHaveBeenCalledWith(pdf, NAME);
    expect((await screen.findAllByText(words.savedAs(NAME)))[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toHaveAttribute("aria-busy", "false");
  });

  it("says why when it cannot, and saves nothing", async () => {
    getFile.mockRejectedValue(new Error("boom"));
    render(<Download />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(await screen.findByRole("alertdialog", { name: words.notDownloaded })).toHaveTextContent(
      ERROR_MESSAGES.COLLECTIONS_PDF_FAILED,
    );
    expect(saveFile).not.toHaveBeenCalled();
  });
});
