"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/auth/logout";
      document.body.appendChild(form);
      form.submit();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      aria-label="تسجيل خروج"
      className="inline-flex items-center justify-center gap-2 min-h-11 min-w-11 sm:min-w-0 px-2.5 sm:px-3 rounded-full text-brand-ink-muted hover:text-brand-ink hover:bg-brand-surface text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <LogOut className="size-4" />
      )}
      <span className="hidden sm:inline">تسجيل خروج</span>
    </button>
  );
}
