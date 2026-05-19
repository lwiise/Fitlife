"use client";

/**
 * Placeholder choose-tier button. Real Lemonsqueezy checkout wiring arrives
 * in Prompt 2.0b. Until then, clicking shows an Arabic "coming soon" alert.
 */
export function ChooseTierButton({ tierName }: { tierName: string }) {
  function handleClick() {
    window.alert("قريباً — جاري تجهيز الدفع");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-6 inline-flex items-center justify-center bg-brand-ink hover:bg-brand-purple-900 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors min-h-[3rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    >
      اختاري {tierName}
    </button>
  );
}
