import { describe, expect, it } from "vitest";

import { fileName, pdfResponse } from "@/lib/pdf/response";

const PDF = Buffer.from("%PDF-1.3 a prescription");

describe("pdfResponse (plan §33, D221)", () => {
  it("answers with the file to open in the browser's viewer, named, kept by nothing", async () => {
    const answer = pdfResponse(PDF, {
      name: "Rohan Mehta - 14 Oct 2026 - Prescription.pdf",
      download: false,
      requestId: "req_1",
    });
    expect(answer.status).toBe(200);
    expect(Object.fromEntries(answer.headers)).toEqual({
      "content-type": "application/pdf",
      "content-disposition":
        "inline; filename=\"Rohan Mehta - 14 Oct 2026 - Prescription.pdf\"; filename*=UTF-8''Rohan%20Mehta%20-%2014%20Oct%202026%20-%20Prescription.pdf",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": "req_1",
    });
    expect(Buffer.from(await answer.arrayBuffer()).toString()).toBe("%PDF-1.3 a prescription");
  });

  it("is saved when downloaded, under a plain name for an old client and the name itself for the rest", () => {
    const answer = pdfResponse(PDF, { name: 'Rohan’s "Rx" \\ Ré.pdf', download: true, requestId: "req_2" });
    expect(answer.headers.get("content-disposition")).toBe(
      `attachment; filename="Rohan_s _Rx_ _ R_.pdf"; filename*=UTF-8''${encodeURIComponent('Rohan’s "Rx" \\ Ré.pdf')}`,
    );
  });
});

describe("fileName (D223)", () => {
  it("leaves out what a file system refuses, and the spaces it leaves", () => {
    expect(fileName('Rohan/Mehta: "Rx" *?<>| - 14 Oct.pdf')).toBe("Rohan Mehta Rx - 14 Oct.pdf");
    expect(fileName("  Rohan Mehta - 14 Oct 2026 - Prescription.pdf ")).toBe(
      "Rohan Mehta - 14 Oct 2026 - Prescription.pdf",
    );
  });
});
