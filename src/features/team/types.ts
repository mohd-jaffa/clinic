/** A `doctors` row as the picker reads it, with the name through their membership's profile. */
export interface DoctorRow {
  id: string;
  member: { profile: { full_name: string } };
}

/** One of the clinic's active doctors, as a picker offers them (plan §30). */
export interface Doctor {
  id: string;
  name: string;
}
