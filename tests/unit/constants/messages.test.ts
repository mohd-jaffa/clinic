import { describe, expect, it } from "vitest";

import { UI_TEXT } from "@/constants/messages";

describe("the app's words", () => {
  it("names the app through one constant (plan D35)", () => {
    expect(UI_TEXT.appName).toBe("ClinicDesk");
    expect(UI_TEXT.appDescription).toBeTruthy();
  });
});
