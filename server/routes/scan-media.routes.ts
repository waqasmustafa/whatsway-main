import { Express } from "express";
import multer from "multer";
import { MediaStorageService } from "../services/media-storage.service";
import { db } from "../db";
import { scanMessages, scanConversations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { whatsappManager } from "../services/whatsapp.service";

// Use memory storage for multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB limit
  }
});

export function registerScanMediaRoutes(app: Express) {
  /**
   * Upload media and send via WhatsApp
   */
  app.post("/api/scan-inbox/upload", upload.single("file"), async (req, res) => {
    try {
      const { conversationId, deviceId, userId } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ message: "No file uploaded" });
      if (!conversationId || !deviceId) return res.status(400).json({ message: "Missing conversationId or deviceId" });

      console.log(`[ScanMedia] Uploading file for conversation ${conversationId}...`);

      // 1. Upload to Cloudflare R2
      const mediaUrl = await MediaStorageService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      if (!mediaUrl) {
        return res.status(500).json({ message: "Failed to upload file to storage" });
      }

      // 2. Get conversation details to find remoteNumber
      const [conv] = await db.select().from(scanConversations).where(eq(scanConversations.id, conversationId)).limit(1);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });

      // 3. Send via WhatsApp
      const sock = await whatsappManager.getSession(deviceId);
      if (!sock) return res.status(500).json({ message: "WhatsApp device is not connected" });

      let mediaType: 'image' | 'video' | 'document' = 'document';
      if (file.mimetype.startsWith('image/')) mediaType = 'image';
      else if (file.mimetype.startsWith('video/')) mediaType = 'video';

      const waPayload: any = {};
      if (mediaType === 'image') waPayload.image = { url: mediaUrl };
      else if (mediaType === 'video') waPayload.video = { url: mediaUrl };
      else waPayload.document = { url: mediaUrl, fileName: file.originalname, mimetype: file.mimetype };

      const sentMsg = await sock.sendMessage(conv.remoteJid || `${conv.remoteNumber}@s.whatsapp.net`, waPayload);

      if (sentMsg) {
        // 4. Save to database
        const [newMessage] = await db.insert(scanMessages).values({
          userId: userId,
          conversationId: conversationId,
          senderDeviceId: deviceId,
          receiverNumber: conv.remoteNumber,
          direction: "outbound",
          content: `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}: ${file.originalname}]`,
          status: "sent",
          waMessageId: sentMsg.key.id,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          fileName: file.originalname,
          fileSize: file.size,
          sentAt: new Date()
        }).returning();

        // 5. Update conversation last message
        await db.update(scanConversations)
          .set({ 
            lastMessage: newMessage.content,
            lastMessageAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(scanConversations.id, conversationId));

        return res.json({ success: true, message: newMessage });
      }

      res.status(500).json({ message: "Failed to send message via WhatsApp" });
    } catch (error) {
      console.error("[ScanMedia] Upload error:", error);
      res.status(500).json({ message: "Internal server error during upload" });
    }
  });
}
