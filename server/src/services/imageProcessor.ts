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
import sharp from "sharp";

export interface ProcessedImage {
  buffer: Buffer;
  contentType: "image/jpeg";
}

const JPEG_OPTS = { quality: 80, mozjpeg: true } as const;

export async function processProfileImage(input: Buffer): Promise<ProcessedImage> {
  const buffer = await sharp(input)
    .rotate() // honor EXIF orientation before resizing
    .resize(512, 512, { fit: "cover" })
    .jpeg(JPEG_OPTS)
    .toBuffer();
  return { buffer, contentType: "image/jpeg" };
}

export async function processGalleryImage(input: Buffer): Promise<ProcessedImage> {
  const buffer = await sharp(input)
    .rotate()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .jpeg(JPEG_OPTS)
    .toBuffer();
  return { buffer, contentType: "image/jpeg" };
}

export async function processCredentialImage(input: Buffer): Promise<ProcessedImage> {
  const buffer = await sharp(input)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg(JPEG_OPTS)
    .toBuffer();
  return { buffer, contentType: "image/jpeg" };
}
