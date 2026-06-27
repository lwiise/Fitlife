import { z } from "zod";
import { streamAnthropic, stripMarkdownFence } from "./anthropic";
import { TRANSLATE_MODEL } from "./constants";
import type { FoodPreferences } from "./buildContext";

// Conservative cap per list — durable preferences should stay a short, high-signal
// summary, not an ever-growing log. (Decay/reinforcement is a planned follow-up.)
export const PREFERENCE_CAP = 15;

const DistillSchema = z.object({
  loves: z.array(z.string()).default([]),
  avoids: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

function buildDistillPrompt(feedback: string, existing: FoodPreferences): string {
  return `# دورك
أنتِ تستخرجين تفضيلات غذائية دائمة من ملاحظة العميلة على خطتها. أعيدي JSON صالحاً فقط (لا نص قبله/بعده) بالشكل:
{ "loves": string[], "avoids": string[], "notes": string[] }
- loves: أطباق أو مكونات تريد المزيد منها.
- avoids: أطباق أو مكونات تريد الابتعاد عنها (تفضيل، وليس حساسية أو منعاً طبياً).
- notes: ملاحظات لينة لا تندرج تحت ما سبق.
استخرجي فقط ما هو دائم ويصلح للخطط القادمة، وليس تعليقاً عابراً على هذه الخطة فقط. عناصر قصيرة بالعربية. إن لم يوجد شيء دائم، أعيدي مصفوفات فارغة.

# التفضيلات الحالية (للسياق فقط — لا تكرّريها)
loves: ${existing.loves.join("، ") || "—"}
avoids: ${existing.avoids.join("، ") || "—"}

# ملاحظة العميلة
${feedback}`;
}

/**
 * Distill a free-text regeneration feedback into durable structured preferences
 * (WS5a). Runs on Haiku (cheap, mechanical). Fully non-fatal: returns null on empty
 * input or ANY failure (the caller treats null as "no update"). This is NOT model
 * training — it's writing a per-family memory the prompt reads next time.
 */
export async function distillPreferences(
  anthropicApiKey: string,
  feedback: string,
  existing: FoodPreferences,
): Promise<FoodPreferences | null> {
  const fb = feedback?.trim();
  if (!fb) return null;
  try {
    const res = await streamAnthropic({
      apiKey: anthropicApiKey,
      model: TRANSLATE_MODEL,
      maxTokens: 1024,
      systemPrompt: buildDistillPrompt(fb, existing),
      userMessage: "استخرجي الآن.",
    });
    const parsed = DistillSchema.safeParse(JSON.parse(stripMarkdownFence(res.text)));
    if (!parsed.success) return null;
    const { loves, avoids, notes } = parsed.data;
    if (loves.length === 0 && avoids.length === 0 && notes.length === 0) return null;
    return { loves, avoids, notes };
  } catch {
    return null;
  }
}

/** Merge newly distilled preferences into the existing set (dedup + cap each list). */
export function mergePreferences(
  existing: FoodPreferences,
  next: FoodPreferences,
  cap = PREFERENCE_CAP,
): FoodPreferences {
  const dedupCap = (a: string[], b: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of [...a, ...b]) {
      const t = s.trim();
      if (!t) continue;
      const key = t.normalize("NFC").replace(/\s+/g, " ").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= cap) break;
    }
    return out;
  };
  return {
    loves: dedupCap(existing.loves, next.loves),
    avoids: dedupCap(existing.avoids, next.avoids),
    notes: dedupCap(existing.notes, next.notes),
  };
}
