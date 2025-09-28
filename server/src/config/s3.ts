import AWS from "aws-sdk";
import { Request } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";

const s3Config = new S3Client({
  region: "us-west-1",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});
export const S3_CONFIG = {
  bucket: process.env.AWS_S3_BUCKET,
  region: process.env.AWS_REGION,
  get baseUrl() {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
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

const generateS3key = (
  req: Request,
  file: Express.Multer.File,
  folder: string
): string => {
  const userId = req.user.id;
  const timestamp = Date.now();
  const uuid = uuidv4().substring(0, 8);
  const extension = file.originalname.split(".").pop()?.toLowerCase();

  return `${folder}/${userId}/${timestamp}-${uuid}.${extension}`;
};

export const uploadProfilePicture = multer({
  storage: multerS3({
    s3: s3Config,
    bucket: process.env.AWS_S3_BUCKET as string,
    acl: "public-read",
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
    s3: s3Config,
    bucket: process.env.AWS_S3_CONFIG as string,
    acl: "public-read",
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

export { S3Client };
