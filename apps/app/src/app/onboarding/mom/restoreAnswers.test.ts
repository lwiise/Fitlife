import { describe, it, expect } from "vitest";

import {
  restoreActivityLevel,
  restoreIdentity,
  restorePhysical,
  type SavedMomAnswers,
} from "./restoreAnswers";
// step1Schema only: step2Schema's optional fields accept `number | NaN` on
// INPUT but transform to `null` on output, so re-parsing a restored (output-
// shaped) value through it is not a contract the wizard relies on — the
// existing setPhysical/defaultValues round-trip already carries nulls.
import { step1Schema } from "../schema";

const CURRENT_YEAR = new Date().getFullYear();

const full: SavedMomAnswers = {
  sex: "female",
  display_name: "نورة",
  birth_year: CURRENT_YEAR - 34,
  phone: "0500000000",
  height_cm: "164.0", // numeric columns come back as strings
  weight_kg: "72.50",
  waist_cm: "88",
  hip_cm: null,
  target_weight_kg: "65",
  activity_level: "moderate",
};

describe("restoreIdentity", () => {
  it("restores a complete identity that the schema then accepts", () => {
    const restored = restoreIdentity(full);
    expect(restored).toBeDefined();
    // The real contract: what we seed must survive the same validation the
    // form runs. A seed the schema rejects is worse than an empty form.
    expect(step1Schema.safeParse(restored).success).toBe(true);
  });

  it("restores nothing when a required field is missing", () => {
    // All-or-nothing: a half-filled form looks answered, and the one empty
    // field is the one thing not drawing attention to itself.
    expect(restoreIdentity({ ...full, display_name: null })).toBeUndefined();
    expect(restoreIdentity({ ...full, birth_year: null })).toBeUndefined();
    expect(restoreIdentity({ ...full, sex: null })).toBeUndefined();
    expect(restoreIdentity(undefined)).toBeUndefined();
  });

  it("ignores a sex value that is not one of the two the schema allows", () => {
    expect(restoreIdentity({ ...full, sex: "other" })).toBeUndefined();
  });

  it("treats a missing phone as absent rather than empty", () => {
    const restored = restoreIdentity({ ...full, phone: null });
    expect(restored?.phone).toBeUndefined();
    expect(step1Schema.safeParse(restored).success).toBe(true);
  });
});

describe("restorePhysical", () => {
  it("converts Postgres numeric strings back to numbers", () => {
    const restored = restorePhysical(full);
    expect(restored).toMatchObject({
      height_cm: 164,
      weight_kg: 72.5,
      waist_cm: 88,
      target_weight_kg: 65,
    });
  });

  it("keeps the optional measurements null rather than NaN", () => {
    const restored = restorePhysical({
      ...full,
      waist_cm: null,
      hip_cm: null,
      target_weight_kg: null,
    });
    // null, matching exactly what setPhysical() stores after a real submit
    // (step2Schema's transform maps absent optionals to null), so the restored
    // value and the freshly-parsed one are the same shape.
    expect(restored?.waist_cm).toBeNull();
    expect(restored?.hip_cm).toBeNull();
    expect(restored?.target_weight_kg).toBeNull();
  });

  it("restores nothing without both height and weight", () => {
    expect(restorePhysical({ ...full, height_cm: null })).toBeUndefined();
    expect(restorePhysical({ ...full, weight_kg: null })).toBeUndefined();
    expect(restorePhysical(undefined)).toBeUndefined();
  });

  it("ignores unparseable stored values instead of seeding NaN", () => {
    expect(restorePhysical({ ...full, height_cm: "" })).toBeUndefined();
    expect(restorePhysical({ ...full, weight_kg: "abc" })).toBeUndefined();
  });
});

describe("restoreActivityLevel", () => {
  it("restores a known level", () => {
    expect(restoreActivityLevel(full)).toBe("moderate");
  });

  it("rejects anything that is not one of the five levels", () => {
    expect(restoreActivityLevel({ ...full, activity_level: "extreme" })).toBeNull();
    expect(restoreActivityLevel({ ...full, activity_level: null })).toBeNull();
    expect(restoreActivityLevel(undefined)).toBeNull();
  });
});
