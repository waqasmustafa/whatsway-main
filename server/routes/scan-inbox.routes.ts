import { Router } from "express";
import { db } from "../db";
import { scanConversations, scanMessages, scanWhatsappDevices } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";
import { whatsappManager } from "../services/whatsapp.service";

export const registerScanInboxRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  // Get all conversations
  router.get("/conversations", async (req, res) => {
    try {
      const convs = await db.select({
        id: scanConversations.id,
        remoteNumber: scanConversations.remoteNumber,
        lastMessage: scanConversations.lastMessage,
        lastMessageAt: scanConversations.lastMessageAt,
        unreadCount: scanConversations.unreadCount,
        deviceId: scanConversations.deviceId,
        deviceName: scanWhatsappDevices.name,
        devicePhone: scanWhatsappDevices.phoneNumber
      })
      .from(scanConversations)
      .leftJoin(scanWhatsappDevices, eq(scanConversations.deviceId, scanWhatsappDevices.id))
      .where(eq(scanConversations.userId, req.user!.id))
      .orderBy(desc(scanConversations.lastMessageAt));

      res.json(convs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get messages for a conversation
  router.get("/messages/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      // Mark as read
      await db.update(scanConversations)
        .set({ unreadCount: 0 })
        .where(and(eq(scanConversations.id, conversationId), eq(scanConversations.userId, req.user!.id)));

      const messages = await db.select()
        .from(scanMessages)
        .where(and(eq(scanMessages.conversationId, conversationId), eq(scanMessages.userId, req.user!.id)))
        .orderBy(asc(scanMessages.createdAt));

      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send a reply
  router.post("/send", async (req, res) => {
    try {
      const { conversationId, text } = req.body;
      if (!conversationId || !text) return res.status(400).send("Missing fields");

      const conv = await db.query.scanConversations.findFirst({
        where: and(eq(scanConversations.id, conversationId), eq(scanConversations.userId, req.user!.id))
      });

      if (!conv || !conv.deviceId) return res.status(404).send("Conversation not found");

      // 1. Send via WhatsApp
      const result = await whatsappManager.sendMessage(conv.deviceId, conv.remoteNumber, text);
      
      // 2. Save message
      const [newMsg] = await db.insert(scanMessages).values({
        userId: req.user!.id,
        conversationId: conv.id,
        senderDeviceId: conv.deviceId,
        receiverNumber: conv.remoteNumber,
        direction: "outbound",
        content: text,
        status: "sent",
        waMessageId: result.key.id
      }).returning();

      // 3. Update conversation
      await db.update(scanConversations)
        .set({ 
          lastMessage: text, 
          lastMessageAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(scanConversations.id, conv.id));

      res.json(newMsg);
    } catch (error: any) {
      console.error("Send reply error:", error);
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  });

  app.use("/api/scan-inbox", router);
};
