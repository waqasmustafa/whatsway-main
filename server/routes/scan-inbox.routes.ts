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

  // Delete conversations
  router.delete("/conversations", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No conversation IDs provided" });
      }

      // 1. Delete all messages associated with these conversations
      for (const id of ids) {
        await db.delete(scanMessages)
          .where(and(eq(scanMessages.conversationId, id), eq(scanMessages.userId, req.user!.id)));
      }

      // 2. Delete conversations
      for (const id of ids) {
        await db.delete(scanConversations)
          .where(and(eq(scanConversations.id, id), eq(scanConversations.userId, req.user!.id)));
      }

      res.json({ success: true, deletedCount: ids.length });
    } catch (error) {
      console.error("Delete conversation error:", error);
      res.status(500).json({ error: "Failed to delete conversations" });
    }
  });

  app.use("/api/scan-inbox", router);
};
