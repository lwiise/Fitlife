// Water-intake bands (liters/day) — Coach Sara's questionnaire options.
// Stored as enum-like text (00015), Zod-validated; single source for all forms.

export type WaterLiters = "lt1" | "l1_2" | "l2_3" | "gt3";

export const WATER_LITERS_OPTIONS: Array<{ value: WaterLiters; label: string }> = [
  { value: "lt1", label: "أقل من لتر" },
  { value: "l1_2", label: "1-2 لتر" },
  { value: "l2_3", label: "2-3 لترات" },
  { value: "gt3", label: "أكثر من 3 لترات" },
];
