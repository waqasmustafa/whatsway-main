import { Router } from "express";
import { db } from "../db";
import { scanAutoReplies, scanAutoReplyLogs, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanAutoReplyRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  // GET all auto replies for current user (superadmin sees all with owner info)
  router.get("/", async (req, res) => {
    try {
      const isSuper = req.user!.role === "superadmin";

      if (isSuper) {
        const replies = await db
          .select({
            id: scanAutoReplies.id,
            userId: scanAutoReplies.userId,
            name: scanAutoReplies.name,
            content: scanAutoReplies.content,
            status: scanAutoReplies.status,
            createdAt: scanAutoReplies.createdAt,
            updatedAt: scanAutoReplies.updatedAt,
            ownerName: users.username,
          })
          .from(scanAutoReplies)
          .leftJoin(users, eq(scanAutoReplies.userId, users.id))
          .orderBy(desc(scanAutoReplies.createdAt));

        return res.json(replies);
      }

      const replies = await db
        .select()
        .from(scanAutoReplies)
        .where(eq(scanAutoReplies.userId, req.user!.id))
        .orderBy(desc(scanAutoReplies.createdAt));

      res.json(replies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch auto replies" });
    }
  });

  // POST create new auto reply (admin only)
  router.post("/", async (req, res) => {
    try {
      if (req.user!.role === "superadmin") {
        return res.status(403).json({ error: "Superadmin cannot create auto replies" });
      }

      const { name, content } = req.body;
      if (!name || !content) {
        return res.status(400).json({ error: "Name and content are required" });
      }

      const [created] = await db
        .insert(scanAutoReplies)
        .values({
          userId: req.user!.id,
          name: name.trim(),
          content: content.trim(),
          status: "active",
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to create auto reply" });
    }
  });

  // PATCH update status (active/inactive)
  router.patch("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ error: "Status must be active or inactive" });
      }

      const [updated] = await db
        .update(scanAutoReplies)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(scanAutoReplies.id, id), eq(scanAutoReplies.userId, req.user!.id)))
        .returning();

      if (!updated) return res.status(404).json({ error: "Auto reply not found" });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update auto reply" });
    }
  });

  // DELETE auto reply
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await db
        .delete(scanAutoReplies)
        .where(and(eq(scanAutoReplies.id, id), eq(scanAutoReplies.userId, req.user!.id)));

      res.json({ message: "Auto reply deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete auto reply" });
    }
  });

  app.use("/api/scan-auto-replies", router);
};
