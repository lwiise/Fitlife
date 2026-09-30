import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  OWNER_PHOTO_SUBJECT,
  householdPhotoSrcs,
  isPhotoSubject,
  parseProfilePhotoPath,
  profilePhotoPathFor,
  profilePhotoSrc,
  sniffImageType,
  squareCrop,
} from "./shared";

const USER = "3f2b8c1e-4d5a-4b6c-8e7f-9a0b1c2d3e4f";
const OTHER = "11111111-2222-4333-8444-555555555555";
const KID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const MAID = "99999999-8888-4777-8666-555555555555";
const OBJ = "0f0e0d0c-0b0a-4908-8706-050403020100";

describe("profile photo paths", () => {
  it("accepts the owner's and a member's path, and reads their parts", () => {
    expect(parseProfilePhotoPath(`${USER}/mom-${OBJ}.webp`)).toEqual({
      userId: USER,
      subject: "mom",
      type: "image/webp",
    });
    expect(parseProfilePhotoPath(`${USER}/${KID}-${OBJ}.jpg`)).toEqual({
      userId: USER,
      subject: KID,
      type: "image/jpeg",
    });
  });

  it("refuses anything this app did not write", () => {
    for (const bad of [
      null,
      undefined,
      42,
      "",
      `${USER}/mom.webp`,
      `${USER}/mom-${OBJ}.gif`,
      `${USER}/mom-${OBJ}.svg`,
      `${USER}/../${OTHER}/mom-${OBJ}.webp`,
      `../${USER}/mom-${OBJ}.webp`,
      `${USER}/sub/mom-${OBJ}.webp`,
      `/${USER}/mom-${OBJ}.webp`,
      `${USER}/dad-${OBJ}.webp`,
      `${USER.toUpperCase()}/mom-${OBJ}.webp`,
      `${USER}/mom-${OBJ}.webp?x=1`,
    ]) {
      expect(parseProfilePhotoPath(bad)).toBeNull();
      expect(profilePhotoSrc(bad)).toBeNull();
    }
  });

  it("round-trips a minted path", () => {
    const p = profilePhotoPathFor(USER, KID, "image/png", OBJ);
    expect(p).toBe(`${USER}/${KID}-${OBJ}.png`);
    expect(parseProfilePhotoPath(p)?.subject).toBe(KID);
    // A default id is a fresh uuid every time: a new photo is a new object.
    const a = profilePhotoPathFor(USER, "mom", "image/webp");
    const b = profilePhotoPathFor(USER, "mom", "image/webp");
    expect(parseProfilePhotoPath(a)).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it("serves through a query parameter, not an image-looking pathname", () => {
    // proxy.ts skips the session refresh for pathnames ending .webp/.jpg/.png.
    const src = profilePhotoSrc(`${USER}/mom-${OBJ}.webp`)!;
    const url = new URL(src, "https://app.example.com");
    expect(url.pathname).toBe("/api/profile-photo");
    expect(url.searchParams.get("p")).toBe(`${USER}/mom-${OBJ}.webp`);
  });

  it("knows who can own a photo", () => {
    expect(isPhotoSubject(OWNER_PHOTO_SUBJECT)).toBe(true);
    expect(isPhotoSubject(KID)).toBe(true);
    expect(isPhotoSubject("household")).toBe(false);
    expect(isPhotoSubject("")).toBe(false);
    expect(isPhotoSubject(null)).toBe(false);
  });
});

describe("householdPhotoSrcs", () => {
  const members = [
    { id: KID, role: "child" },
    { id: MAID, role: "housekeeper" },
  ];

  it("maps the owner and current beneficiaries to URLs", () => {
    const srcs = householdPhotoSrcs(
      {
        mom: `${USER}/mom-${OBJ}.webp`,
        [KID]: `${USER}/${KID}-${OBJ}.jpg`,
      },
      members,
    );
    expect(Object.keys(srcs).sort()).toEqual(["mom", KID].sort());
    expect(srcs.mom).toMatch(/^\/api\/profile-photo\?p=/);
  });

  it("never the housekeeper, never a removed member, never a bad path", () => {
    const srcs = householdPhotoSrcs(
      {
        [MAID]: `${USER}/${MAID}-${OBJ}.webp`,
        [OTHER]: `${USER}/${OTHER}-${OBJ}.webp`, // no longer in the household
        mom: "not-a-path",
      },
      members,
    );
    expect(srcs).toEqual({});
  });
});

describe("sniffImageType", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

  it("reads the three stored formats from their signatures", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      "image/png",
    );
    expect(
      sniffImageType(
        bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toBe("image/webp");
  });

  it("refuses everything else, whatever it claims to be", () => {
    expect(sniffImageType(new TextEncoder().encode("GIF89a......"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='…'>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html><script>"))).toBeNull();
    // RIFF but not WEBP (a WAV file).
    expect(
      sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)),
    ).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("squareCrop", () => {
  it("centres a landscape photo", () => {
    expect(squareCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 });
  });

  it("takes a portrait's square above centre, where the face is", () => {
    const c = squareCrop(1080, 1920);
    expect(c.size).toBe(1080);
    expect(c.sx).toBe(0);
    expect(c.sy).toBe(252);
    expect(c.sy).toBeLessThan((1920 - 1080) / 2);
    expect(c.sy + c.size).toBeLessThanOrEqual(1920);
  });

  it("leaves a square alone", () => {
    expect(squareCrop(512, 512)).toEqual({ sx: 0, sy: 0, size: 512 });
  });
});

// The reason photos live in their own table. family_members carries the
// generic updated_at trigger, and staleMemberIds() reads a member row newer
// than the plan as an unapplied edit — the drain then dispatches a PAID
// regeneration. A photo save that wrote to that row (or to profiles) would buy
// a plan rebuild for a new picture.
describe("a photo is not a plan input", () => {
  const code = readFileSync(join(process.cwd(), "src/lib/profilePhoto/actions.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

  it("never writes family_members or profiles", () => {
    const writes = [...code.matchAll(/\.from\("([a-z_]+)"\)\s*\.(update|upsert|insert|delete)\(/g)].map(
      (m) => m[1],
    );
    expect(writes.length).toBeGreaterThan(0);
    expect(new Set(writes)).toEqual(new Set(["profile_photos"]));
  });
});
