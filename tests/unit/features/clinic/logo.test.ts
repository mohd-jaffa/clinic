// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  isLogoMimeType,
  logoFolder,
  logoPath,
  logoResponse,
  logoUrl,
  logoVersion,
  sniffLogoType,
} from "@/features/clinic/logo";

const bytes = (...values: number[]) => new Uint8Array(values);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);

describe("sniffLogoType (AGENTS.md §20)", () => {
  it("knows a PNG, a JPEG and a WebP by their first bytes", () => {
    expect(sniffLogoType(PNG)).toBe("image/png");
    expect(sniffLogoType(JPEG)).toBe("image/jpeg");
    expect(sniffLogoType(WEBP)).toBe("image/webp");
  });

  it("is not fooled by a name: anything else, or too little, is no logo", () => {
    expect(sniffLogoType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(sniffLogoType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20))).toBeNull();
    expect(sniffLogoType(bytes(0x89, 0x50))).toBeNull();
  });
});

describe("isLogoMimeType", () => {
  it("knows the three types a logo may be", () => {
    expect(isLogoMimeType("image/webp")).toBe(true);
    expect(isLogoMimeType("image/gif")).toBe(false);
  });
});

describe("where a logo lives", () => {
  const id = "0b6f5a4e-0c2e-4d8b-9f37-1c2d3e4f5a6b";

  it("is in the clinic's own folder, its id its version", () => {
    expect(logoFolder("clinic-1")).toBe("clinics/clinic-1/logo");
    expect(logoPath("clinic-1", id)).toBe(`clinics/clinic-1/logo/${id}`);
    expect(logoVersion(logoPath("clinic-1", id))).toBe(id);
  });

  it("is read at an address naming its version, and there is none without one", () => {
    expect(logoUrl(logoPath("clinic-1", id))).toBe(`/api/clinic/logo?v=${id}`);
    expect(logoUrl(null)).toBeNull();
  });
});

describe("logoResponse", () => {
  it("answers as the image only, never kept, running nothing in it", async () => {
    const answer = logoResponse(new Blob([PNG]), { type: "image/png", requestId: "req_1" });
    expect(answer.headers.get("Content-Type")).toBe("image/png");
    expect(answer.headers.get("Cache-Control")).toBe("no-store");
    expect(answer.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(answer.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
    expect(answer.headers.get("x-request-id")).toBe("req_1");
    expect(new Uint8Array(await answer.arrayBuffer())).toEqual(PNG);
  });
});
