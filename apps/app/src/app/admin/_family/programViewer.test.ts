import { createElement, type ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkoutPlanSchema } from "@fitlife/plan-engine";

/**
 * The program view (/admin/subscribers/<id>/workout/<planId>) shows the
 * family's own WorkoutViewer in its read-only mode. Server-rendered like the
 * page renders it: nothing of the customer's own screens may show (links, the
 * «أنتِ» marker, session marking), a lone trainee must still be named, and
 * the first render must not depend on the clock. The page is rendered on a
 * UTC server and hydrated in the operator's browser, and a render that picks
 * "today" there disagrees with the server's for three hours every night.
 */

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  function Link(props: Record<string, unknown>) {
    const { href, ...rest } = props;
    for (const routerOnly of ["prefetch", "scroll", "replace", "onNavigate"]) delete rest[routerOnly];
    return createElement("a", { ...rest, href: String(href) });
  }
  return { default: Link, useLinkStatus: () => ({ pending: false }) };
});
// Session marking is a server action (Supabase, Sentry); the viewer only
// needs it to exist.
vi.mock("@/lib/engagement/actions", () => ({ setWorkoutCheckin: vi.fn() }));
// The form animation is browser-only, and every exercise row starts closed.
vi.mock("@/app/plan/ExerciseLottie", () => ({ ExerciseLottie: () => null }));

const { WorkoutViewer } = await import("@/app/plan/WorkoutViewer");

const PLAN_ID = "00000000-0000-4000-8000-0000000000c1";
const FAISAL = "00000000-0000-4000-8000-0000000000f1";

function session(day: number, name: string) {
  return {
    day_index: day,
    session_name_ar: name,
    warmup_ar: ["مشي خفيف ٥ دقائق"],
    exercises: [
      {
        name_ar: "سكوات",
        target_muscles_ar: "الأرداف والفخذان",
        sets: 3,
        reps: "10-12",
        rest_seconds: 90,
      },
    ],
    duration_min: 45,
  };
}

function trainee(id: string, name: string, days: Array<[number, string]>) {
  return {
    member_id: id,
    member_name_ar: name,
    split_name_ar: "الجسم كامل",
    weekly_sessions: days.map(([day, sessionName]) => session(day, sessionName)),
    progression_notes_ar: "زيادة التكرار تدريجياً.",
  };
}

/** A program as the page hands it over: parsed by the engine's own schema. */
function program(...members: ReturnType<typeof trainee>[]) {
  return WorkoutPlanSchema.parse({ week_start_date: "2026-09-27", members });
}

function viewer(props: ComponentProps<typeof WorkoutViewer>): string {
  return renderToString(createElement(WorkoutViewer, props));
}

/** Runs `run` with the process in time zone `zone`, then restores it. */
function inZone<T>(zone: string, run: () => T): T {
  const saved = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
}

/** Runs `run` with the clock stopped at `iso`. */
function at<T>(iso: string, run: () => T): T {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
  try {
    return run();
  } finally {
    vi.useRealTimers();
  }
}

/** The names of the pressed day tabs (the open day). */
function openDays(html: string): string[] {
  const pressed = /<button type="button" aria-pressed="true" class="rounded-xl[^"]*">([^<]*)<\/button>/g;
  return [...html.matchAll(pressed)].map((match) => match[1] ?? "");
}

/** A trainee's chip, as the viewer draws it. */
const chip = (name: string) => `<span class="relative">${name}</span>`;

describe("the program view's read-only WorkoutViewer", () => {
  it("opens on the week's first session, the same on a UTC server as in a Riyadh browser", () => {
    // Sessions out of week order on purpose: "first" is the earliest weekday.
    const plan = program(
      trainee("mom", "هند", [
        [3, "جلسة الأربعاء"],
        [4, "جلسة الخميس"],
        [1, "جلسة الاثنين"],
      ]),
    );
    // 22:30 UTC on Wednesday 30 September is already Thursday in Riyadh.
    const [server, browser] = at("2026-09-30T22:30:00Z", () => [
      inZone("UTC", () => ({ today: new Date().getDay(), html: viewer({ plan, readOnly: true }) })),
      inZone("Asia/Riyadh", () => ({
        today: new Date().getDay(),
        html: viewer({ plan, readOnly: true }),
      })),
    ]);
    // The premise: both are training days, and the two clocks disagree…
    expect([server.today, browser.today]).toEqual([3, 4]);
    // …yet the view never asks, so the browser's first render is the server's.
    expect(browser.html).toBe(server.html);
    expect(openDays(server.html)).toEqual(["الاثنين"]);
    expect(server.html).toContain("جلسة الاثنين");
  });

  it("names a lone trainee, who need not be the account owner", () => {
    const plan = program(trainee(FAISAL, "فيصل", [[2, "جلسة الثلاثاء"]]));
    const admin = viewer({ plan, readOnly: true });
    expect(admin).toContain(chip("فيصل"));
    expect(admin).not.toContain("إضافة فرد");
    expect(admin).not.toContain("href=");
    // The customer's own solo view is unchanged: the invitation, not a chip.
    const own = viewer({ plan });
    expect(own).toContain("إضافة فرد للتمارين");
    expect(own).not.toContain(chip("فيصل"));
  });

  it("leaves out the customer's own links, the «أنتِ» marker and session marking", () => {
    const props: ComponentProps<typeof WorkoutViewer> = {
      plan: program(
        trainee("mom", "هند", [[2, "جلسة الثلاثاء"]]),
        trainee(FAISAL, "فيصل", [[4, "جلسة الخميس"]]),
      ),
      planId: PLAN_ID,
      checkins: [],
      ownerSex: "female",
      journeyMembers: [{ id: "mom", name: "هند" }],
    };
    // Tuesday midday in Riyadh: the owner's session is today, so it can be marked.
    const [own, admin] = at("2026-09-29T09:00:00Z", () =>
      inZone("Asia/Riyadh", () => [viewer(props), viewer({ ...props, readOnly: true })]),
    );
    // The customer's own view, as the control: all of it is there.
    expect(own).toContain("هل أنجزت حصة اليوم؟");
    expect(own).toContain("أنتِ");
    expect(own).toContain('href="/family"');
    expect(own).toContain('href="/journey"');
    // Read-only: none of it, and both trainees still have their chip.
    expect(admin).not.toContain("هل أنجزت حصة اليوم؟");
    expect(admin).not.toContain("أنتِ");
    expect(admin).not.toContain("href=");
    expect(admin).toContain(chip("هند"));
    expect(admin).toContain(chip("فيصل"));
  });
});
