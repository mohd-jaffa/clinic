import { describe, expect, it } from "vitest";

const { GET } = await import("@/app/settings/plan/receipts/[id]/route");

describe("GET /settings/plan/receipts/sp-1 (D394)", () => {
  it("sends the signed-in owner on to the receipt itself", async () => {
    const answer = await GET(new Request("https://clinicdesk.test/settings/plan/receipts/sp-1"), {
      params: Promise.resolve({ id: "sp-1" }),
    });
    expect(answer.status).toBe(303);
    expect(answer.headers.get("location")).toBe("https://clinicdesk.test/api/subscription/payments/sp-1/receipt.pdf");
  });
});
