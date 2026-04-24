import { S3Client } from "@aws-sdk/client-s3";
import { storageSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "server/db";

export const createDOClient = async () => {
  try {
    console.log("🔍 Fetching storage settings from database...");
    
    const settings = await db
      .select()
      .from(storageSettings)
      .where(eq(storageSettings.isActive, true))
      .limit(1);

    if (!settings || settings.length === 0) {
      console.log("⚠️ No active storage settings found in database");
      return null;
    }

    const config = settings[0];
    
    // Clean the endpoint - remove bucket name if it's included
    let cleanEndpoint = config.endpoint.trim();
    
    // Remove trailing slash
    cleanEndpoint = cleanEndpoint.replace(/\/$/, '');
    
    // Extract base endpoint (remove bucket name ONLY if it's DigitalOcean)
    const urlParts = new URL(cleanEndpoint);
    const hostParts = urlParts.host.split('.');
    
    // DigitalOcean usually has 4+ parts: bucket.region.digitaloceanspaces.com
    // Cloudflare R2 has 4 parts: accountid.r2.cloudflarestorage.com (We MUST keep accountid)
    if (hostParts.length > 3 && urlParts.host.includes('digitaloceanspaces.com')) {
      // Remove the first part (bucket name) for DigitalOcean
      hostParts.shift();
      urlParts.host = hostParts.join('.');
      cleanEndpoint = urlParts.toString();
    }

    console.log("✅ Active storage settings found:");
    console.log(`   Provider: ${config.provider}`);
    console.log(`   Space Name: ${config.spaceName}`);
    console.log(`   Region: ${config.region}`);
    console.log(`   Original Endpoint: ${config.endpoint}`);
    console.log(`   Cleaned Endpoint: ${cleanEndpoint}`);
    console.log(`   Is Active: ${config.isActive}`);

    const s3Client = new S3Client({
      endpoint: cleanEndpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: false, // Use virtual-hosted-style URLs
    });

    console.log("✅ S3 Client created successfully");

    return {
      s3: s3Client,
      bucket: config.spaceName,
      endpoint: cleanEndpoint,
    };
  } catch (error) {
    console.error("❌ Error creating DO client:", error);
    return null;
  }
};