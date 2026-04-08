import { db } from "../db";
import { webhookConfigs, messages, conversations, contacts, messageQueue, templates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: string;
  image?: {
    id: string;
    mime_type: string;
  };
  document?: {
    id: string;
    mime_type: string;
    filename: string;
  };
  button?: {
    text: string;
    payload: string;
  };
  interactive?: {
    type: string;
    button_reply?: {
      id: string;
      text: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
}

export interface WebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: {
      type: string;
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message: string;
  }>;
}

export class WebhookHandler {
  // Verify webhook signature
  static verifySignature(
    rawBody: string,
    signature: string,
    appSecret: string
  ): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");

    return `sha256=${expectedSignature}` === signature;
  }

  // Handle webhook verification (GET request)
  static async handleVerification(
    mode: string,
    verifyToken: string,
    challenge: string,
    expectedToken: string
  ): Promise<{ verified: boolean; challenge?: string }> {
    if (mode === "subscribe" && verifyToken === expectedToken) {
      console.log("Webhook verified successfully");
      return { verified: true, challenge };
    }

    console.error("Webhook verification failed");
    return { verified: false };
  }

  // Process incoming webhook events
  static async processWebhook(body: any): Promise<void> {
    if (body.object !== "whatsapp_business_account") {
      throw new Error("Invalid webhook object type");
    }

    for (const entry of body.entry) {
      const wabaId = entry.id;

      for (const change of entry.changes) {
        const value = change.value;
        const field = change.field;

        if (field === "messages") {
          // Handle incoming messages
          if (value.messages) {
            for (const message of value.messages) {
              await this.handleIncomingMessage(
                value.metadata.phone_number_id,
                message
              );
            }
          }

          // Handle message status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              await this.handleStatusUpdate(status);
            }
          }
        } else if (field === "message_template_status_update") {
          // Handle template status updates
          await this.handleTemplateStatusUpdate(value);
        } else if (field === "account_alerts") {
          // Handle account alerts
          await this.handleAccountAlert(value);
        }
      }
    }
  }

  // Handle incoming messages
  private static async handleIncomingMessage(
    phoneNumberId: string,
    message: WebhookMessage
  ): Promise<void> {
    try {
      // Check if contact exists, create if not
      let contact = await db
        .select()
        .from(contacts)
        .where(eq(contacts.phone, message.from))
        .limit(1);

      if (contact.length === 0) {
        const [newContact] = await db
          .insert(contacts)
          .values({
            name: message.from, // Default to phone number
            phone: message.from,
            lastContact: new Date(),
          })
          .returning();
        contact = [newContact];
      } else {
        // Update last contact time
        await db
          .update(contacts)
          .set({ lastContact: new Date() })
          .where(eq(contacts.phone, message.from));
      }

      // Find or create conversation
      let conversation = await db
        .select()
        .from(conversations)
        .where(eq(conversations.contactId, contact[0].id))
        .limit(1);

      if (conversation.length === 0) {
        const [newConversation] = await db
          .insert(conversations)
          .values({
            contactId: contact[0].id,
            lastMessageAt: new Date(),
          })
          .returning();
        conversation = [newConversation];
      } else {
        // Update last message time
        await db
          .update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversation[0].id));
      }

      // Store the message
      let content = "";
      if (message.text) {
        content = message.text.body;
      } else if (message.type === "image") {
        content = "[Image]";
      } else if (message.type === "document") {
        content = `[Document: ${message.document?.filename || "Unknown"}]`;
      } else if (message.type === "button") {
        content = message.button?.text || "[Quick Reply Button]";
      } else if (message.type === "interactive") {
        if (message.interactive?.button_reply) {
          content = message.interactive.button_reply.text;
        } else if (message.interactive?.list_reply) {
          content = message.interactive.list_reply.title;
        } else {
          content = "[Interactive Message]";
        }
      } else {
        content = `[${message.type}]`;
      }

      await db.insert(messages).values({
        conversationId: conversation[0].id,
        fromUser: true,
        content,
        type: message.type,
        status: "delivered",
      });

      console.log(`Received message from ${message.from}: ${content}`);
    } catch (error) {
      console.error("Error handling incoming message:", error);
      throw error;
    }
  }

  // Handle message status updates
  private static async handleStatusUpdate(status: WebhookStatus): Promise<void> {
    try {
      // Update message status in messages table
      const [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.whatsappMessageId, status.id))
        .limit(1);

      if (message) {
        const updateData: any = {
          status: status.status === "failed" ? "failed" : status.status,
          updatedAt: new Date(),
        };

        if (status.status === "delivered") {
          updateData.deliveredAt = new Date();
        } else if (status.status === "read") {
          updateData.readAt = new Date();
        } else if (status.status === "failed" && status.errors?.[0]) {
          updateData.errorCode = status.errors[0].code.toString();
          updateData.errorMessage = status.errors[0].message;
        }

        await db
          .update(messages)
          .set(updateData)
          .where(eq(messages.id, message.id));

        console.log(`Message ${status.id} status updated to ${status.status}`);

        // Update campaign statistics if this is part of a campaign
        if (message.campaignId) {
          await this.updateCampaignStats(message.campaignId, status.status);
        }
      }

      // Also check message queue for campaign messages
      const [queueItem] = await db
        .select()
        .from(messageQueue)
        .where(eq(messageQueue.whatsappMessageId, status.id))
        .limit(1);

      if (queueItem) {
        const updateData: any = {
          status: status.status === "failed" ? "failed" : status.status,
        };

        if (status.status === "delivered") {
          updateData.deliveredAt = new Date();
        } else if (status.status === "read") {
          updateData.readAt = new Date();
        } else if (status.status === "failed" && status.errors?.[0]) {
          updateData.errorCode = status.errors[0].code.toString();
          updateData.errorMessage = status.errors[0].message;
        }

        await db
          .update(messageQueue)
          .set(updateData)
          .where(eq(messageQueue.id, queueItem.id));

        // Update campaign statistics if this is part of a campaign
        if (queueItem.campaignId) {
          await this.updateCampaignStats(queueItem.campaignId, status.status);
        }
      }
    } catch (error) {
      console.error("Error handling status update:", error);
      throw error;
    }
  }

  // Update campaign statistics
  private static async updateCampaignStats(
    campaignId: string,
    status: string
  ): Promise<void> {
    const incrementField = {
      delivered: "deliveredCount",
      read: "readCount",
      failed: "failedCount",
    }[status];

    if (incrementField) {
      await db.execute(
        sql`UPDATE campaigns 
            SET ${sql.identifier(incrementField)} = ${sql.identifier(incrementField)} + 1 
            WHERE id = ${campaignId}`
      );
    }
  }

  // Handle template status updates
  static async handleTemplateStatusUpdate(value: any): Promise<void> {
    try {
      const { message_template_id, message_template_name, event, reason } = value;

      console.log(
        `Template ${message_template_name} status changed to ${event}`,
        reason ? `Reason: ${reason}` : ""
      );

      // Map WhatsApp event status to our template status
      let status: string;
      switch (event) {
        case "APPROVED":
          status = "approved";
          break;
        case "REJECTED":
          status = "rejected";
          break;
        case "PENDING":
          status = "pending";
          break;
        case "DISABLED":
          status = "disabled";
          break;
        default:
          console.warn(`Unknown template status event: ${event}`);
          return;
      }

      // Update template status in database
      const updatedTemplates = await db
        .update(templates)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(templates.whatsappTemplateId, message_template_id))
        .returning();

      if (updatedTemplates.length === 0) {
        // Try to find by name if ID not found
        const updatedByName = await db
          .update(templates)
          .set({
            status,
            updatedAt: new Date()
          })
          .where(eq(templates.name, message_template_name))
          .returning();

        if (updatedByName.length === 0) {
          console.warn(`Template not found for update: ${message_template_name} (${message_template_id})`);
        }
      }
    } catch (error) {
      console.error("Error handling template status update:", error);
      throw error;
    }
  }

  // Handle account alerts
  private static async handleAccountAlert(value: any): Promise<void> {
    try {
      console.warn("Account alert received:", value);

      // Handle different types of alerts
      // - Quality rating changes
      // - Account restrictions
      // - Policy violations
      // You might want to send notifications to admins here
    } catch (error) {
      console.error("Error handling account alert:", error);
      throw error;
    }
  }

  // Update webhook last ping time
  static async updateWebhookPing(channelId: string): Promise<void> {
    await db
      .update(webhookConfigs)
      .set({ lastPingAt: new Date() })
      .where(eq(webhookConfigs.channelId, channelId));
  }
}

// Import sql from drizzle-orm
import { sql } from "drizzle-orm";