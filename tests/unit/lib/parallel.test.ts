import { describe, expect, it } from "vitest";

import { allInOrder } from "@/lib/parallel";

const after = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const failAfter = (ms: number, reason: string) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error(reason)), ms));

describe("allInOrder", () => {
  it("asks every read at once, and answers each in the place it was listed", async () => {
    const started = Date.now();
    await expect(allInOrder([after(40, "order"), after(40, 2), Promise.resolve(null)])).resolves.toEqual([
      "order",
      2,
      null,
    ]);
    expect(Date.now() - started).toBeLessThan(75);
  });

  it("refuses with the first failure listed, even when a later one fails sooner", async () => {
    await expect(allInOrder([failAfter(30, "order not found"), failAfter(0, "payment refused")])).rejects.toThrow(
      "order not found",
    );
    await expect(allInOrder([after(0, "order"), failAfter(10, "payment refused")])).rejects.toThrow("payment refused");
  });
});
