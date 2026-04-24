import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createDOClient } from "../config/digitalOceanConfig";
import { randomUUID } from "crypto";
import path from "path";

export class MediaStorageService {
  /**
   * Uploads a buffer to Cloudflare R2
   * @param buffer File buffer
   * @param originalName Original filename
   * @param mimeType Mime type
   * @returns Public URL of the uploaded file
   */
  static async uploadFile(buffer: Buffer, originalName: string, mimeType: string): Promise<string | null> {
    const config = await createDOClient();
    if (!config) {
      console.error("[MediaStorage] Storage configuration is not active or missing");
      return null;
    }

    const { s3, bucket, endpoint } = config;
    const fileExtension = path.extname(originalName);
    const fileName = `${randomUUID()}${fileExtension}`;
    const key = `inbox-media/${fileName}`;

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ACL: "public-read", // Ensure it's accessible
        })
      );

      // Construct public URL
      // Endpoint usually looks like https://<bucket>.<account-id>.r2.cloudflarestorage.com
      // We want to return the direct link
      const publicUrl = `${endpoint}/${bucket}/${key}`;
      console.log(`[MediaStorage] File uploaded successfully: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error("[MediaStorage] Error uploading to R2:", error);
      return null;
    }
  }
}
