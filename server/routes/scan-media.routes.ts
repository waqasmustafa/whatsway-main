import { Router } from "express";
import multer from "multer";
import { MediaStorageService } from "../services/media-storage.service";
import { asyncHandler } from "../middlewares/error.middleware";
import { createDOClient } from "../config/digitalOceanConfig";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * Endpoint to upload a file for WhatsApp Scan Inbox
 * Returns the public URL and media metadata
 */
router.post(
  "/api/scan-inbox/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const result = await MediaStorageService.uploadToR2(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Upload route error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to upload file to storage" 
      });
    }
  })
);

/**
 * Proxy route to serve private R2 media to the frontend
 */
router.get(
  "/api/scan-inbox/proxy",
  asyncHandler(async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).send("URL required");
    }

    try {
      const storage = await createDOClient();
      if (!storage) return res.status(500).send("Storage not configured");

      const urlObj = new URL(url);
      const { s3, bucket } = storage;
      
      // Extract key logic
      let key = urlObj.pathname.split('/').slice(2).join('/');
      if (urlObj.host.includes(bucket) && !urlObj.pathname.startsWith(`/${bucket}`)) {
        key = urlObj.pathname.substring(1);
      }

      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3.send(command);

      res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      if (response.Body) {
        (response.Body as any).pipe(res);
      } else {
        res.status(404).send("Not found");
      }
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy media");
    }
  })
);

export default router;
