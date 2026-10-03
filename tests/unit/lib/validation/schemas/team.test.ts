import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  acceptInviteSchema,
  doctorDetailsSchema,
  firstIssue,
  invitePreviewSchema,
  inviteSchema,
  jobTitleSchema,
  memberActiveSchema,
  updateMemberSchema,
} from "@/lib/validation";

function messageOf(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : firstIssue(result.error);
}

const staff = {
  fullName: "  Meera   Pillai ",
  email: " Meera@Example.com ",
  role: "STAFF",
  jobTitle: " Front desk ",
  permissions: ["patients.create", "patients.view"],
  doctor: { specialization: "", qualifications: "", registrationNumber: "", fee: "" },
};

describe("inviteSchema (plan §8.4, D89)", () => {
  it("tidies who it is for, keeps a job title for staff, and orders the permissions", () => {
    expect(inviteSchema.parse(staff)).toEqual({
      fullName: "Meera Pillai",
      email: "meera@example.com",
      role: "STAFF",
      jobTitle: "Front desk",
      permissions: ["patients.view", "patients.create"],
      doctor: null,
    });
  });

  it("keeps a doctor's details for a doctor, the fee in paise or none, and drops a job title", () => {
    expect(
      inviteSchema.parse({
        ...staff,
        role: "DOCTOR",
        doctor: { specialization: "Orthodontist", qualifications: "BDS, MDS", registrationNumber: "", fee: "₹700" },
      }),
    ).toMatchObject({
      jobTitle: null,
      doctor: { specialization: "Orthodontist", qualifications: "BDS, MDS", registrationNumber: null, fee: 70_000 },
    });
    expect(inviteSchema.parse({ ...staff, role: "DOCTOR" }).doctor).toMatchObject({ fee: null });
  });

  it("says what is wrong, in the catalogue's words", () => {
    expect(messageOf(inviteSchema, { ...staff, fullName: " " })).toBe(VALIDATION_MESSAGES.required("Name"));
    expect(messageOf(inviteSchema, { ...staff, email: "meera" })).toBe(VALIDATION_MESSAGES.email("Email"));
    expect(messageOf(inviteSchema, { ...staff, role: "OWNER" })).toBe(VALIDATION_MESSAGES.choose("Role"));
    expect(messageOf(inviteSchema, { ...staff, jobTitle: "x".repeat(TEXT_LIMITS.jobTitle + 1) })).toBe(
      VALIDATION_MESSAGES.tooLong("Job title", TEXT_LIMITS.jobTitle),
    );
    expect(messageOf(inviteSchema, { ...staff, permissions: ["appointments.view"] })).toBe(
      VALIDATION_MESSAGES.permissionsNeedOthers,
    );
    expect(messageOf(inviteSchema, { ...staff, permissions: ["inventory.view"] })).toBe(VALIDATION_MESSAGES.invalid);
    expect(messageOf(inviteSchema, { ...staff, doctor: { ...staff.doctor, fee: "lots" } })).toBe(
      VALIDATION_MESSAGES.amount("Consultation fee"),
    );
  });
});

const TOKEN = "Ab_3-".repeat(8) + "xyz";

describe("acceptInviteSchema (plan §8.5)", () => {
  it("takes the link's token, the name tidied, the mobile made whole and the password as typed", () => {
    expect(
      acceptInviteSchema.parse({
        token: TOKEN,
        fullName: " Meera  P ",
        phone: "098765 01234",
        password: " pass word ",
      }),
    ).toEqual({ token: TOKEN, fullName: "Meera P", phone: "+919876501234", password: " pass word " });
  });

  it("refuses what cannot be a token, and says what else is wrong in the catalogue's words", () => {
    const accept = { token: TOKEN, fullName: "Meera", phone: "9876501234", password: "long enough" };
    expect(messageOf(acceptInviteSchema, { ...accept, token: "abc" })).toBe(VALIDATION_MESSAGES.invalid);
    expect(messageOf(acceptInviteSchema, { ...accept, fullName: "" })).toBe(VALIDATION_MESSAGES.required("Your name"));
    expect(messageOf(acceptInviteSchema, { ...accept, phone: "12345" })).toBe(VALIDATION_MESSAGES.phone);
    expect(messageOf(invitePreviewSchema, { token: TOKEN.slice(1) })).toBe(VALIDATION_MESSAGES.invalid);
    expect(invitePreviewSchema.parse({ token: TOKEN })).toEqual({ token: TOKEN });
  });
});

describe("changing a member (plan §8.6)", () => {
  it("passes on only what is named, tidied", () => {
    expect(updateMemberSchema.parse({})).toEqual({});
    expect(updateMemberSchema.parse({ permissions: ["patients.create", "patients.view"] })).toEqual({
      permissions: ["patients.view", "patients.create"],
    });
    expect(updateMemberSchema.parse({ jobTitle: " " })).toEqual({ jobTitle: null });
    expect(
      updateMemberSchema.parse({
        doctor: { specialization: " Orthodontist ", qualifications: "", registrationNumber: "KL-1", fee: "700" },
      }),
    ).toEqual({
      doctor: { specialization: "Orthodontist", qualifications: null, registrationNumber: "KL-1", fee: 70_000 },
    });
    expect(messageOf(updateMemberSchema, { permissions: ["visits.edit"] })).toBe(
      VALIDATION_MESSAGES.permissionsNeedOthers,
    );
  });

  it("reads a job title, a doctor's details, and deactivating, each on its own", () => {
    expect(jobTitleSchema.parse({ jobTitle: " Nurse " })).toEqual({ jobTitle: "Nurse" });
    expect(doctorDetailsSchema.parse({})).toEqual({
      specialization: null,
      qualifications: null,
      registrationNumber: null,
      fee: null,
    });
    expect(memberActiveSchema.parse({ active: false })).toEqual({ active: false });
    expect(messageOf(memberActiveSchema, { active: "no" })).toBe(VALIDATION_MESSAGES.invalid);
  });
});
