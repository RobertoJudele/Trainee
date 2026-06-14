import { Request } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";

const requiredEnvVars: Record<string, string | undefined> = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  S3_ENDPOINT: process.env.S3_ENDPOINT, // R2 endpoint: https://<accountid>.r2.cloudflarestorage.com
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL, // public base, e.g. https://cdn.juroc.tech or https://pub-xxxx.r2.dev
};

// Check if all required variables are present
for (const [name, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
export const s3 = new S3Client({
  region: "auto", // R2 ignores region; "auto" is the documented value
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export const S3_CONFIG = {
  bucket: process.env.AWS_S3_BUCKET,
  get baseUrl() {
    // R2 public URL (r2.dev subdomain or a custom domain), not derived from bucket/region.
    return process.env.S3_PUBLIC_URL as string;
  },
};

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"));
  }
};

export const generateS3key = (
  req: Request,
  file: Express.Multer.File,
  folder: string,
  ext?: string
): string => {
  const userId = req.user.id;
  const timestamp = Date.now();
  const uuid = uuidv4().substring(0, 8);
  // Callers that re-encode the image (e.g. to JPEG via sharp) pass `ext` so the
  // stored key matches the actual bytes instead of the original upload extension.
  const extension = ext ?? file.originalname.split(".").pop()?.toLowerCase();

  return `${folder}/${userId}/${timestamp}-${uuid}.${extension}`;
};

// Memory-storage multer used by every upload that runs through sharp before being
// written to S3 (profile pictures, trainer gallery, certifications & awards).
// Files live in RAM as `file.buffer`; we cap raw uploads generously since sharp
// shrinks them afterwards. `files: 5` matches the per-request gallery limit.
export const uploadImageMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB per raw upload (pre-resize)
    files: 5,
  },
});

export const uploadProfilePicture = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET as string,
    // R2 has no per-object ACLs — public access is configured on the bucket.
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req: Request, file: Express.Multer.File, cb) => {
      const key = generateS3key(req, file, "profile-picture");
      cb(null, key as string);
    },
    metadata: (req: Request, file: Express.Multer.File, cb) => {
      cb(null, {
        fieldName: file.fieldname,
        originalName: file.originalname,
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString(),
        type: "profile-picture",
      });
    },
  }),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export const uploadTrainerImages = multer({
  storage: multerS3({
    s3: s3,
    bucket: S3_CONFIG.bucket as string,
    // R2 has no per-object ACLs — public access is configured on the bucket.
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req: Request, file: Express.Multer.File, cb) => {
      const key = generateS3key(req, file, "trainer-images");
      return key;
    },
    metadata: (req: Request, file: Express.Multer.File, cb) => {
      cb(null, {
        fieldName: file.fieldname,
        originalName: file.originalname,
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString(),
        type: "profile-picture",
      });
    },
  }),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for trainer images
    files: 5, // Max 5 images per request
  },
});
