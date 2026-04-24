import { Router } from "express";
import multer from "multer";
import { MediaStorageService } from "../services/media-storage.service";
import { asyncHandler } from "../middlewares/error.middleware";

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

export default router;
