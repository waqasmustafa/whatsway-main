import { Router } from "express";
import { db } from "../db";
import { scanContacts, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanContactRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  // Get all contact lists
  router.get("/", async (req, res) => {
    try {
      const isSuper = req.user!.role === "superadmin";
      const userId = req.user!.id;

      let lists;
      if (isSuper) {
        // Superadmin sees all with owner info
        lists = await db.select({
          id: scanContacts.id,
          name: scanContacts.name,
          phoneNumbers: scanContacts.phoneNumbers,
          createdAt: scanContacts.createdAt,
          ownerName: users.username
        })
        .from(scanContacts)
        .leftJoin(users, eq(scanContacts.userId, users.id));
      } else {
        lists = await db.select()
          .from(scanContacts)
          .where(eq(scanContacts.userId, userId));
      }

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

  // Update contact list (name or phone numbers)
  router.patch("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phoneNumbers } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (phoneNumbers && Array.isArray(phoneNumbers)) updateData.phoneNumbers = phoneNumbers;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).send("No data provided for update");
      }

      const [updated] = await db.update(scanContacts)
        .set(updateData)
        .where(eq(scanContacts.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact list" });
    }
  });

  app.use("/api/scan-contacts", router);
};
