import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/fonts", () => ({ figtree: { variable: "font-figtree-variable" } }));

const { default: GlobalError } = await import("@/app/global-error");

describe("the global error screen", () => {
  it("brings its own document — its title, the face, the person's theme — says what failed, and only tries again", () => {
    const error = Object.assign(new Error("layout failed"), { digest: "2718281828" });
    const html = renderToStaticMarkup(<GlobalError error={error} retry={vi.fn()} />);

    expect(html).toMatch(/^<html lang="en" class="font-figtree-variable/);
    expect(html).toContain("<title>Something went wrong · ClinicDesk</title>");
    expect(html).toContain("localStorage.getItem");
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Reference: 2718281828");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Go to Home");
    expect(html).not.toContain("layout failed");
  });
});
