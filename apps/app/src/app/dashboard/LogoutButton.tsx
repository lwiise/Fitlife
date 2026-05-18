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
      className="inline-flex items-center gap-2 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      تسجيل خروج
    </button>
  );
}
