import { db } from "../db";
import { scanCampaigns, scanMessages, scanTemplates, scanConversations } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { whatsappManager } from "./whatsapp.service";

class ScanCampaignWorker {
  private processingCampaigns = new Set<string>();
  private isRunning = false;
  // In-memory retry counter per message (retryCount missing from DB schema)
  private messageRetries = new Map<string, number>();

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

      // Check if any campaign device has an active session — pause if none available
      const anyActive = deviceIds.some(id => whatsappManager.hasSession(id));
      if (!anyActive) {
        console.log(`[Scan Campaign Worker] No active devices for campaign ${campaign.id}. Pausing.`);
        await db.update(scanCampaigns)
          .set({ status: "paused", updatedAt: new Date() })
          .where(eq(scanCampaigns.id, campaign.id));
        return;
      }

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
      const currentRetryCount = this.messageRetries.get(message.id) || 0;
      console.log(`[Scan Campaign Worker] Sending to ${message.receiverNumber} using device ${deviceId} (Attempt: ${currentRetryCount + 1})`);

      try {
        await whatsappManager.sendMessage(deviceId, message.receiverNumber, template.content);

        // Clear retry counter on success
        this.messageRetries.delete(message.id);

        // --- INBOX INTEGRATION ---
        let [conv] = await db.select().from(scanConversations).where(
          and(
            eq(scanConversations.userId, campaign.userId),
            eq(scanConversations.deviceId, deviceId),
            eq(scanConversations.remoteNumber, message.receiverNumber)
          )
        ).limit(1);

        if (!conv) {
          [conv] = await db.insert(scanConversations).values({
            userId: campaign.userId,
            deviceId,
            remoteNumber: message.receiverNumber,
            lastMessage: template.content,
            unreadCount: 0
          }).returning();
        } else {
          await db.update(scanConversations)
            .set({
              lastMessage: template.content,
              lastMessageAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scanConversations.id, conv.id));
        }

        // Update message success
        await db.update(scanMessages)
          .set({
            userId: campaign.userId,
            conversationId: conv.id,
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
        console.error(`[Scan Campaign Worker] Send failed to ${message.receiverNumber} with device ${deviceId}:`, sendError.message);

        const nextIndex = index + 1;
        const newRetryCount = currentRetryCount + 1;
        const maxRetries = deviceIds.length * 2; // try each device twice at most

        if (newRetryCount < maxRetries) {
          console.log(`[Scan Campaign Worker] Retrying ${message.receiverNumber} with next device... (${newRetryCount}/${maxRetries})`);
          this.messageRetries.set(message.id, newRetryCount);

          await db.update(scanMessages)
            .set({ errorReason: `Attempt ${newRetryCount}: Device ${deviceId} failed: ${sendError.message}` })
            .where(eq(scanMessages.id, message.id));

          await db.update(scanCampaigns)
            .set({ lastProcessedIndex: nextIndex, updatedAt: new Date() })
            .where(eq(scanCampaigns.id, campaign.id));

          this.processingCampaigns.delete(campaign.id);
          return;
        }

        // Final failure — all retries exhausted
        console.log(`[Scan Campaign Worker] Marking ${message.receiverNumber} as FAILED after ${newRetryCount} attempts.`);
        this.messageRetries.delete(message.id);

        await db.update(scanMessages)
          .set({
            status: "failed",
            errorReason: `Failed after ${newRetryCount} attempts. Last: ${sendError.message}`
          })
          .where(eq(scanMessages.id, message.id));

        await db.update(scanCampaigns)
          .set({
            failedCount: (campaign.failedCount || 0) + 1,
            lastProcessedIndex: nextIndex,
            updatedAt: new Date()
          })
          .where(eq(scanCampaigns.id, campaign.id));
      }

      // 5. Delay before next message
      const minDelay = campaign.minDelay || 2;
      const maxDelay = campaign.maxDelay || 5;
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;

      console.log(`[Scan Campaign Worker] Campaign ${campaign.id} sleeping for ${randomDelay/1000}s`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));

    } catch (error) {
      console.error(`[Scan Campaign Worker] Critical error processing campaign ${campaign.id}:`, error);
      await db.update(scanCampaigns)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(scanCampaigns.id, campaign.id));
    } finally {
      this.processingCampaigns.delete(campaign.id);
    }
  }
}

export const scanCampaignWorker = new ScanCampaignWorker();
