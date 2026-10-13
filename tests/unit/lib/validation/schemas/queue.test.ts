import { describe, expect, it } from "vitest";

import { nextPatientSchema, queueMoveSchema, sendInSchema, steppedOutSchema } from "@/lib/validation";

const A = "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";
const D = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";

const issue = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("the queue's moves (plan §11.4, §30)", () => {
  it("name the appointment moved, and nothing else", () => {
    expect(queueMoveSchema.parse({ appointmentId: A })).toEqual({ appointmentId: A });
    expect(issue(queueMoveSchema.safeParse({ appointmentId: "a-1" }))).toBe("That value is not valid.");
  });

  it("send in with what becomes of those in — marked done or kept in — or nothing said (D192)", () => {
    expect(sendInSchema.parse({ appointmentId: A })).toEqual({ appointmentId: A });
    expect(sendInSchema.parse({ appointmentId: A, others: "FINISH" })).toEqual({ appointmentId: A, others: "FINISH" });
    expect(sendInSchema.parse({ appointmentId: A, others: "KEEP" }).others).toBe("KEEP");
    expect(issue(sendInSchema.safeParse({ appointmentId: A, others: "LATER" }))).toBe("That value is not valid.");
  });

  it("move a doctor's queue on, for the patient named or with the room free (D196)", () => {
    expect(nextPatientSchema.parse({ doctorId: D })).toEqual({ doctorId: D });
    expect(nextPatientSchema.parse({ doctorId: D, appointmentId: A })).toEqual({ doctorId: D, appointmentId: A });
    expect(issue(nextPatientSchema.safeParse({ appointmentId: A }))).toBe("That value is not valid.");
  });

  it("mark a patient stepped out or back (D198)", () => {
    expect(steppedOutSchema.parse({ appointmentId: A, out: false })).toEqual({ appointmentId: A, out: false });
    expect(issue(steppedOutSchema.safeParse({ appointmentId: A, out: "yes" }))).toBe("That value is not valid.");
  });
});
