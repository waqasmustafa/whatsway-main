import { Router } from "express";
import { db } from "../db";
import { scanCampaigns, scanMessages, scanContacts } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanCampaignRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  // Get all campaigns
  router.get("/", async (req, res) => {
    try {
      const campaigns = await db.query.scanCampaigns.findMany({
        where: eq(scanCampaigns.userId, req.user!.id),
        orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)],
      });
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Create new campaign
  router.post("/", async (req, res) => {
    try {
      const { name, templateIds, contactListId, deviceIds, minDelay, maxDelay } = req.body;
      
      if (!name || !templateIds || !contactListId || !deviceIds) {
        return res.status(400).send("Missing required fields");
      }

      // 1. Get all contacts from the list
      const contactList = await db.query.scanContacts.findFirst({
        where: and(eq(scanContacts.id, contactListId), eq(scanContacts.userId, req.user!.id))
      });

      if (!contactList) return res.status(404).send("Contact list not found");

      const phoneNumbers = contactList.phoneNumbers as string[];
      if (phoneNumbers.length === 0) return res.status(400).send("Contact list is empty");

      // 2. Create the campaign record
      const [campaign] = await db.insert(scanCampaigns).values({
        userId: req.user!.id,
        name,
        templateIds,
        contactListId,
        deviceIds,
        minDelay: minDelay || 2,
        maxDelay: maxDelay || 5,
        totalRecipients: phoneNumbers.length,
        status: "draft"
      }).returning();

      // 3. Create individual messages (pending)
      // We don't assign template/device yet, worker will do it during rotation
      const messagesData = phoneNumbers.map(phone => ({
        campaignId: campaign.id,
        receiverNumber: phone,
        content: "Pending generation...", // Will be replaced by template content during send
        status: "pending"
      }));

      // Insert in chunks if list is large
      const chunkSize = 100;
      for (let i = 0; i < messagesData.length; i += chunkSize) {
        await db.insert(scanMessages).values(messagesData.slice(i, i + chunkSize));
      }

      res.json(campaign);
    } catch (error) {
      console.error("Create campaign error:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  // Start campaign
  router.post("/:id/start", async (req, res) => {
    try {
      const { id } = req.params;
      const [campaign] = await db.update(scanCampaigns)
        .set({ status: "running", updatedAt: new Date() })
        .where(and(eq(scanCampaigns.id, id), eq(scanCampaigns.userId, req.user!.id)))
        .returning();

      if (!campaign) return res.status(404).send("Campaign not found");
      
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to start campaign" });
    }
  });

  // Pause campaign
  router.post("/:id/pause", async (req, res) => {
    try {
      const { id } = req.params;
      const [campaign] = await db.update(scanCampaigns)
        .set({ status: "paused", updatedAt: new Date() })
        .where(and(eq(scanCampaigns.id, id), eq(scanCampaigns.userId, req.user!.id)))
        .returning();

      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to pause campaign" });
    }
  });

  // Delete campaign
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(scanCampaigns).where(and(eq(scanCampaigns.id, id), eq(scanCampaigns.userId, req.user!.id)));
      res.json({ message: "Campaign deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  app.use("/api/scan-campaigns", router);
};
