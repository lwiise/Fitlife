"use client";

import { useRef, useState } from "react";
import { Camera, ChevronLeft } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";
import { OWNER_PHOTO_SUBJECT } from "@/lib/profilePhoto/shared";
import { LargeAvatar, ProfilePhotoSheet, type PhotoPerson } from "./ProfilePhotoSheet";

/** The small camera disc on an avatar's lower corner: "this face is editable". */
function CameraBadge({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -bottom-0.5 -end-0.5 grid place-items-center rounded-full bg-brand-purple-900 text-white ring-2 ring-brand-card ${className}`}
    >
      <Camera className="size-[55%]" strokeWidth={2.5} />
    </span>
  );
}

function actionLabel(person: PhotoPerson, ownerSex?: string | null) {
  const g = genderPick(ownerSex);
  if (person.id === OWNER_PHOTO_SUBJECT) {
    return person.src ? g("تغيير صورتكِ", "تغيير صورتك") : g("إضافة صورتكِ", "إضافة صورتك");
  }
  return person.src ? `تغيير صورة ${person.name}` : `إضافة صورة ${person.name}`;
}

/**
 * A person's avatar in a list row (/family), tappable to set their photo.
 * 44 px — the row's tap-target floor — with a camera badge so an initial
 * reads as "add a photo here" rather than as decoration.
 */
export function AvatarPhotoButton({
  person,
  ownerSex,
}: {
  person: PhotoPerson;
  ownerSex?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={actionLabel(person, ownerSex)}
        className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-card"
      >
        <LargeAvatar person={person} src={person.src} className="size-11 text-base" />
        <CameraBadge className="size-[18px]" />
      </button>
      <ProfilePhotoSheet
        open={open}
        onClose={() => setOpen(false)}
        person={person}
        ownerSex={ownerSex}
        returnFocusRef={triggerRef}
      />
    </>
  );
}

/**
 * The photo card at the top of a person's own hub (/profile for the owner,
 * /family/edit/[id] for a member): the face large, one tap to change it.
 * One control — the whole card is the button — so a screen reader hears one
 * action, not an avatar button plus a text button for the same thing.
 */
export function ProfilePhotoCard({
  person,
  ownerSex,
}: {
  person: PhotoPerson;
  ownerSex?: string | null;
}) {
  const g = genderPick(ownerSex);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isOwner = person.id === OWNER_PHOTO_SUBJECT;
  const where = isOwner
    ? g("تظهر بجانب اسمكِ في الخطة وموسم بيتنا.", "تظهر بجانب اسمك في الخطة وموسم بيتنا.")
    : `تظهر بجانب اسم ${person.name} في الخطة وموسم بيتنا.`;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group flex w-full items-center gap-4 rounded-[1.375rem] border border-brand-line bg-brand-card p-4 text-start transition-colors hover:bg-brand-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 motion-reduce:transition-none sm:px-5"
      >
        <span className="relative shrink-0">
          <LargeAvatar person={person} src={person.src} className="size-16 text-2xl" />
          <CameraBadge className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-brand-ink">
            {actionLabel(person, ownerSex)}
          </span>
          <span className="mt-0.5 block text-meta text-brand-ink-muted">{where}</span>
        </span>
        <ChevronLeft
          className="size-5 shrink-0 text-brand-ink-muted group-hover:text-brand-purple-900"
          aria-hidden="true"
        />
      </button>
      <ProfilePhotoSheet
        open={open}
        onClose={() => setOpen(false)}
        person={person}
        ownerSex={ownerSex}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
