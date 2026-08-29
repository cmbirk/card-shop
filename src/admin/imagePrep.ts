// Turn whatever gets dropped on the card form (Photos-app HEIC, a giant camera JPEG, a PNG
// screenshot) into a web-friendly JPEG before it goes to Storage: HEIC/HEIF → JPEG (native
// decode where the browser can — Safari — else heic2any's libheif WASM, loaded on demand),
// then downscale to ≤ MAX_EDGE px and re-encode.

const MAX_EDGE = 1600;
const QUALITY = 0.88;

export function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  return t === 'image/heic' || t === 'image/heif' || t === 'image/heic-sequence' || /\.(heic|heif)$/i.test(file.name);
}

async function decodeNative(file: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

/**
 * HEIC → bitmap. Two WASM decoders in a chain: heic-to (libheif 1.19 — handles newer iPhone
 * variants: 48 MP, 10-bit, multi-image) first, heic2any (older libheif) as a fallback.
 * Both are lazy chunks; only the first HEIC pays for the load.
 */
async function decodeHeic(file: File): Promise<ImageBitmap> {
  const errors: string[] = [];
  try {
    const { heicTo } = await import('heic-to');
    return await heicTo({ blob: file, type: 'bitmap' });
  } catch (e) {
    errors.push(`heic-to: ${(e as Error).message ?? e}`);
  }
  try {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
    const bmp = await decodeNative(Array.isArray(out) ? out[0] : out);
    if (bmp) return bmp;
    errors.push('heic2any: produced an unreadable JPEG');
  } catch (e) {
    const err = e as { message?: string; code?: number };
    errors.push(`heic2any: ${err.message ?? err.code ?? e}`);
  }
  console.warn('[imagePrep] HEIC decode failed', errors);
  throw new Error(`Couldn't decode this HEIC (${errors[0]}). Workaround: in Photos, File → Export → Export 1 Photo as JPEG, then drop that.`);
}

export interface PreparedScan {
  file: File;
  width: number;
  height: number;
  /** wider than tall → a horizontal card */
  landscape: boolean;
}

/** Any dropped image → a ≤1600px JPEG File (+ its dimensions). Throws a readable error for non-images. */
export async function prepareScan(file: File, onStage?: (s: string) => void): Promise<PreparedScan> {
  if (!file.type.startsWith('image/') && !isHeic(file)) throw new Error(`"${file.name}" isn't an image.`);
  let bitmap = await decodeNative(file);
  if (!bitmap && isHeic(file)) {
    onStage?.('converting HEIC…');
    bitmap = await decodeHeic(file);
  }
  if (!bitmap) throw new Error(`Couldn't read "${file.name}".`);
  onStage?.('resizing…');
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('JPEG encode failed.');
  const base = file.name.replace(/\.[^.]+$/, '') || 'scan';
  return { file: new File([blob], `${base}.jpg`, { type: 'image/jpeg' }), width: w, height: h, landscape: w > h * 1.05 };
}

/** Pull the first image file out of a drop/paste, incl. Photos.app drags (which arrive as items). */
export function fileFromDataTransfer(dt: DataTransfer | null): File | undefined {
  if (!dt) return undefined;
  const fromFiles = Array.from(dt.files ?? []).find((f) => f.type.startsWith('image/') || isHeic(f));
  if (fromFiles) return fromFiles;
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f && (f.type.startsWith('image/') || isHeic(f))) return f;
    }
  }
  return undefined;
}
