"use client";

import { useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { retryWorkoutGeneration } from "@/app/onboarding/workout/actions";
import { genderPick } from "@/lib/copy/gender";

export function RetryWorkoutButton({ ownerSex }: { ownerSex?: string | null }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => retryWorkoutGeneration())}
      disabled={isPending}
      className="mt-3 inline-flex items-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-11"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <RefreshCw className="size-4" aria-hidden="true" />
      )}
      {genderPick(ownerSex)("أعيدي المحاولة", "أعِد المحاولة")}
    </button>
  );
}
