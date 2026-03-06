import { requireAuth } from "server/middlewares/auth.middleware";
import type { Express } from "express";
import {
  adminCreateNotification,
  adminGetNotifications,
  adminSendNotification,
  adminBulkDeleteNotifications,
  userGetNotifications,
  userMarkAsRead,
  userUnreadCount,
  userMarkAllRead
} from "../controllers/notification.controller";

export function registerNotificationsRoutes(app: Express) {
  app.post("/api/notifications", requireAuth, adminCreateNotification);

  // Send
  app.post("/api/notifications/:id/send", requireAuth, adminSendNotification);

  // List all
  app.get("/api/notifications/", requireAuth, adminGetNotifications);

  // List all user notifications
  app.get("/api/notifications/users/", requireAuth, userGetNotifications);

  // Mark as read
  app.post("/api/notifications/:id/read", requireAuth, userMarkAsRead);

  // Mark all read
  app.post("/api/notifications/mark-all", requireAuth, userMarkAllRead);

  // Unread count
  // Unread count
  app.get("/api/notifications/unread-count", requireAuth, userUnreadCount);

  // Delete bulk
  app.delete("/api/notifications/bulk", requireAuth, adminBulkDeleteNotifications);
}
