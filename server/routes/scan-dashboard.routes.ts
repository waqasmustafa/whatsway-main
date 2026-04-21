import { Router } from "express";
import { db } from "../db";
import { 
  scanTemplates, 
  scanContacts, 
  scanCampaigns, 
  scanWhatsappDevices,
  users
} from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanDashboardRoutes = (app: any) => {
  const router = Router();

  router.use(requireAuth);

  router.get("/stats", async (req, res) => {
    try {
      const isSuper = req.user!.role === "superadmin";
      const userId = req.user!.id;

      const whereClause = isSuper ? undefined : eq(scanTemplates.userId, userId);
      const contactWhere = isSuper ? undefined : eq(scanContacts.userId, userId);
      const campaignWhere = isSuper ? undefined : eq(scanCampaigns.userId, userId);

      // 1. Get counts
      const [templatesCount] = await db.select({ count: sql`count(*)` }).from(scanTemplates).where(whereClause);
      const [contactsCount] = await db.select({ count: sql`count(*)` }).from(scanContacts).where(contactWhere);
      const [campaignsCount] = await db.select({ count: sql`count(*)` }).from(scanCampaigns).where(campaignWhere);

      // 2. Get devices
      let devices;
      if (isSuper) {
        // Superadmin sees all with owner info
        devices = await db.select({
          id: scanWhatsappDevices.id,
          name: scanWhatsappDevices.name,
          phoneNumber: scanWhatsappDevices.phoneNumber,
          status: scanWhatsappDevices.status,
          lastSeen: scanWhatsappDevices.lastSeen,
          ownerName: users.username
        })
        .from(scanWhatsappDevices)
        .leftJoin(users, eq(scanWhatsappDevices.userId, users.id))
        .orderBy(desc(scanWhatsappDevices.createdAt));
      } else {
        devices = await db.select()
          .from(scanWhatsappDevices)
          .where(eq(scanWhatsappDevices.userId, userId))
          .orderBy(desc(scanWhatsappDevices.createdAt));
      }

      res.json({
        stats: {
          templates: Number(templatesCount?.count || 0),
          contacts: Number(contactsCount?.count || 0),
          campaigns: Number(campaignsCount?.count || 0)
        },
        devices: devices.map((d: any) => ({
          id: d.id,
          name: d.name,
          phoneNumber: d.phoneNumber,
          status: d.status,
          lastSeen: d.lastSeen,
          ownerName: d.ownerName
        }))
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.use("/api/scan-dashboard", router);
};
