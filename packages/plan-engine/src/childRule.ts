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
