import { describe, expect, it } from "vitest";

import { MAX_LOGO_BYTES } from "@/constants/uploads";
import { checkLogoFile } from "@/features/clinic/upload";

const file = (size: number, type: string) => new File([new Uint8Array(size)], "logo", { type });

describe("checkLogoFile", () => {
  it("lets a PNG, JPG or WebP of up to 500 KB through", () => {
    expect(checkLogoFile(file(MAX_LOGO_BYTES, "image/png"))).toBeNull();
    expect(checkLogoFile(file(10, "image/jpeg"))).toBeNull();
    expect(checkLogoFile(file(10, "image/webp"))).toBeNull();
  });

  it("stops another type, or one over 500 KB, before anything is sent", () => {
    expect(checkLogoFile(file(10, "image/gif"))).toBe("LOGO_TYPE_NOT_ALLOWED");
    expect(checkLogoFile(file(MAX_LOGO_BYTES + 1, "image/png"))).toBe("LOGO_TOO_LARGE");
  });
});
