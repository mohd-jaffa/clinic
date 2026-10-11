import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { params } = vi.hoisted(() => ({ params: { current: new URLSearchParams() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/patients",
  useSearchParams: () => params.current,
}));

const { useAddForm } = await import("@/hooks/useAddForm");

const history = {
  pushState: vi.spyOn(window.history, "pushState").mockImplementation(() => {}),
  replaceState: vi.spyOn(window.history, "replaceState").mockImplementation(() => {}),
  back: vi.spyOn(window.history, "back").mockImplementation(() => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
  params.current = new URLSearchParams();
});
afterEach(() => vi.clearAllMocks());

describe("useAddForm (D67)", () => {
  it("is open while the address names its form, and only its own", () => {
    expect(renderHook(() => useAddForm("patient")).result.current.open).toBe(false);
    params.current = new URLSearchParams("add=patient");
    expect(renderHook(() => useAddForm("patient")).result.current.open).toBe(true);
    expect(renderHook(() => useAddForm("expense")).result.current.open).toBe(false);
  });

  it("opens by putting it in the address, so Back closes it, and closing it steps back — asking the server nothing", () => {
    const { result } = renderHook(() => useAddForm("patient"));
    result.current.show();
    expect(history.pushState).toHaveBeenCalledWith(null, "", "/patients?add=patient");
    result.current.close();
    expect(history.back).toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it("takes the mark off in place when the form arrived open — from the ＋", () => {
    params.current = new URLSearchParams("add=patient");
    const { result } = renderHook(() => useAddForm("patient"));
    result.current.close();
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/patients");
    expect(history.back).not.toHaveBeenCalled();
  });
});
