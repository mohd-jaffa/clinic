import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { Row, RowList, RowToken } from "@/components/ui/row";

describe("RowList", () => {
  it("is a list, named when it says so", () => {
    render(
      <RowList label="Waiting">
        <Row title="Priya Iyer" />
      </RowList>,
    );
    expect(screen.getByRole("list", { name: "Waiting" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Priya Iyer");
  });
});

describe("RowToken", () => {
  it("is a token in display numerals, read with what it is", () => {
    render(<RowToken value="08" label="Token" />);
    expect(screen.getByText("08")).toHaveTextContent("Token 08");
  });

  it("may be a bare numeral", () => {
    render(<RowToken value="10:45" />);
    expect(screen.getByText("10:45")).toHaveTextContent(/^10:45$/);
  });
});

describe("Row", () => {
  it("opens where it leads from the whole row, with a chevron when nothing else is at its end", () => {
    render(
      <ul>
        <Row title="Priya Iyer" subtitle="P-0118" href="/patients/1" leading={<RowToken value="08" />} />
      </ul>,
    );
    const link = screen.getByRole("link", { name: "Priya Iyer" });
    expect(link).toHaveAttribute("href", "/patients/1");
    expect(link).toHaveClass("after:absolute");
    expect(screen.getByRole("listitem").querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("P-0118")).toBeInTheDocument();
  });

  it("is a button when it opens something in place", async () => {
    const onClick = vi.fn();
    render(
      <ul>
        <Row title="Rohan Mehta" onClick={onClick} />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rohan Mehta" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("carries its own action above its target, and then no chevron", async () => {
    const sendIn = vi.fn();
    render(
      <ul>
        <Row title="Abdul Rahman" href="/patients/2" trailing={<Button label="Send in" size="sm" onClick={sendIn} />} />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Send in" }));
    expect(sendIn).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Send in" }).parentElement).toHaveClass("relative", "z-[1]");
    expect(screen.getByRole("listitem").querySelectorAll(":scope > svg")).toHaveLength(0);
  });

  it("is a quiet outline when it is not yet in play, and plain when it goes nowhere", () => {
    render(
      <ul>
        <Row title="Ananya Das" quiet />
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveClass("ring-line");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
