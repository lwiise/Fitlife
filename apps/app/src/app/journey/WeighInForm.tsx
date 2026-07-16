"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { logBodyWeight } from "@/lib/engagement/actions";

const AR_NUM = new Intl.NumberFormat("ar-SA", {
  useGrouping: false,
  maximumFractionDigits: 1,
});

/**
 * Weekly weigh-in. The last known weight renders MASKED by default — this
 * phone gets handed to children and the housekeeper; revealing is a deliberate
 * tap. Submitting again the same day corrects today's value; a second weigh-in
 * within the week is refused by the server with a gentle message.
 */
export function WeighInForm({ lastWeightKg }: { lastWeightKg: number | null }) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const weightNum = Number(weight);
    if (!weight || Number.isNaN(weightNum)) {
      setMessage("أدخلي وزنك بالأرقام");
      return;
    }
    const waistNum = waist ? Number(waist) : null;
    startTransition(async () => {
      const result = await logBodyWeight({
        weight_kg: weightNum,
        waist_cm: waistNum,
      });
      if (result.ok) {
        setSaved(true);
        setMessage(null);
        setWeight("");
        setWaist("");
        router.refresh();
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <section
      aria-label="تسجيل الوزن"
      className="bg-white rounded-2xl border border-brand-ink/5 p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-brand-ink">وزنك اليوم؟</h2>
        {lastWeightKg !== null && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-bold text-brand-purple-900 hover:bg-brand-lavender/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            {revealed ? (
              <>
                <EyeOff className="size-4" aria-hidden="true" />
                <span dir="ltr">{AR_NUM.format(lastWeightKg)}</span> كجم
              </>
            ) : (
              <>
                <Eye className="size-4" aria-hidden="true" />
                آخر وزن • • •
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-brand-ink-muted">الوزن (كجم)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={20}
            max={300}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="mt-1 w-full min-h-12 rounded-xl border border-brand-ink/15 bg-brand-surface px-4 font-bold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-brand-ink-muted">
            محيط الخصر (اختياري)
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={30}
            max={250}
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
            className="mt-1 w-full min-h-12 rounded-xl border border-brand-ink/15 bg-brand-surface px-4 font-bold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          />
        </label>
      </div>

      {message && (
        <p role="alert" className="text-sm font-bold text-brand-pink">
          {message}
        </p>
      )}
      {saved && !message && (
        <p role="status" className="text-sm font-bold text-brand-purple-900">
          حُفظ وزنك — نلقاكِ الأسبوع القادم
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full min-h-12 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 font-bold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
      >
        {pending ? "يُحفظ…" : "حفظ"}
      </button>
      <p className="text-xs text-brand-ink-muted">
        مرة واحدة في الأسبوع تكفي — ويمكنك التخطي متى شئتِ بلا أي تذكير مزعج.
      </p>
    </section>
  );
}
