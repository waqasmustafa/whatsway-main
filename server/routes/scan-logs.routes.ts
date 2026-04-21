import { Router } from "express";
import { db } from "../db";
import { scanMessages, scanCampaigns, scanWhatsappDevices, users } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanLogsRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (req, res) => {
    try {
      const isSuper = req.user!.role === "superadmin";
      const userId = req.user!.id;

      const whereClause = isSuper ? undefined : eq(scanMessages.userId, userId);

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
        ownerName: users.username
      })
      .from(scanMessages)
      .innerJoin(scanCampaigns, eq(scanMessages.campaignId, scanCampaigns.id))
      .leftJoin(scanWhatsappDevices, eq(scanMessages.senderDeviceId, scanWhatsappDevices.id))
      .leftJoin(users, eq(scanMessages.userId, users.id))
      .where(whereClause)
      .orderBy(desc(scanMessages.createdAt))
      .limit(isSuper ? 1000 : 500); 

      res.json(logs);
    } catch (error) {
      console.error("Scan logs error:", error);
      res.status(500).json({ error: "Failed to fetch message logs" });
    }
  });

  app.use("/api/scan-logs", router);
};
