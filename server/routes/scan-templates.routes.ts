import { Router } from "express";
import { db } from "../db";
import { scanTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanTemplateRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  // Get all templates
  router.get("/", async (req, res) => {
    try {
      const templates = await db.select()
        .from(scanTemplates)
        .where(eq(scanTemplates.userId, req.user!.id));
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Create new template
  router.post("/", async (req, res) => {
    try {
      const { name, content } = req.body;
      if (!name || !content) return res.status(400).send("Name and content are required");

      const [template] = await db.insert(scanTemplates).values({
        userId: req.user!.id,
        name,
        content
      }).returning();

      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Delete template
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(scanTemplates).where(eq(scanTemplates.id, id));
      res.json({ message: "Template deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  app.use("/api/scan-templates", router);
};
