import type { Express } from "express";
import * as conversationsController from "../controllers/conversations.controller";
import { validateRequest } from "../middlewares/validation.middleware";
import { insertConversationSchema, PERMISSIONS } from "@shared/schema";
import { extractChannelId } from "../middlewares/channel.middleware";
import { storage } from "../storage";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware";
import { cancelConversationAutomation, getConversationAutomationStatus } from "server/controllers/webhooks.controller";

export function registerConversationRoutes(app: Express) {
  // Get unread count
  app.get('/api/conversations/unread-count', async (req, res) => {
    try {
      const activeChannel = await storage.getActiveChannel();
      if (!activeChannel) {
        return res.json({ count: 0 });
      }

      const conversations = await storage.getConversationsByChannel(activeChannel.id);
      const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

      res.json({ count: unreadCount });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.json({ count: 0 });
    }
  });

  // Get all conversations
  app.get("/api/conversations",
    extractChannelId,
    conversationsController.getConversations
  );

  // Get single conversation
  app.get("/api/conversations/:id", conversationsController.getConversation);

  // Create conversation
  app.post("/api/conversations",
    validateRequest(insertConversationSchema),
    conversationsController.createConversation
  );

  // Update conversation
  app.put("/api/conversations/:id", requireAuth,
    requirePermission(PERMISSIONS.INBOX_ASSIGN), conversationsController.updateConversation);

  // Bulk delete conversations
  app.post("/api/conversations/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No conversation IDs provided" });
      }
      for (const id of ids) {
        await storage.deleteConversation(id);
      }
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      console.error("Error bulk deleting conversations:", error);
      res.status(500).json({ message: "Failed to delete conversations" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", conversationsController.deleteConversation);


  // Mark conversation as read
  app.put("/api/conversations/:id/read", conversationsController.markAsRead);

  // Update conversation status
  app.patch("/api/conversations/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['open', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({
          message: 'Invalid status. Must be open, resolved, or closed'
        });
      }

      await storage.updateConversation(id, { status });
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating conversation status:', error);
      res.status(500).json({ message: 'Failed to update conversation status' });
    }
  });



  app.get('/api/conversations/:conversationId/automation-status', getConversationAutomationStatus);
  app.post('/api/conversations/:conversationId/cancel-automation', cancelConversationAutomation);

}