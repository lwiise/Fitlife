"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  CalendarDays,
  ChevronDown,
  CreditCard,
  Home,
  LineChart,
  LogOut,
  Mail,
  MessageCircleMore,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { AvatarPhoto, initialOf } from "@/components/ui/avatar";
import { activeNavKey, isFocusRoute, NAV_ITEMS, type NavKey } from "./nav";

const ICONS: Record<NavKey, typeof Home> = {
  home: Home,
  plan: CalendarDays,
  chat: MessageCircleMore,
  family: Users,
  account: UserRound,
};

/**
 * The signed-in app frame (09/2026 redesign): one header and one navigation
 * for every page, replacing nine hand-rolled top bars and the hub-and-spoke
 * «لوحة التحكم» back links. Phones get a bottom tab bar (thumb reach, 70% of
 * sessions); desktop gets the same five destinations inline in the header.
 * Focus flows (wizard, cook's view) render bare — see FOCUS_PREFIXES.
 */
export function AppShell({
  children,
  displayName,
  photoSrc,
}: {
  children: ReactNode;
  displayName: string | null;
  /** The owner's profile photo, or null for the initial. */
  photoSrc: string | null;
}) {
  const pathname = usePathname() ?? "";
  if (isFocusRoute(pathname)) return <>{children}</>;
  const active = activeNavKey(pathname);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-brand-purple-900 focus:px-4 focus:py-2.5 focus:font-bold focus:text-white"
      >
        تخطَّ إلى المحتوى
      </a>
      <header data-app-header="" className="sticky top-0 z-30 border-b border-brand-line bg-brand-card/95 backdrop-blur supports-[backdrop-filter]:bg-brand-card/85">
        <div className="container-shell flex h-[60px] items-center justify-between gap-4 lg:h-[4.5rem]">
          <div className="flex items-center gap-9">
            <Link
              href="/dashboard"
              aria-label="فت لايف — الرئيسية"
              className="-ms-1 inline-flex min-h-11 items-center rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            >
              <Logo variant="compact" className="h-9 w-auto lg:h-10" priority />
            </Link>
            <nav aria-label="التنقل الرئيسي" className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {NAV_ITEMS.filter((i) => i.key !== "account").map((item) => {
                  const Icon = ICONS[item.key];
                  const on = active === item.key;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={on ? "page" : undefined}
                        className={clsx(
                          "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-bold transition-colors motion-reduce:transition-none",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900",
                          on
                            ? "bg-brand-tint text-brand-purple-900"
                            : "text-brand-ink-muted hover:bg-brand-tint/60 hover:text-brand-ink",
                        )}
                      >
                        <Icon className="size-[18px]" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
          <AccountMenu
            displayName={displayName}
            photoSrc={photoSrc}
            active={active === "account"}
          />
        </div>
      </header>

      <div id="main-content">
        {children}
      </div>

      <nav
        aria-label="التنقل الرئيسي"
        data-app-tabbar=""
        className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-brand-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-brand-card/90 lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1.5 pb-2.5">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.key];
            const on = active === item.key;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={clsx(
                    "group flex min-h-[3.25rem] flex-col items-center justify-center gap-[3px] rounded-xl text-[13px] font-bold",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900",
                    on ? "text-brand-purple-900" : "text-brand-ink-muted",
                  )}
                >
                  <span
                    className={clsx(
                      "grid h-7 w-12 place-items-center rounded-full transition-colors motion-reduce:transition-none",
                      on ? "bg-brand-tint" : "group-hover:bg-brand-tint/60",
                    )}
                  >
                    <Icon className="size-[21px]" strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

const MENU_LINKS = [
  { href: "/profile", label: "ملفي الشخصي", icon: UserRound },
  { href: "/journey", label: "الوزن والمتابعة", icon: LineChart },
  { href: "/recap", label: "رسالتكم الأسبوعية", icon: Mail },
  { href: "/subscription", label: "الاشتراك", icon: CreditCard },
  { href: "/settings", label: "الإعدادات", icon: Settings },
] as const;

/** Account disclosure: the long tail of destinations, plus logout (which used
 * to sit in the top bar of three pages, one tap from a mis-press). */
function AccountMenu({
  displayName,
  photoSrc,
  active,
}: {
  displayName: string | null;
  photoSrc: string | null;
  active: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // The menu remembers WHICH page it was opened on, so navigating anywhere
  // closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn !== null && openOn === pathname;
  const setOpen = (v: boolean | ((cur: boolean) => boolean)) =>
    setOpenOn((cur) => {
      const was = cur !== null && cur === pathname;
      const next = typeof v === "function" ? v(was) : v;
      return next ? pathname : null;
    });

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = initialOf(displayName);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex min-h-11 items-center gap-1 rounded-full ps-1 pe-0.5 lg:gap-1.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900",
          active || open ? "bg-brand-tint" : "hover:bg-brand-tint/60",
        )}
      >
        <span
          aria-hidden="true"
          className="relative grid size-9 place-items-center rounded-full bg-brand-pink text-[15px] font-extrabold text-white lg:size-10 lg:text-base"
        >
          {initial}
          {photoSrc && <AvatarPhoto src={photoSrc} px={40} />}
        </span>
        <ChevronDown className="size-4 text-brand-ink-muted" aria-hidden="true" />
        <span className="sr-only">حساب {displayName ?? ""}، القائمة</span>
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-brand-line bg-brand-card p-2 shadow-[0_18px_40px_-18px_rgba(26,16,35,0.35)]"
        >
          <ul>
            {MENU_LINKS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-bold text-brand-ink hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                >
                  <Icon className="size-[18px] text-brand-purple-900" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <form action="/auth/logout" method="post" className="mt-1 border-t border-brand-line pt-1">
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-bold text-critical hover:bg-critical-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical"
            >
              <LogOut className="size-[18px]" aria-hidden="true" />
              تسجيل الخروج
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
