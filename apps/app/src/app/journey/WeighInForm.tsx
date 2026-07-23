"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Eye, EyeOff, X } from "lucide-react";
import { logBodyWeight } from "@/lib/engagement/actions";
import { BODY_PHOTOS_BUCKET } from "@/lib/engagement/types";
import { createClient } from "@/lib/supabase/client";
import { genderPick } from "@/lib/copy/gender";

const AR_NUM = new Intl.NumberFormat("ar-SA", {
  useGrouping: false,
  maximumFractionDigits: 1,
});

// Mirrors the bucket-level allowlist in migration 00018.
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Weekly weigh-in for one member (mom, an adult, or a child). The last known
 * weight renders MASKED by default — this phone gets handed to children and
 * the housekeeper; revealing is a deliberate tap. Submitting again the same
 * day corrects today's value; a second weigh-in within the week is refused by
 * the server with a gentle message.
 *
 * The optional progress photo uploads STRAIGHT to the private body-photos
 * bucket from the browser (owner-scoped RLS; a photo never transits our
 * server), then the object path rides along on the action. If the save is
 * refused, the just-uploaded object is removed best-effort. Every eligible
 * member may add one — including children (owner directive 07/2026): the
 * bucket is per-account and private, and photos never leave this journey page
 * (masked by default, signed URLs only, never on a shared surface or in admin).
 */
export function WeighInForm({
  memberId,
  memberName,
  userId,
  lastWeightKg,
  ownerSex,
}: {
  memberId: string;
  memberName: string | null;
  userId: string;
  lastWeightKg: number | null;
  // The form addresses the account OWNER (the one logging) → owner's sex.
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [revealed, setRevealed] = useState(false);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs leak without an explicit revoke on replace/unmount.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function pickPhoto(file: File | null) {
    if (!file) {
      setPhoto(null);
      setPhotoPreview(null);
      return;
    }
    if (!PHOTO_EXT_BY_MIME[file.type]) {
      setMessage(g("اختاري صورة بصيغة JPG أو PNG أو WebP", "اختر صورة بصيغة JPG أو PNG أو WebP"));
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setMessage("الصورة كبيرة — الحد ٥ ميغابايت");
      return;
    }
    setMessage(null);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function submit() {
    const weightNum = Number(weight);
    if (!weight || Number.isNaN(weightNum)) {
      setMessage(g("أدخلي الوزن بالأرقام", "أدخل الوزن بالأرقام"));
      return;
    }
    const waistNum = waist ? Number(waist) : null;
    startTransition(async () => {
      let photoPath: string | null = null;
      if (photo) {
        const ext = PHOTO_EXT_BY_MIME[photo.type]!;
        photoPath = `${userId}/${memberId}-${crypto.randomUUID()}.${ext}`;
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(BODY_PHOTOS_BUCKET)
          .upload(photoPath, photo, { contentType: photo.type });
        if (uploadError) {
          setMessage(g("تعذر رفع الصورة، حاولي مرة أخرى أو احفظي بدونها", "تعذر رفع الصورة، حاول مرة أخرى أو احفظ بدونها"));
          return;
        }
      }
      const result = await logBodyWeight({
        member_id: memberId,
        weight_kg: weightNum,
        waist_cm: waistNum,
        photo_path: photoPath,
      });
      if (result.ok) {
        setSaved(true);
        setMessage(null);
        setWeight("");
        setWaist("");
        pickPhoto(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } else {
        // The save was refused — don't leave the fresh object stranded.
        if (photoPath) {
          const supabase = createClient();
          await supabase.storage
            .from(BODY_PHOTOS_BUCKET)
            .remove([photoPath])
            .catch(() => undefined);
        }
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
        <h2 className="font-bold text-brand-ink">
          {memberName ? `وزن ${memberName} اليوم؟` : "وزنك اليوم؟"}
        </h2>
        {lastWeightKg !== null && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-bold text-brand-purple-900 hover:bg-brand-lavender/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
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
            className="mt-1 w-full min-h-12 rounded-xl border border-brand-ink/15 bg-brand-surface px-4 font-bold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
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
            className="mt-1 w-full min-h-12 rounded-xl border border-brand-ink/15 bg-brand-surface px-4 font-bold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
          />
        </label>
      </div>

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          id="body-photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
        />
        {photoPreview ? (
          <div className="flex items-center gap-3">
            <img
              src={photoPreview}
              alt="معاينة صورة المتابعة"
              width={64}
              height={85}
              className="w-16 aspect-[3/4] object-cover rounded-xl border border-brand-ink/10"
            />
            <button
              type="button"
              onClick={() => {
                pickPhoto(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-bold text-brand-ink-muted hover:bg-brand-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
            >
              <X className="size-4" aria-hidden="true" />
              إزالة الصورة
            </button>
          </div>
        ) : (
          <label
            htmlFor="body-photo-input"
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-brand-purple-900 focus-within:ring-offset-2"
          >
            <Camera className="size-4" aria-hidden="true" />
            صورة للمتابعة (اختياري)
          </label>
        )}
        <p className="text-xs text-brand-ink-muted">
          الصورة تبقى في هذه الصفحة الخاصة فقط، ولا تظهر إلا بلمسة منك.
        </p>
      </div>

      {message && (
        <p role="alert" className="text-sm font-bold text-red-700">
          {message}
        </p>
      )}
      {saved && !message && (
        <p role="status" className="text-sm font-bold text-brand-purple-900">
          {memberName
            ? g("حُفظ الوزن — نلقاكِ الأسبوع القادم", "حُفظ الوزن — نلقاك الأسبوع القادم")
            : g("حُفظ وزنك — نلقاكِ الأسبوع القادم", "حُفظ وزنك — نلقاك الأسبوع القادم")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-12 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 font-bold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
      >
        {pending ? "يُحفظ…" : "حفظ"}
      </button>
      </form>
      <p className="text-xs text-brand-ink-muted">
        مرة واحدة في الأسبوع تكفي — ويمكنك التخطي متى شئتِ بلا أي تذكير مزعج.
      </p>
    </section>
  );
}
