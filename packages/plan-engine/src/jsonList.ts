/**
 * The one coercion for the jsonb chip columns — `allergies`, `dislikes`,
 * `medical_conditions`, `medications`, `supplements`, `nausea_foods`,
 * `liked_foods`, `cooking_methods`, `family_dietary_restrictions`,
 * `family_dislikes`.
 *
 * These come back from PostgREST as `Json | null`. Five separate coercions had
 * grown up around them and they did NOT agree on what a non-string element
 * means: three dropped it silently (including both AI-prompt paths — the
 * engine's buildContext and the background function's SDK-free mirror) while
 * two decoded it as `{ name_ar | name | label }` (the admin health view and the
 * chat context). So an object-shaped allergen would have been displayed to an
 * admin and described to the chat, yet silently omitted from the constraint
 * list the meal generator actually sees.
 *
 * Every writer is zod-validated as `z.array(z.string())` today, so no such row
 * exists and nothing is being dropped right now — this is a latent divergence,
 * not a live one. It is resolved in the safe direction anyway: object entries
 * are decoded rather than discarded, so if one ever reaches the database (a
 * manual edit, a future chips redesign) the allergen reaches the prompt instead
 * of vanishing from it. For the string rows that actually exist, this is
 * byte-identical to what every call site did before.
 *
 * Deliberately dependency-free: the Netlify background function must stay
 * SDK-free, so it can value-import this without pulling zod or the Supabase
 * client into its bundle.
 */

/** Keys an object entry may carry its display text under, in priority order. */
const NAME_KEYS = ["name_ar", "name", "label"] as const;

export function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed) out.push(trimmed);
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      for (const key of NAME_KEYS) {
        const candidate = obj[key];
        if (typeof candidate === "string" && candidate.trim()) {
          out.push(candidate.trim());
          break;
        }
        if (typeof candidate === "number") {
          out.push(String(candidate));
          break;
        }
      }
      // An object with none of those keys carries no readable term. Dropped on
      // purpose: emitting `{"foo":1}` into an allergy constraint would be a
      // nonsense instruction to the model, which is worse than omitting it.
    }
  }
  return out;
}
