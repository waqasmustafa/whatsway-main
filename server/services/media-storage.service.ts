import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createDOClient } from "../config/digitalOceanConfig";
import { randomUUID } from "crypto";
import path from "path";

export class MediaStorageService {
  /**
   * Uploads a buffer to Cloudflare R2 bucket
   * @param buffer File content buffer
   * @param originalName Original filename
   * @param mimeType MIME type of the file
   * @returns Object with public URL and metadata
   */
  static async uploadToR2(buffer: Buffer, originalName: string, mimeType: string) {
    const storage = await createDOClient();
    
    if (!storage) {
      throw new Error("Storage configuration is not active or missing.");
    }

    const { s3, bucket, endpoint } = storage;
    
    // Create a unique filename to prevent collisions
    const fileExtension = path.extname(originalName) || "";
    const fileName = `${randomUUID()}${fileExtension}`;
    
    // Determine folder based on date
    const date = new Date();
    const folder = `whatsapp/media/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const key = `${folder}/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: "public-read", // Ensure it's publicly accessible
      });

      await s3.send(command);

      // Construct public URL
      // Endpoint usually looks like: https://bucket.region.digitaloceanspaces.com 
      // or https://account.r2.cloudflarestorage.com
      // For R2 with custom domains or public access:
      const publicUrl = `${endpoint}/${bucket}/${key}`;

      return {
        url: publicUrl,
        key: key,
        fileName: originalName,
        fileSize: buffer.length,
        mediaType: this.getMediaType(mimeType)
      };
    } catch (error) {
      console.error("Error uploading to R2:", error);
      throw error;
    }
  }

  /**
   * Helper to categorize MIME types into WhatsApp media types
   */
  private static getMediaType(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "document";
  }
}
