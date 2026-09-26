/**
 * DEMO AI MODE — lets chosen test accounts use the whole app without a single
 * model call.
 *
 * How it is switched on: `DEMO_AI_EMAILS` (comma- or space-separated) lists the
 * accounts, as exact addresses or `*@domain` patterns. When the account behind
 * a request matches, the caller hands the engine DEMO_API_KEY instead of the
 * real Anthropic key. streamAnthropic recognises that key and answers from
 * here, using the `demo` hint each call site attaches (what was asked, in
 * structured form). Nothing else in the engine knows demo mode exists: the
 * replies go through the same parsing, band checks, shared-meal assembly,
 * persistence and UI as real model output, which is the point — the flows
 * being tested are the real ones. Unset `DEMO_AI_EMAILS` and demo mode is off
 * for everyone; a real key never reaches this module.
 */

import type { PlanPromptContext } from "../buildContext";
import type { PlanSkeleton, LocaleCode } from "../schema";
import type { WorkoutTrainee } from "../workout/systemPrompt";
import type { ProfileFitFlags } from "../workout/equipment";
import type { StreamResult } from "../anthropic";
import { AnthropicCallError } from "../errors";
import { DEMO_EN_BY_AR } from "./dishes";
import { demoDayReply, demoSkeletonReply } from "./meal";
import { demoWorkoutMemberReply, demoWorkoutSkeletonReply } from "./workout";

/** Sentinel passed in place of the Anthropic key for demo accounts. */
export const DEMO_API_KEY = "fitlife-demo-mode";

export function isDemoApiKey(key: string | null | undefined): boolean {
  return key === DEMO_API_KEY;
}

/** Parsed `DEMO_AI_EMAILS`. Empty = demo mode off for everyone. */
export function demoAiEmailList(raw: string | undefined = process.env.DEMO_AI_EMAILS): string[] {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

export function isDemoEmail(
  email: string | null | undefined,
  list: string[] = demoAiEmailList(),
): boolean {
  if (!email || list.length === 0) return false;
  const e = email.trim().toLowerCase();
  return list.some((entry) =>
    entry.startsWith("*@") ? e.endsWith(entry.slice(1)) : e === entry,
  );
}

/** What a call site is asking for, in structured form. Ignored outside demo mode. */
export type DemoHint =
  | { kind: "meal-skeleton"; context: PlanPromptContext; memberIds: string[] }
  | { kind: "meal-day"; skeleton: PlanSkeleton; dayIndex: number }
  | {
      kind: "translate-meals";
      locale: LocaleCode;
      items: Array<{ i: number; recipe_name_ar: string; ingredient_names: string[]; prep_steps_ar: string[] }>;
    }
  | { kind: "translate-names"; names: Array<{ i: number; name_ar: string }> }
  | { kind: "workout-skeleton"; trainees: WorkoutTrainee[] }
  | { kind: "workout-member"; trainee: WorkoutTrainee; flags: ProfileFitFlags }
  | { kind: "chat"; messages: Array<{ role: "user" | "assistant"; content: string }> };

/** Base pause per call, so progress screens behave like a (fast) real run. */
function baseDelayMs(): number {
  const v = Number(process.env.DEMO_AI_DELAY_MS);
  return Number.isFinite(v) && v >= 0 ? v : 2500;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

const en = (ar: string) => DEMO_EN_BY_AR.get(ar) ?? ar;

function demoChatReply(messages: Array<{ role: string; content: string }>): string {
  const question = [...messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  const quoted = question.length > 120 ? `${question.slice(0, 120)}…` : question;
  return [
    "هذا ردّ تجريبي من وضع العرض، ولم تُستدعَ المستشارة الفعلية.",
    quoted ? `سؤالك: «${quoted}»` : "",
    "في الاستخدام الحقيقي تقرأ المستشارة خطة أسرتك وأهداف كل فرد، ثم تجيب عن سؤالك مباشرة. مثال على شكل الإجابة:",
    "عشاء اليوم في خطتك شوربة عدس مع سلطة فتوش، وحصتكِ منها تقارب ٤٥٠ سعرة و٢٢ غراماً من البروتين. إن شعرتِ بالجوع بعدها، أضيفي بيضة مسلوقة بدلاً من زيادة الخبز، فهي تضيف بروتيناً دون أن تتجاوزي هدف اليوم.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The demo stand-in for one streamAnthropic call. A demo key with no hint is a
 * call site nobody taught demo mode about: fail loudly rather than guess.
 */
export async function demoRespond(params: {
  demo?: DemoHint;
  onText?: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<StreamResult> {
  const { demo, onText, signal } = params;
  if (!demo) {
    throw new AnthropicCallError("demo mode: this call has no demo response", undefined);
  }
  const base = baseDelayMs();
  let text: string;
  switch (demo.kind) {
    case "meal-skeleton":
      await sleep(base);
      text = demoSkeletonReply(demo.context, demo.memberIds);
      break;
    case "meal-day":
      // Staggered so days land one after another on the progress screen.
      await sleep(Math.round(base * (1.2 + demo.dayIndex * 0.15)));
      text = demoDayReply(demo.skeleton, demo.dayIndex);
      break;
    case "translate-meals":
      await sleep(Math.round(base / 4));
      // Demo translations are English for every locale: the library carries
      // English only. Enough to exercise the housekeeper view end to end.
      text = JSON.stringify(
        demo.items.map((it) => ({
          i: it.i,
          recipe_name: en(it.recipe_name_ar),
          ingredient_names: it.ingredient_names.map(en),
          steps: it.prep_steps_ar.map(en),
        })),
      );
      break;
    case "translate-names":
      text = JSON.stringify(demo.names.map((n) => ({ i: n.i, name: n.name_ar })));
      break;
    case "workout-skeleton":
      await sleep(base);
      text = demoWorkoutSkeletonReply(demo.trainees);
      break;
    case "workout-member":
      await sleep(base);
      text = demoWorkoutMemberReply(demo.trainee, demo.flags);
      break;
    case "chat": {
      text = demoChatReply(demo.messages);
      if (onText) {
        for (const word of text.split(/(\s+)/)) {
          if (signal?.aborted) break;
          onText(word);
          await sleep(Math.min(18, base), signal);
        }
      }
      break;
    }
  }
  return { text, tokensIn: 0, tokensOut: 0, stopReason: "end_turn" };
}
