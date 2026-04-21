import { Router } from "express";
import { db } from "../db";
import { scanMessages, scanCampaigns, scanWhatsappDevices } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanLogsRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (req, res) => {
    try {
      const userId = req.user!.id;

      // Fetch messages with campaign and device info
      // Since Drizzle query doesn't easily support triple-join with filters in one findMany without complex relations, 
      // we'll use a clean select with joins.
      const logs = await db.select({
        id: scanMessages.id,
        receiverNumber: scanMessages.receiverNumber,
        content: scanMessages.content,
        status: scanMessages.status,
        errorReason: scanMessages.errorReason,
        sentAt: scanMessages.sentAt,
        createdAt: scanMessages.createdAt,
        campaignName: scanCampaigns.name,
        deviceName: scanWhatsappDevices.name,
      })
      .from(scanMessages)
      .innerJoin(scanCampaigns, eq(scanMessages.campaignId, scanCampaigns.id))
      .leftJoin(scanWhatsappDevices, eq(scanMessages.senderDeviceId, scanWhatsappDevices.id))
      .where(eq(scanCampaigns.userId, userId))
      .orderBy(desc(scanMessages.createdAt))
      .limit(500); // Limit to last 500 logs for performance

      res.json(logs);
    } catch (error) {
      console.error("Scan logs error:", error);
      res.status(500).json({ error: "Failed to fetch message logs" });
    }
  });

  app.use("/api/scan-logs", router);
};
