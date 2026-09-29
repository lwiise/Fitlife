/**
 * Console primitives (Concept A). Presentational only — no hooks, no data —
 * so server and client components can both render them. The one exception is
 * LinkPending, a leaf client component that LinkTabs renders inside each link.
 * Styling lives in ../admin.css under `ad-*` classes.
 */
export { Pill, Flag, Dot, toneClass, type Tone } from "./Pill";
export { TierBadge, StatusPill, statusTone } from "./Badges";
export { Btn, BtnLink, TextLink, IconBtn, type BtnVariant } from "./Button";
export { Card, Panel, PanelHead, SecTitle, Label, Box, BoxTop } from "./Card";
export { Kv, KvItem } from "./Kv";
export { Stats3, type Stat } from "./Stats3";
export { Note, Empty, AuditLine, type NoteTone } from "./Note";
export { Kbd, Ltr, ArText } from "./Text";
export { Meter, widthClass } from "./Meter";
export { LinkTabs, type LinkTab } from "./LinkTabs";
export { LinkPending } from "./LinkPending";
export { Skeleton, SkeletonGroup, type SkeletonShape } from "./Skeleton";
export { Avatar, initialOf } from "./Avatar";
