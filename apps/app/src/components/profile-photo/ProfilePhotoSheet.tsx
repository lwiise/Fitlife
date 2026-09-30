"use client";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { clsx } from "clsx";
import { Camera, Check, Loader2, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AvatarPhoto, avatarColor, initialOf } from "@/components/ui/avatar";
import { genderPick } from "@/lib/copy/gender";
import { OWNER_PHOTO_SUBJECT } from "@/lib/profilePhoto/shared";
import { prepareProfilePhoto } from "@/lib/profilePhoto/prepare";
import {
  removeProfilePhoto,
  saveProfilePhoto,
  type ProfilePhotoResult,
} from "@/lib/profilePhoto/actions";

/** One person whose photo can be set: the owner ("mom") or a beneficiary. */
export interface PhotoPerson {
  /** "mom" or a family_members id. */
  id: string;
  name: string;
  /** Roster position — the avatar colour behind the initial. */
  rosterIndex: number;
  /** Their current photo URL, or null. */
  src: string | null;
}

// A phone's camera original is 3–12 MB; anything far beyond that is not a
// photo worth decoding in a browser tab. The SAVED square is tens of KB.
const RAW_MAX_BYTES = 40 * 1024 * 1024;

const DECODE_ERROR_AR = "تعذّرت قراءة هذه الصورة، يرجى اختيار صورة أخرى";
const TOO_LARGE_AR = "الصورة كبيرة جداً، يرجى اختيار صورة أخرى";
const NETWORK_ERROR_AR = "تعذّر الاتصال، يرجى المحاولة مرة أخرى";

/**
 * A large avatar: the initial on the roster colour, the photo over it. Built
 * here rather than with <Avatar>, whose text sizes cannot be overridden
 * upward reliably (see Avatar's size note).
 */
export function LargeAvatar({
  person,
  src,
  className,
}: {
  person: PhotoPerson;
  src: string | null;
  /** Box and initial size, e.g. "size-16 text-2xl". */
  className: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "relative grid shrink-0 place-items-center rounded-full font-extrabold text-white",
        avatarColor(person.rosterIndex),
        className,
      )}
    >
      {initialOf(person.name)}
      {src && <AvatarPhoto src={src} px={112} />}
    </span>
  );
}

/**
 * Set, replace or remove one person's profile photo. The photo is prepared in
 * the browser (square crop, small WebP, metadata dropped), previewed exactly
 * as it will be stored, and only saved on «حفظ الصورة».
 */
export function ProfilePhotoSheet({
  open,
  onClose,
  person,
  ownerSex,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  person: PhotoPerson;
  /** profiles.sex → the owner-directed title. */
  ownerSex?: string | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const g = genderPick(ownerSex);
  const isOwner = person.id === OWNER_PHOTO_SUBJECT;
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ blob: Blob; url: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = preparing || pending;

  // Object URLs leak without an explicit revoke on replace/unmount.
  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked.url);
  }, [picked]);

  function close() {
    setPicked(null);
    setError(null);
    onClose();
  }

  async function onFile(file: File | undefined) {
    // Clear the input so choosing the same file again still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (file.size > RAW_MAX_BYTES) {
      setError(TOO_LARGE_AR);
      return;
    }
    setError(null);
    setPreparing(true);
    try {
      const blob = await prepareProfilePhoto(file);
      setPicked({ blob, url: URL.createObjectURL(blob) });
    } catch {
      // PhotoDecodeError, or a canvas the browser refused: either way the
      // file cannot become a photo here.
      setError(DECODE_ERROR_AR);
    } finally {
      setPreparing(false);
    }
  }

  function run(action: () => Promise<ProfilePhotoResult>) {
    startTransition(async () => {
      const result = await action().catch(
        (): ProfilePhotoResult => ({ ok: false, error: NETWORK_ERROR_AR }),
      );
      if (result.ok) close();
      else setError(result.error);
    });
  }

  function save() {
    if (!picked) return;
    const form = new FormData();
    form.set("member_id", person.id);
    form.set("photo", picked.blob, picked.blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
    run(() => saveProfilePhoto(form));
  }

  const shown = picked?.url ?? person.src;
  const choose = () => inputRef.current?.click();

  return (
    <Sheet
      open={open}
      onClose={close}
      title={isOwner ? g("صورتكِ", "صورتك") : `صورة ${person.name}`}
      subtitle="تظهر داخل حسابكم فقط، بجانب الاسم في الخطة وموسم بيتنا."
      returnFocusRef={returnFocusRef}
    >
      <div className="flex flex-col items-center gap-4 px-2 pb-2 pt-3">
        <span className="relative">
          <LargeAvatar person={person} src={shown} className="size-28 text-4xl" />
          {preparing && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-brand-ink/40">
              <Loader2
                className="size-7 animate-spin text-white motion-reduce:animate-none"
                aria-hidden="true"
              />
            </span>
          )}
        </span>

        <p className="min-h-[1.5em] text-center text-meta text-brand-ink-muted" aria-live="polite">
          {preparing ? "نجهّز الصورة…" : picked ? "هكذا ستظهر الصورة." : null}
        </p>

        {error && (
          <p role="alert" className="text-center text-meta font-bold text-critical">
            {error}
          </p>
        )}

        <div className="flex w-full flex-col gap-2">
          {picked ? (
            <>
              <Button block onClick={save} disabled={busy}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
                حفظ الصورة
              </Button>
              <Button variant="secondary" block onClick={choose} disabled={busy}>
                اختيار صورة أخرى
              </Button>
            </>
          ) : (
            <>
              <Button block onClick={choose} disabled={busy}>
                <Camera className="size-4" aria-hidden="true" />
                {person.src ? "تغيير الصورة" : "اختيار صورة"}
              </Button>
              {person.src && (
                // Not <Button variant="quiet">: that sets the purple text
                // colour, and two colour utilities do not merge reliably.
                <button
                  type="button"
                  onClick={() => run(() => removeProfilePhoto(person.id))}
                  disabled={busy}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold text-critical transition-colors hover:bg-critical-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-4" aria-hidden="true" />
                  )}
                  إزالة الصورة
                </button>
              )}
            </>
          )}
        </div>

        {/* Opened by the buttons above: a real button keeps the keyboard path
            and the focus ring that a styled <label> would not have. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
    </Sheet>
  );
}
