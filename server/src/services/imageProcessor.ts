// src/services/imageProcessor.ts
//
// Server-side image normalization with sharp. Every uploaded image is re-encoded
// here before it reaches S3/R2 so we never store raw multi-megabyte phone photos.
//
// Why re-encode on the server even though the app already compresses?
//   - Guarantees a predictable size/format regardless of client (old app versions,
//     web, a malicious client posting a 30MB PNG straight to the API).
//   - `.rotate()` bakes in the EXIF orientation, then `.jpeg()` drops all metadata,
//     so images never appear sideways and we don't leak camera GPS EXIF.
//
// Sizing rationale:
//   - profile:    square 512x512 (cover) — avatars are always shown small & cropped.
//   - gallery:    max 1280px long edge — looks crisp full-width on phones, small file.
//   - credential: max 1600px long edge — certificates/diplomas contain text that must
//                 stay legible when a client zooms in, so we keep more resolution.
//
// HEIC/HEIF handling:
//   Sharp is built without libheif in the standard Docker image, so iPhone photos
//   (.heic) crash it with "bad seek" or a missing-plugin error.  We detect those
//   mimetypes upfront and convert them to JPEG with `heic-convert` (pure-JS, no
//   native libheif needed) before handing the buffer to Sharp.
import sharp from "sharp";

// heic-convert is CJS-only; eslint-disable keeps the linter happy in a TS project.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const heicConvert = require("heic-convert");

export interface ProcessedImage {
  buffer: Buffer;
  contentType: "image/jpeg";
}

const JPEG_OPTS = { quality: 80, mozjpeg: true } as const;

const HEIC_MIMETYPES = new Set(["image/heic", "image/heif"]);

/**
 * Converts a HEIC/HEIF buffer to JPEG using heic-convert (pure-JS, no libheif).
 * Returns the original buffer unchanged for every other format.
 *
 * Call this before passing any upload to Sharp so that iPhone photos don't crash
 * the processor with "bad seek" / "Support for this compression format has not
 * been built in".
 */
export async function normalizeImageBuffer(
  buffer: Buffer,
  mimetype: string
): Promise<Buffer> {
  if (!HEIC_MIMETYPES.has(mimetype.toLowerCase())) {
    return buffer;
  }

  const jpegArrayBuffer: ArrayBuffer = await heicConvert({
    buffer: new Uint8Array(buffer),
    format: "JPEG",
    quality: 0.9,
  });

  return Buffer.from(jpegArrayBuffer);
}

export async function processProfileImage(
  input: Buffer,
  mimetype: string = "image/jpeg"
): Promise<ProcessedImage> {
  const normalized = await normalizeImageBuffer(input, mimetype);
  const buffer = await sharp(normalized)
    .rotate() // honor EXIF orientation before resizing
    .resize(512, 512, { fit: "cover" })
    .jpeg(JPEG_OPTS)
    .toBuffer();
  return { buffer, contentType: "image/jpeg" };
}

export async function processGalleryImage(
  input: Buffer,
  mimetype: string = "image/jpeg"
): Promise<ProcessedImage> {
  const normalized = await normalizeImageBuffer(input, mimetype);
  const buffer = await sharp(normalized)
    .rotate()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .jpeg(JPEG_OPTS)
    .toBuffer();
  return { buffer, contentType: "image/jpeg" };
}

export async function processCredentialImage(
  input: Buffer,
  mimetype: string = "image/jpeg"
): Promise<ProcessedImage> {
  const normalized = await normalizeImageBuffer(input, mimetype);
  const buffer = await sharp(normalized)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg(JPEG_OPTS)
    .toBuffer();
  return { buffer, contentType: "image/jpeg" };
}
