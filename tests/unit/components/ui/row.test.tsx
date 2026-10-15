import { render, screen, within } from "@testing-library/react";
import { Trash2, Wallet } from "lucide-react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { Row, RowIcon, RowList, RowToken } from "@/components/ui/row";

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

  it("keeps its rows apart, or, as a menu, one list parted by hairlines (D75)", () => {
    const { rerender } = render(
      <RowList>
        <Row title="Priya Iyer" />
      </RowList>,
    );
    expect(screen.getByRole("list")).toHaveClass("gap-2.5");
    rerender(
      <RowList look="menu">
        <Row look="menu" title="Price list" />
      </RowList>,
    );
    expect(screen.getByRole("list")).toHaveClass("divide-y", "divide-line");
    expect(screen.getByRole("listitem")).not.toHaveClass("bg-surface");
  });
});

describe("RowIcon", () => {
  it("draws a menu row's icon bare, out of the screen reader's way: the row's title says what it is", () => {
    const { container } = render(<RowIcon icon={Wallet} />);
    const icon = container.firstElementChild!;
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon.querySelector("svg")).toBeInTheDocument();
    expect(icon).toHaveClass("text-ink");
  });

  it("is coral for a row whose screen holds what cannot be undone", () => {
    const { container } = render(<RowIcon icon={Trash2} tone="attention" />);
    expect(container.firstElementChild).toHaveClass("text-coral");
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

  // That a tap on the value opens the row is the stretched target's work, shown in the browser (tests/e2e/catalogues.spec.ts).
  it("reads a value at its end, still under its target, its chevron after it", () => {
    render(
      <ul>
        <Row look="menu" title="Root canal" detail="₹4,500" onClick={vi.fn()} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Root canal₹4,500");
    expect(screen.getByText("₹4,500")).not.toHaveClass("relative");
    expect(row.querySelector("svg")).toBeInTheDocument();
  });

  it("carries a line for each of several notes, and none for one that is empty", () => {
    render(
      <RowList>
        <Row
          title="14 Oct · Visit"
          subtitle="Maya Rao"
          note={["Rx Paracetamol", false, "Tx Root canal"]}
          href="/visits/1"
        />
      </RowList>,
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("14 Oct · VisitMaya RaoRx ParacetamolTx Root canal");
    // A line each: neither runs into the other.
    expect(within(row).getByText("Rx Paracetamol")).not.toBe(within(row).getByText("Tx Root canal"));
  });

  it("carries one more line under the first, each cut short alike, when there is a note", () => {
    render(
      <ul>
        <Row title="Rohan Mehta" subtitle="36 y · Male · P-1002" note="Last visit: 28 Sep" href="/patients/1" />
        <Row title="Priya Shah" subtitle="29 y · Female · P-1001" note={null} href="/patients/2" />
      </ul>,
    );
    const [noted, plain] = screen.getAllByRole("listitem");
    expect(noted).toHaveTextContent("Rohan Mehta36 y · Male · P-1002Last visit: 28 Sep");
    expect(screen.getByText("Last visit: 28 Sep")).toHaveClass("truncate");
    expect(plain.querySelectorAll("span.truncate")).toHaveLength(2);
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

  it("in a menu, shows where it goes by a patch of colour under the pointer rather than a ring", () => {
    render(
      <ul>
        <Row look="menu" title="Price list" href="/settings/prices" />
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveClass("hover:bg-ink/5");
  });

  it("is a quiet outline when it is not yet in play, and plain when it goes nowhere", () => {
    render(
      <ul>
        <Row title="Ananya Das" look="quiet" />
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveClass("ring-line");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
