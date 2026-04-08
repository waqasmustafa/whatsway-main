import { db } from "../db";
import { messageQueue, channels, campaigns } from "@shared/schema";
import { eq, and, lte, isNull, sql } from "drizzle-orm";
import { WhatsAppApiService } from "./whatsapp-api";
import { storage } from '../storage';

export class MessageQueueService {
  private static isProcessing = false;
  private static processingInterval: NodeJS.Timeout | null = null;

  // Start processing the message queue
  static startProcessing(intervalMs: number = 1000) {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processQueue();
      }
    }, intervalMs);

    console.log("Message queue processing started");
  }

  // Stop processing the message queue
  static stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log("Message queue processing stopped");
    }
  }

  // Process queued messages
  private static async processQueue() {
    this.isProcessing = true;

    try {
      // Get messages that are ready to be sent
      const messages = await db
        .select()
        .from(messageQueue)
        .where(
          and(
            eq(messageQueue.status, "queued"),
            lte(messageQueue.attempts, 3),
            and(
              isNull(messageQueue.scheduledFor),
              sql`${messageQueue.scheduledFor} <= NOW()`
            )
          )
        )
        .limit(10); // Process 10 messages at a time

      for (const message of messages) {
        await this.processMessage(message);
      }
    } catch (error) {
      console.error("Error processing message queue:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single message
  private static async processMessage(message: any) {
    try {
      // Update status to processing
      await db
        .update(messageQueue)
        .set({ 
          status: "processing",
          processedAt: new Date()
        })
        .where(eq(messageQueue.id, message.id));

      // Get the channel
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, message.channelId))
        .limit(1);

      if (!channel) {
        throw new Error(`Channel not found: ${message.channelId}`);
      }

      // Check rate limit
      const canSend = await WhatsAppApiService.checkRateLimit(channel.id);
      if (!canSend) {
        // Reschedule for later
        await db
          .update(messageQueue)
          .set({ 
            status: "queued",
            scheduledFor: new Date(Date.now() + 5000) // Try again in 5 seconds
          })
          .where(eq(messageQueue.id, message.id));
        return;
      }

      // Determine if we should use marketing_messages endpoint
      const isMarketing = message.messageType === "marketing" && 
                         message.sentVia !== "cloud_api"; // Allow forcing standard API

      // Send the message
      let response;
      if (message.templateName) {
        response = await WhatsAppApiService.sendTemplateMessage(
          channel,
          message.recipientPhone,
          message.templateName,
          message.templateParams || [],
          "en_US",
          isMarketing
        );
      } else {
        // For non-template messages (future implementation)
        throw new Error("Non-template messages not yet implemented");
      }

      // Update message with success
      await db
        .update(messageQueue)
        .set({
          status: "sent",
          whatsappMessageId: response.messages?.[0]?.id,
          sentVia: isMarketing ? "marketing_messages" : "cloud_api",
          attempts: message.attempts + 1
        })
        .where(eq(messageQueue.id, message.id));

      // Log to chat history (messages table) so it appears in Team Inbox
      try {
        const phone = message.recipientPhone;
        let conversation = await storage.getConversationByPhone(phone);
        
        if (!conversation) {
          let contact = await storage.getContactByPhone(phone);
          if (!contact) {
            contact = await storage.createContact({ 
              name: phone, 
              phone: phone, 
              channelId: channel.id 
            });
          }
          conversation = await storage.createConversation({
            contactId: contact.id,
            contactPhone: phone,
            contactName: contact.name || phone,
            channelId: channel.id,
            unreadCount: 0
          });
        }

        // Fetch template for body and buttons metadata
        const apiTemplates = await storage.getTemplatesByName(message.templateName);
        const template = apiTemplates?.[0];
        const msgBody = template?.body || `[template: ${message.templateName}]`;

        const loggedMessage = await storage.createMessage({
          conversationId: conversation.id,
          content: msgBody,
          status: "sent",
          whatsappMessageId: response.messages?.[0]?.id,
          messageType: "template",
          direction: "outbound",
          metadata: {
            campaignId: message.campaignId,
            buttons: template?.buttons || []
          }
        });

        await storage.updateConversation(conversation.id, {
          lastMessageAt: new Date(),
          lastMessageText: msgBody
        });

        // Broadcast new message via WebSocket
        if ((global as any).broadcastToConversation) {
          (global as any).broadcastToConversation(conversation.id, {
            type: "new-message",
            message: loggedMessage
          });
        }
      } catch (logError) {
        console.error(`[MessageQueue] Failed to log sent message to chat history:`, logError);
      }

// update last message
        // await storage.updateConversation(conversationId, {
        //   lastMessageAt: new Date(),
        //   lastMessageText:content
        // });

      // Update campaign sent count if part of a campaign
      if (message.campaignId) {
        await db
          .update(campaigns)
          .set({
            sentCount: sql`${campaigns.sentCount} + 1`
          })
          .where(eq(campaigns.id, message.campaignId));
      }

      console.log(`Message sent successfully: ${message.id}`);
    } catch (error) {
      console.error(`Failed to send message ${message.id}:`, error);

      // Update message with failure
      await db
        .update(messageQueue)
        .set({
          status: message.attempts >= 2 ? "failed" : "queued",
          attempts: message.attempts + 1,
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          errorMessage: error instanceof Error ? error.message : String(error),
          scheduledFor: message.attempts < 2 
            ? new Date(Date.now() + Math.pow(2, message.attempts + 1) * 1000) // Exponential backoff
            : null
        })
        .where(eq(messageQueue.id, message.id));

      // Update campaign failed count if it's a final failure
      if (message.campaignId && message.attempts >= 2) {
        await db
          .update(campaigns)
          .set({
            failedCount: sql`${campaigns.failedCount} + 1`
          })
          .where(eq(campaigns.id, message.campaignId));
      }
    }
  }

  // Queue messages for a campaign
  static async queueCampaignMessages(
    campaignId: string,
    channelId: string,
    recipients: string[],
    templateName: string,
    templateParams: any[] = [],
    messageType: string = "marketing",
    scheduledFor?: Date
  ): Promise<number> {
    const messagesToQueue = recipients.map(phone => ({
      campaignId,
      channelId,
      recipientPhone: phone,
      templateName,
      templateParams,
      messageType,
      status: "queued" as const,
      scheduledFor
    }));

    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    let totalQueued = 0;

    for (let i = 0; i < messagesToQueue.length; i += batchSize) {
      const batch = messagesToQueue.slice(i, i + batchSize);
      await db.insert(messageQueue).values(batch);
      totalQueued += batch.length;
    }

    return totalQueued;
  }

  // Get queue statistics
  static async getQueueStats() {
    const stats = await db
      .select({
        status: messageQueue.status,
        count: sql<number>`count(*)::int`
      })
      .from(messageQueue)
      .groupBy(messageQueue.status);

    return stats.reduce((acc, stat) => {
      if (stat.status) {
        acc[stat.status] = stat.count;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  // Clear failed messages older than X days
  static async clearOldFailedMessages(daysOld: number = 7) {
    const result = await db
      .delete(messageQueue)
      .where(
        and(
          eq(messageQueue.status, "failed"),
          sql`${messageQueue.createdAt} < NOW() - INTERVAL '${daysOld} days'`
        )
      );

    return result;
  }
}