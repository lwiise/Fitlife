import { PROFILE_PHOTO_EDGE, squareCrop } from "./shared";

/**
 * Turn whatever the phone hands us (a 12 MP camera JPEG, a PNG screenshot, a
 * HEIC the browser can decode) into the small square the app stores: cropped
 * with `squareCrop`, scaled to PROFILE_PHOTO_EDGE, re-encoded as WebP (JPEG
 * where the browser cannot encode WebP — older Safari silently returns PNG for
 * an unsupported type, which is why the result's type is checked). Browser
 * only. Re-encoding also drops the original's metadata, GPS position included,
 * before anything leaves the device.
 *
 * Throws PhotoDecodeError when the browser cannot read the file as an image.
 */
export class PhotoDecodeError extends Error {}

// Surface colour (#EBEFF2) under the photo, so a transparent PNG does not show
// the avatar's initial through it.
const MATTE = "#EBEFF2";

type Source = { image: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: Blob): Promise<Source> {
  // createImageBitmap applies the EXIF orientation ("from-image" is the
  // default in current browsers; passed explicitly for older ones).
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to <img>, which decodes a few formats some
      // createImageBitmap implementations refuse.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new PhotoDecodeError();
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoDecodeError();
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function canvas(edge: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = edge;
  c.height = edge;
  const ctx = c.getContext("2d");
  if (!ctx) throw new PhotoDecodeError();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return [c, ctx];
}

export async function prepareProfilePhoto(file: Blob): Promise<Blob> {
  const src = await decode(file);
  try {
    const { sx, sy, size } = squareCrop(src.width, src.height);
    const edge = Math.min(PROFILE_PHOTO_EDGE, size);

    // The first stage is capped at 4× the target: a 48 MP photo's full square
    // is past iOS Safari's canvas area limit, where drawing silently yields
    // nothing. Then halve down to 2× the target — one big drawImage from
    // 1536 px to 384 px aliases on browsers that ignore imageSmoothingQuality.
    const first = Math.min(size, edge * 4);
    const [firstCanvas, firstCtx] = canvas(first);
    firstCtx.drawImage(src.image, sx, sy, size, size, 0, 0, first, first);
    let stage = firstCanvas;
    let current = first;
    while (current / 2 >= edge * 2) {
      const next = Math.round(current / 2);
      const [c, nctx] = canvas(next);
      nctx.drawImage(stage, 0, 0, current, current, 0, 0, next, next);
      stage = c;
      current = next;
    }

    const [out, octx] = canvas(edge);
    octx.fillStyle = MATTE;
    octx.fillRect(0, 0, edge, edge);
    octx.drawImage(stage, 0, 0, current, current, 0, 0, edge, edge);

    const webp = await toBlob(out, "image/webp", 0.85);
    if (webp && webp.type === "image/webp") return webp;
    const jpeg = await toBlob(out, "image/jpeg", 0.88);
    if (jpeg) return jpeg;
    throw new PhotoDecodeError();
  } finally {
    src.close();
  }
}
