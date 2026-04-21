import { Router } from "express";
import { db } from "../db";
import { scanContacts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanContactRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  // Get all contact lists
  router.get("/", async (req, res) => {
    try {
      const lists = await db.select()
        .from(scanContacts)
        .where(eq(scanContacts.userId, req.user!.id));
      res.json(lists);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contact lists" });
    }
  });

  // Create new contact list
  router.post("/", async (req, res) => {
    try {
      const { name, phoneNumbers } = req.body;
      if (!name || !phoneNumbers || !Array.isArray(phoneNumbers)) {
        return res.status(400).send("Name and phone numbers array are required");
      }

      const [list] = await db.insert(scanContacts).values({
        userId: req.user!.id,
        name,
        phoneNumbers
      }).returning();

      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contact list" });
    }
  });

  // Delete contact list
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(scanContacts).where(eq(scanContacts.id, id));
      res.json({ message: "Contact list deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contact list" });
    }
  });

  app.use("/api/scan-contacts", router);
};
