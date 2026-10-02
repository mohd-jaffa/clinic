import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, useTheme } from "@/lib/theme/ThemeProvider";
import { CHOSEN_THEME_COLOR, THEME_COLORS, THEME_STORAGE_KEY } from "@/lib/theme/themes";

function Probe() {
  const { preference, setPreference } = useTheme();
  return (
    <div>
      <p>Theme: {preference}</p>
      <button type="button" onClick={() => setPreference("dark")}>
        Dark
      </button>
      <button type="button" onClick={() => setPreference("light")}>
        Light
      </button>
      <button type="button" onClick={() => setPreference("system")}>
        System
      </button>
    </div>
  );
}

function setUp() {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLORS.light}">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLORS.dark}">`;
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

/** Each toolbar colour in order: "chosen" or its media, and its colour. */
const toolbars = () =>
  [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => [
    meta.hasAttribute(CHOSEN_THEME_COLOR) ? "chosen" : meta.getAttribute("media"),
    meta.getAttribute("content"),
  ]);

const DEVICE = [
  ["(prefers-color-scheme: light)", THEME_COLORS.light],
  ["(prefers-color-scheme: dark)", THEME_COLORS.dark],
];

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = "";
  vi.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("starts from the attribute the boot script set, System when there is none", () => {
    setUp();
    expect(screen.getByText("Theme: system")).toBeInTheDocument();
  });

  it("draws System on the server, which cannot know the device's choice", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const html = renderToString(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(html).toContain("system");
  });

  it("reads a choice already applied before the first paint", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    setUp();
    expect(screen.getByText("Theme: dark")).toBeInTheDocument();
  });

  it("applies a choice to the page and the toolbars, and keeps it on this device", async () => {
    setUp();
    await userEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(screen.getByText("Theme: dark")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(toolbars()).toEqual([["chosen", THEME_COLORS.dark], ...DEVICE]);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(toolbars()).toEqual([["chosen", THEME_COLORS.light], ...DEVICE]);
  });

  it("hands the choice back to the device on System, forgetting the stored one", async () => {
    setUp();
    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    await userEvent.click(screen.getByRole("button", { name: "System" }));

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(toolbars()).toEqual(DEVICE);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("still switches when the choice cannot be remembered", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setUp();
    await act(() => userEvent.click(screen.getByRole("button", { name: "Dark" })));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("useTheme", () => {
  it("refuses to work outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow("useTheme must be used within a ThemeProvider");
  });
});
