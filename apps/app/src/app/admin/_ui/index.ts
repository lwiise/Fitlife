/**
 * Console primitives (Concept A). Presentational only — no hooks, no data —
 * so server and client components can both render them. Two exceptions, both
 * client components that server pages can still render with plain props:
 * LinkTabs (it runs its navigation in a transition to show the pending state)
 * and LinkPending (the rail's per-link pending hint).
 * Styling lives in ../admin.css under `ad-*` classes.
 *
 * `./modalFocus` (dialog keyboard containment: trapTab, useEscapedKeys) is
 * client-only and deliberately NOT re-exported here — server components
 * import this index. Client components import it by path.
 */
export { Pill, Flag, Dot, toneClass, type Tone } from "./Pill";
export { TierBadge, StatusPill, statusTone } from "./Badges";
export { Btn, BtnLink, TextLink, IconBtn, type BtnVariant } from "./Button";
export { Card, Panel, PanelHead, SecTitle, Label, Box, BoxTop } from "./Card";
export { Kv, KvItem } from "./Kv";
export { Stats3, type Stat } from "./Stats3";
export { Note, Empty, AuditLine, type NoteTone } from "./Note";
export { Kbd, Ltr, ArText } from "./Text";
export { Sep, joinSep, Count } from "./Sep";
export { Meter, widthClass } from "./Meter";
export { LinkTabs, type LinkTab } from "./LinkTabs";
export { LinkPending } from "./LinkPending";
export { Skeleton, SkeletonGroup, type SkeletonShape } from "./Skeleton";
export { Avatar, initialOf } from "./Avatar";
