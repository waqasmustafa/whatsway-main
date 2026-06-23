import { Router } from "express";
import { db } from "../db";
import { scanWhatsappDevices } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { whatsappManager } from "../services/whatsapp.service";
import { requireAuth } from "../middlewares/auth.middleware";

export const registerScanWhatsappRoutes = (app: any) => {
  const router = Router();

  // Use the same auth middleware as the rest of the project
  router.use(requireAuth);

  // Get all devices for the current user
  router.get("/devices", async (req, res) => {
    try {
      const devices = await db.select().from(scanWhatsappDevices).where(eq(scanWhatsappDevices.userId, req.user!.id));
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  // Create a new device placeholder
  router.post("/devices", async (req, res) => {
    try {
      const { name, proxyHost, proxyPort, proxyUsername, proxyPassword } = req.body;
      if (!name) return res.status(400).send("Name is required");

      const [device] = await db.insert(scanWhatsappDevices).values({
        userId: req.user!.id,
        name,
        status: "disconnected",
        proxyHost: proxyHost || null,
        proxyPort: proxyPort ? parseInt(proxyPort) : null,
        proxyUsername: proxyUsername || null,
        proxyPassword: proxyPassword || null,
      }).returning();

      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to create device" });
    }
  });

  // Update proxy settings for a device
  router.patch("/devices/:id/proxy", async (req, res) => {
    try {
      const { id } = req.params;
      const { proxyHost, proxyPort, proxyUsername, proxyPassword } = req.body;

      const [device] = await db.update(scanWhatsappDevices)
        .set({
          proxyHost: proxyHost || null,
          proxyPort: proxyPort ? parseInt(proxyPort) : null,
          proxyUsername: proxyUsername || null,
          proxyPassword: proxyPassword || null,
          updatedAt: new Date(),
        })
        .where(and(eq(scanWhatsappDevices.id, id), eq(scanWhatsappDevices.userId, req.user!.id)))
        .returning();

      if (!device) return res.status(404).send("Device not found");
      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to update proxy" });
    }
  });

  // Initialize/Connect a device (Get QR)
  router.post("/devices/:id/connect", async (req, res) => {
    try {
      const { id } = req.params;
      const device = await db.query.scanWhatsappDevices.findFirst({
        where: and(eq(scanWhatsappDevices.id, id), eq(scanWhatsappDevices.userId, req.user!.id))
      });

      if (!device) return res.status(404).send("Device not found");
      
      const { phoneNumber } = req.body;
      
      // Initialize connection (can be QR or Pairing Code)
      whatsappManager.initializeSession(device.id, req.user!.id, phoneNumber);
      
      res.json({ message: phoneNumber ? "Requesting pairing code..." : "Initializing QR connection..." });
    } catch (error) {
      res.status(500).json({ error: "Failed to connect device" });
    }
  });

  // Disconnect/Logout a device
  router.post("/devices/:id/disconnect", async (req, res) => {
    try {
      const { id } = req.params;
      await whatsappManager.logout(id);
      
      await db.update(scanWhatsappDevices)
        .set({ status: "disconnected", phoneNumber: null })
        .where(eq(scanWhatsappDevices.id, id));

      res.json({ message: "Disconnected successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to disconnect device" });
    }
  });

  // Delete a device
  router.delete("/devices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await whatsappManager.logout(id);
      await db.delete(scanWhatsappDevices).where(eq(scanWhatsappDevices.id, id));
      res.json({ message: "Device deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device" });
    }
  });

  app.use("/api/scan-whatsapp", router);
};
