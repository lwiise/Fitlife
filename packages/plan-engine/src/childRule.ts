/**
 * The ONE definition of "this person is planned as a child".
 *
 * Children are planned by food-pyramid PORTIONS, never by BMR/TDEE — Sara's
 * methodology is explicit about it. The rule was applied to family members in
 * three places and to the ACCOUNT OWNER in only one of them: the plan assembly
 * stamped `is_child` for an under-18 owner while the skeleton and day prompts
 * still handed her an adult calorie target, so a 15-year-old signup got an
 * adult deficit plan displayed as a portions plan. Everything reads from here.
 *
 * Pure and dependency-free: the engine, the prompts, and the app's read-time
 * display layer all import it.
 */

/** Anyone under this age is planned by portions, never by calorie targets. */
export const CHILD_AGE_CUTOFF = 18;

/**
 * From this age a minor is DESCRIBED as «مراهق» rather than «طفل».
 *
 * This changes no rule — an adolescent is still planned by portions, still gets
 * no BMR/TDEE, still has no calorie ceiling. It exists because "planned by
 * portions" was the ONLY thing the prompts said about anyone under 18, so a
 * sixteen-year-old and a ten-year-old arrived at the model as the same word and
 * came back with the same food. The methodology already distinguishes them (its
 * family-portion example splits «المراهق: 540 جم» from «الطفل: 180 جم» of one
 * pot); it just had no way to tell which one it was looking at.
 *
 * 13 is a labelling boundary, not a nutrition cliff, and it matches the age the
 * product already treats as an independent user (step1Schema's signup floor).
 * Nothing hinges on it being exactly right: the clauses state the ACTUAL age
 * alongside the stage, so a twelve-year-old is scaled to twelve either way.
 */
export const ADOLESCENT_AGE_MIN = 13;

export type MinorStage = "child" | "adolescent";

/**
 * Which stage a minor is at. An unknown age reads as "child" — the more
 * conservative portion, and the same permissive-to-the-younger stance the rest
 * of this module takes when data is missing.
 */
export function minorStage(age: number | null | undefined): MinorStage {
  return age != null && age >= ADOLESCENT_AGE_MIN ? "adolescent" : "child";
}

/**
 * By resolved age. `member_type === "child"` wins outright; an unknown age
 * cannot be fabricated, so it reads as an adult (the same permissive stance
 * the workout age gate takes).
 */
export function isChildByAge(
  memberType: string | null | undefined,
  age: number | null | undefined,
): boolean {
  if (memberType === "child") return true;
  return age != null && age < CHILD_AGE_CUTOFF;
}

/** Same rule, from a stored birth_year. */
export function isChildByBirthYear(
  memberType: string | null | undefined,
  birthYear: number | null | undefined,
  currentYear: number = new Date().getFullYear(),
): boolean {
  if (memberType === "child") return true;
  if (birthYear == null) return false;
  return currentYear - birthYear < CHILD_AGE_CUTOFF;
}
