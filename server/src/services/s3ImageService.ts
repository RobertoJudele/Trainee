import { sendSuccess } from "src/utils/response";
import { s3, S3_CONFIG } from "../config/s3";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { S3 } from "aws-sdk";
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
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata.httpStatusCode === 404) {
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
