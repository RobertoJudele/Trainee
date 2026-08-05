import { sendSuccess } from "src/utils/response";
import { s3, S3_CONFIG } from "../config/s3";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
}

export interface ImageVariants {
  thumbnail: string; // 150x150
  small: string; // 300x300
  medium: string; // 600x600
  large: string; // 1200x1200
  original: string; // Original size
}

export class S3ImageService {
  static async deleteImage(key: string) {
    try {
      const data = await s3.send(
        new DeleteObjectCommand({ Bucket: S3_CONFIG.bucket, Key: key })
      );
      console.log(data);
      console.log(`✅ Deleted image: ${key}`);
    } catch (error) {
      console.log(`Failed deleting image ${key}`, error);
      throw new Error("Failed to delete image from S3");
    }
  }

  /**
   * Best-effort erasure for a set of stored image URLs.
   *
   * Deleting a row only removes the pointer — the object stays in the bucket and,
   * because the bucket is served publicly, stays fetchable by anyone holding the
   * URL. Account deletion has to reach the objects too.
   *
   * Never throws: it runs after the database transaction has committed, so the
   * account is already gone and a storage hiccup must not surface as a failed
   * deletion. Failures are logged for a later sweep.
   */
  static async deleteImagesByUrl(urls: (string | null | undefined)[]): Promise<void> {
    const keys = [...new Set(
      urls
        .filter((u): u is string => Boolean(u))
        .map((u) => this.extractKeyFromUrl(u))
        .filter((k): k is string => Boolean(k))
    )];
    if (keys.length === 0) return;

    // DeleteObjects caps at 1000 keys per call.
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
      try {
        const res = await s3.send(
          new DeleteObjectsCommand({
            Bucket: S3_CONFIG.bucket,
            Delete: { Objects: batch },
          })
        );
        if (res.Errors?.length) {
          console.warn("[s3] some objects failed to delete:", res.Errors);
        }
      } catch (error) {
        console.warn("[s3] batch delete failed:", error);
      }
    }
  }

  /**
   * Best-effort erasure of everything under a key prefix. Used for profile
   * pictures, where earlier uploads are superseded rather than removed, so the
   * row's current URL alone would leave older avatars behind. Never throws.
   */
  static async deleteImagesByPrefix(prefix: string): Promise<void> {
    try {
      let token: string | undefined;
      do {
        const listed = await s3.send(
          new ListObjectsV2Command({
            Bucket: S3_CONFIG.bucket,
            Prefix: prefix,
            ContinuationToken: token,
          })
        );
        const objects = (listed.Contents ?? [])
          .map((o) => o.Key)
          .filter((k): k is string => Boolean(k))
          .map((Key) => ({ Key }));

        if (objects.length > 0) {
          const res = await s3.send(
            new DeleteObjectsCommand({
              Bucket: S3_CONFIG.bucket,
              Delete: { Objects: objects },
            })
          );
          if (res.Errors?.length) {
            console.warn("[s3] some objects failed to delete:", res.Errors);
          }
        }
        token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (token);
    } catch (error) {
      console.warn(`[s3] prefix delete failed for ${prefix}:`, error);
    }
  }

  static getImageUrl(key: string) {
    return `${S3_CONFIG.baseUrl}/${key}`;
  }

  static getImageVariants(key: string): ImageVariants {
    const baseUrl = this.getImageUrl(key);

    // For now, return the same URL (you can add CloudFront transformations later)
    return {
      thumbnail: baseUrl, // In production, you'd have processed versions
      small: baseUrl,
      medium: baseUrl,
      large: baseUrl,
      original: baseUrl,
    };
  }

  static async uploadImage(
    buffer: Buffer,
    key: string,
    contentType: string = "image/jpeg"
  ): Promise<S3UploadResult> {
    try {
      if (!S3_CONFIG.bucket) {
        throw new Error("S3 bucket not configured");
      }

      const params = {
        Bucket: S3_CONFIG.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      };

      const command = new PutObjectCommand(params);

      await s3.send(command);

      return {
        key: key,
        url: this.getImageUrl(key),
        bucket: S3_CONFIG.bucket,
        size: buffer.length,
      };
    } catch (error) {
      console.error("Failed to upload image", error);
      throw new Error("Failed to upload image to S3");
    }
  }

  static async getImage(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_CONFIG.bucket,
        Key: key,
      });
      const response = await s3.send(command);
      if (response.Body instanceof Readable) {
        const chunks: Buffer[] = [];
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      }
      throw new Error("Invalid response body type");
    } catch (error) {
      console.error("Couldnt get image from s3 bucket", error);
      throw new Error("Error while getting image ");
    }
  }

  static extractKeyFromUrl(url: string) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1);
    } catch (error) {
      console.error("Error at extracting key from url", error);
      return null;
    }
  }

  static async imageExists(key: string) {
    const command = new HeadObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
    });
    try {
      await s3.send(command);
      console.log("File exists");
      return true;
    } catch (error: unknown) {
      const isNotFound =
        (error instanceof Error && error.name === "NotFound") ||
        (typeof error === "object" &&
          error !== null &&
          "$metadata" in error &&
          (error as { $metadata: { httpStatusCode?: number } }).$metadata
            .httpStatusCode === 404);
      if (isNotFound) {
        return false;
      }
      throw error;
    }
  }

  //   static async createDifferentSizeImages(
  //     originalKey: string
  //   ): Promise<ImageVariants> {
  //     const originalImage = await this.getImage(originalKey);
  //     const sizes = {
  //       thumbnail: { width: 150, height: 150 },
  //       small: { width: 300, height: 300 },
  //       medium: { width: 600, height: 600 },
  //       large: { width: 1200, height: 1200 },
  //     };
  //   }
}
