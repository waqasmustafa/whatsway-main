
import { notifications, sentNotifications } from "@shared/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Request, Response } from "express";
import { db } from "server/db";
import { createNotification, sendNotificationToUsers, } from "server/services/firebaseNotification.service";


/**
 * Admin: Create a notification (draft)
 */
export const adminCreateNotification = async (req: Request, res: Response) => {
  try {
    const notif = await createNotification({
      ...req.body,
      createdBy: req.user.id,
    });

    res.json({ success: true, notification: notif });
  } catch (err) {
    console.error("Create Notification Error:", err);
    res.status(500).json({ error: "Failed to create notification" });
  }
};

/**
 * Admin: Send a notification
 */
export const adminSendNotification = async (req: Request, res: Response) => {
  try {
    const result = await sendNotificationToUsers(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Send Notification Error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
};

/**
 * Admin: Get all notifications
 */
export const adminGetNotifications = async (req: Request, res: Response) => {
  try {
    const list = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt));

    res.json(list);
  } catch (err) {
    console.error("Get Notifications Error:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
};



/**
 * User: Get all notifications
 */
export const userGetNotifications = async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: sentNotifications.id,
        isRead: sentNotifications.isRead,
        readAt: sentNotifications.readAt,
        sentAt: sentNotifications.sentAt,
        notification: notifications,
      })
      .from(sentNotifications)
      .innerJoin(
        notifications,
        eq(sentNotifications.notificationId, notifications.id)
      )
      .where(eq(sentNotifications.userId, req.user.id))
      .orderBy(desc(sentNotifications.sentAt));

    res.json(rows);
  } catch (err) {
    console.error("User Get Notifications Error:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
};

/**
 * User: Mark as read
 */
export const userMarkAsRead = async (req: Request, res: Response) => {
  try {
    await db
      .update(sentNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(sentNotifications.id, req.params.id),
          eq(sentNotifications.userId, req.user.id)
        )
      );

    res.json({ success: true });
  } catch (err) {
    console.error("Mark as Read Error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};


/**
 * User: Mark all read
 */
export const userMarkAllRead = async (req: Request, res: Response) => {
  try {
    await db
      .update(sentNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(sentNotifications.userId, req.user.id));

    res.json({ success: true });
  } catch (err) {
    console.error("Mark as Read Error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

/**
 * User: Unread count
 */
export const userUnreadCount = async (req: Request, res: Response) => {
  try {
    const list = await db
      .select()
      .from(sentNotifications)
      .where(
        and(
          eq(sentNotifications.userId, req.user!.id as string),
          eq(sentNotifications.isRead, false)
        )
      );

    res.json({ count: list.length });
  } catch (err) {
    console.error("Unread Count Error:", err);
    res.status(500).json({ error: "Failed to load unread count" });
  }
};

/**
 * Admin: Bulk delete notifications
 */
export const adminBulkDeleteNotifications = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid or empty IDs array" });
    }

    await db
      .delete(notifications)
      .where(inArray(notifications.id, ids));

    res.json({ success: true, message: "Notifications deleted successfully" });
  } catch (err) {
    console.error("Bulk Delete Notifications Error:", err);
    res.status(500).json({ error: "Failed to delete notifications" });
  }
};