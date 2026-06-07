"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

/**
 * The single client island in the subscriber table: search box + tier/status
 * selects. Each change rewrites the query string (resetting to page 1); the
 * server re-renders the filtered/sorted table. Search is debounced.
 */
export function FilterBar({
  tiers,
  statuses,
  labels,
}: {
  tiers: Option[];
  statuses: Option[];
  labels: {
    search: string;
    tier: string;
    status: string;
    all: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const firstRender = useRef(true);

  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // any filter change returns to the first page
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  };

  // Debounce the free-text search so we don't push on every keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => apply({ search }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectClass =
    "h-11 rounded-lg border border-brand-ink/15 bg-surface-elevated px-3 text-sm text-brand-ink focus-visible:border-brand-purple-900";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative grow sm:grow-0">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-brand-ink-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="h-11 w-full rounded-lg border border-brand-ink/15 bg-surface-elevated ps-9 pe-3 text-sm text-brand-ink placeholder:text-brand-ink-muted focus-visible:border-brand-purple-900 sm:w-72"
        />
      </div>

      <select
        aria-label={labels.tier}
        value={params.get("tier") ?? ""}
        onChange={(e) => apply({ tier: e.target.value })}
        className={selectClass}
      >
        <option value="">{labels.tier}: {labels.all}</option>
        {tiers.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        aria-label={labels.status}
        value={params.get("status") ?? ""}
        onChange={(e) => apply({ status: e.target.value })}
        className={selectClass}
      >
        <option value="">{labels.status}: {labels.all}</option>
        {statuses.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
