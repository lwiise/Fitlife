import { PlanBar, PlanBarEnd, PlanBarRow } from "./bar/PlanBar";

/**
 * Route skeleton shown during server-component navigation, shaped like the
 * page it stands in for: the plan bar (identity row + the seven-day strip),
 * the day line, then meal cards. It renders the REAL PlanBar, not a lookalike:
 * every /plan state opens with that bar, and on phones the bar replaces the
 * app header (globals.css keys off [data-plan-bar]) — a skeleton without it
 * would show the shell header for a beat and then swap it out. Its geometry
 * also stays in step with the bar by construction. animate-pulse is disabled
 * globally under prefers-reduced-motion (globals.css). Root layout provides
 * lang/dir.
 */
export default function PlanLoading() {
  return (
    <main className="min-h-screen bg-brand-surface" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="container-app pb-8 pt-0 md:pb-12 lg:pt-8">
        <PlanBar>
          <PlanBarRow>
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-brand-tint" />
            <div className="h-5 w-28 animate-pulse rounded-md bg-brand-tint" />
            <PlanBarEnd>
              <div className="h-11 w-24 animate-pulse rounded-full bg-brand-tint" />
              <div className="size-11 animate-pulse rounded-full bg-brand-tint" />
            </PlanBarEnd>
          </PlanBarRow>
          {/* Same grid as WeekStrip, so nothing shifts when the days land. */}
          <div className="grid grid-cols-7 gap-1 px-4 pb-2 max-[375px]:gap-0.5 max-[352px]:gap-px max-[352px]:px-[3px]">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="min-h-12 animate-pulse rounded-xl bg-brand-tint" />
            ))}
          </div>
        </PlanBar>

        {/* The day line: date and calories, then the macros. */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-40 animate-pulse rounded-md bg-brand-card" />
            <div className="h-5 w-28 animate-pulse rounded-md bg-brand-card" />
          </div>
          <div className="h-4 w-52 animate-pulse rounded-md bg-brand-card" />
        </div>

        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-brand-line bg-brand-card"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
