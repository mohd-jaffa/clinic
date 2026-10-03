import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router, params } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  params: { current: new URLSearchParams() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/patients",
  useSearchParams: () => params.current,
}));

const { useAddForm } = await import("@/hooks/useAddForm");

beforeEach(() => {
  vi.clearAllMocks();
  params.current = new URLSearchParams();
});

describe("useAddForm (D67)", () => {
  it("is open while the address names its form, and only its own", () => {
    expect(renderHook(() => useAddForm("patient")).result.current.open).toBe(false);
    params.current = new URLSearchParams("add=patient");
    expect(renderHook(() => useAddForm("patient")).result.current.open).toBe(true);
    expect(renderHook(() => useAddForm("expense")).result.current.open).toBe(false);
  });

  it("opens by putting it in the address, so Back closes it, and closing it steps back", () => {
    const { result } = renderHook(() => useAddForm("patient"));
    result.current.show();
    expect(router.push).toHaveBeenCalledWith("/patients?add=patient", { scroll: false });
    result.current.close();
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("takes the mark off in place when the form arrived open — from the ＋", () => {
    params.current = new URLSearchParams("add=patient");
    const { result } = renderHook(() => useAddForm("patient"));
    result.current.close();
    expect(router.replace).toHaveBeenCalledWith("/patients", { scroll: false });
    expect(router.back).not.toHaveBeenCalled();
  });
});
