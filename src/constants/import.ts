import type { Gender } from "./statuses";

/**
 * Importing patients (plan §10.5, D51, D127 – D133): what a file may be, the
 * fields its columns may fill, and the words a header or a gender cell is
 * recognised by. A file is read in the browser and never sent or stored.
 */

/** A CSV, or an Excel workbook (.xlsx, its first sheet) — not the old .xls (D127). */
export const IMPORT_ACCEPT = [
  ".csv",
  ".xlsx",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

/** The fields a column may fill, in the order the columns step lists them (plan §10.1). */
export const IMPORT_FIELDS = [
  "fullName",
  "phone",
  "dateOfBirth",
  "age",
  "gender",
  "altPhone",
  "email",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** What a row cannot do without: a name, a mobile and a gender — and a date of birth or an age. */
export const IMPORT_REQUIRED: readonly ImportField[] = ["fullName", "phone", "gender"];

/**
 * What a header may say for each field, read lower-cased with everything but
 * letters and digits dropped ("Mobile No." is "mobileno"). The first field a
 * header names takes the column; a field no header names waits to be chosen.
 */
export const IMPORT_HEADER_WORDS: Record<ImportField, readonly string[]> = {
  fullName: ["name", "fullname", "patientname", "patient", "patientsname"],
  phone: [
    "mobile",
    "mobileno",
    "mobilenumber",
    "phone",
    "phoneno",
    "phonenumber",
    "contact",
    "contactno",
    "contactnumber",
    "cell",
    "whatsapp",
  ],
  dateOfBirth: ["dob", "dateofbirth", "birthdate", "birthday", "born"],
  age: ["age", "ageyears", "ageinyears", "years"],
  gender: ["gender", "sex"],
  altPhone: [
    "alternatephone",
    "altphone",
    "alternatemobile",
    "altmobile",
    "otherphone",
    "landline",
    "phone2",
    "mobile2",
  ],
  email: ["email", "emailid", "emailaddress", "mail"],
  address: ["address", "addr", "residence", "location"],
  emergencyContactName: ["emergencycontact", "emergencyname", "emergencycontactname", "guardian", "nextofkin"],
  emergencyContactPhone: [
    "emergencyphone",
    "emergencycontactphone",
    "emergencymobile",
    "emergencynumber",
    "emergencycontactnumber",
    "guardianphone",
  ],
  notes: ["notes", "note", "remarks", "remark", "comments", "comment"],
};

/** What a gender cell may say, read lower-cased. */
export const IMPORT_GENDER_WORDS: Record<Gender, readonly string[]> = {
  MALE: ["m", "male", "man", "boy"],
  FEMALE: ["f", "female", "woman", "girl"],
  OTHER: ["o", "other", "others", "t", "transgender"],
};

/** A month as a date in a file may name it ("12 Apr 1992", "12 April 1992"), by its first three letters. */
export const IMPORT_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
