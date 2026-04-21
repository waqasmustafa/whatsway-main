import { db } from "../db";
import { scanCampaigns, scanMessages, scanTemplates } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { whatsappManager } from "./whatsapp.service";

class ScanCampaignWorker {
  private processingCampaigns = new Set<string>();
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Scan Campaign Worker] Started");
    this.loop();
  }

  private async loop() {
    while (this.isRunning) {
      try {
        const activeCampaigns = await db.select()
          .from(scanCampaigns)
          .where(eq(scanCampaigns.status, "running"));

        for (const campaign of activeCampaigns) {
          if (this.processingCampaigns.has(campaign.id)) continue;
          
          // Process one message for this campaign in this tick
          this.processCampaign(campaign);
        }
      } catch (error) {
        console.error("[Scan Campaign Worker] Error in loop:", error);
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  private async processCampaign(campaign: any) {
    this.processingCampaigns.add(campaign.id);
    
    try {
      // 1. Get next pending message
      const [message] = await db.select()
        .from(scanMessages)
        .where(and(eq(scanMessages.campaignId, campaign.id), eq(scanMessages.status, "pending")))
        .orderBy(asc(scanMessages.createdAt))
        .limit(1);

      if (!message) {
        console.log(`[Scan Campaign Worker] Campaign ${campaign.id} completed.`);
        await db.update(scanCampaigns)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(scanCampaigns.id, campaign.id));
        return;
      }

      // 2. Round Robin: Select Device and Template
      const deviceIds = campaign.deviceIds as string[];
      const templateIds = campaign.templateIds as string[];
      const index = campaign.lastProcessedIndex || 0;

      const deviceId = deviceIds[index % deviceIds.length];
      const templateId = templateIds[index % templateIds.length];

      // 3. Get template content
      const template = await db.query.scanTemplates.findFirst({
        where: eq(scanTemplates.id, templateId)
      });

      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      // 4. Send Message
      console.log(`[Scan Campaign Worker] Sending to ${message.receiverNumber} using device ${deviceId}`);
      
      try {
        await whatsappManager.sendMessage(deviceId, message.receiverNumber, template.content);
        
        // Update message success
        await db.update(scanMessages)
          .set({ 
            status: "sent", 
            senderDeviceId: deviceId, 
            content: template.content,
            sentAt: new Date() 
          })
          .where(eq(scanMessages.id, message.id));

        // Update campaign success count
        await db.update(scanCampaigns)
          .set({ 
            sentCount: (campaign.sentCount || 0) + 1,
            lastProcessedIndex: index + 1,
            updatedAt: new Date()
          })
          .where(eq(scanCampaigns.id, campaign.id));

      } catch (sendError: any) {
        console.error(`[Scan Campaign Worker] Send failed to ${message.receiverNumber}:`, sendError.message);
        
        // Update message failure
        await db.update(scanMessages)
          .set({ 
            status: "failed", 
            errorReason: sendError.message || "Unknown error" 
          })
          .where(eq(scanMessages.id, message.id));

        // Update campaign failure count
        await db.update(scanCampaigns)
          .set({ 
            failedCount: (campaign.failedCount || 0) + 1,
            lastProcessedIndex: index + 1,
            updatedAt: new Date()
          })
          .where(eq(scanCampaigns.id, campaign.id));
      }

      // 5. Delay before allowing this campaign to process again
      const minDelay = campaign.minDelay || 2;
      const maxDelay = campaign.maxDelay || 5;
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
      
      console.log(`[Scan Campaign Worker] Campaign ${campaign.id} sleeping for ${randomDelay/1000}s`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));

    } catch (error) {
      console.error(`[Scan Campaign Worker] Critical error processing campaign ${campaign.id}:`, error);
      // If critical error (like template missing), maybe pause the campaign?
      await db.update(scanCampaigns)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(scanCampaigns.id, campaign.id));
    } finally {
      this.processingCampaigns.delete(campaign.id);
    }
  }
}

export const scanCampaignWorker = new ScanCampaignWorker();
