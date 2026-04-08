import type { Request, Response } from "express";
import { storage } from "../storage";
import {
  aiSettings,
  insertMessageSchema,
  messages,
  subscriptions,
  transactions,
  webhookConfigs,
} from "@shared/schema";
import { AppError, asyncHandler } from "../middlewares/error.middleware";
import crypto from "crypto";
import { startAutomationExecutionFunction } from "./automation.controller";
import { triggerService } from "server/services/automation-execution.service";
import { WhatsAppApiService } from "server/services/whatsapp-api";
import { db } from "server/db";
import { desc, eq } from "drizzle-orm";

export const getWebhookConfigs = asyncHandler(
  async (req: Request, res: Response) => {
    const configs = await storage.getWebhookConfigs();
    res.json(configs);
  }
);

export const getWebhookConfigsByChannelId = asyncHandler(
  async (req: Request, res: Response) => {
    const channelId = req.params.id;
    console.log("Fetching webhook configs for channel ID:", channelId);
    const configs = await db.select().from(webhookConfigs).where(eq(webhookConfigs.channelId, channelId));
    res.json(configs);
  }
);

export const getGlobalWebhookUrl = asyncHandler(
  async (req: Request, res: Response) => {
    const protocol = req.protocol;
    const host = req.get("host");
    const webhookUrl = `${protocol}://${host}/webhook/:id`;
    res.json({ webhookUrl });
  }
);

export const createWebhookConfig = asyncHandler(
  async (req: Request, res: Response) => {
    const { verifyToken, appSecret, events, channelId } = req.body;

    if (!verifyToken) {
      throw new AppError(400, "Verify token is required");
    }

    const protocol = req.protocol;
    const host = req.get("host");
    const webhookUrl = `${protocol}://${host}/webhook/${channelId || ':id'}`;

    const config = await storage.createWebhookConfig({
      webhookUrl,
      verifyToken,
      appSecret: appSecret || "",
      events: events || [
        "messages",
        "message_status",
        "message_template_status_update",
      ],
      isActive: true,
      channelId: channelId, // Global webhook
    });

    res.json(config);
  }
);

export const updateWebhookConfig = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const config = await storage.updateWebhookConfig(id, updates);
    if (!config) {
      throw new AppError(404, "Webhook config not found");
    }

    res.json(config);
  }
);

export const deleteWebhookConfig = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const deleted = await storage.deleteWebhookConfig(id);
    if (!deleted) {
      throw new AppError(404, "Webhook config not found");
    }

    res.json({ success: true, message: "Webhook config deleted" });
  }
);

export const testWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  // console.log("Testing webhook for config ID:", id);
  const config = await storage.getWebhookConfig(id);
  if (!config) {
    throw new AppError(404, "Webhook config not found");
  }
  // console.log("Webhook config:", config);
  // Send a test webhook event
  const testPayload = {
    entry: [
      {
        id: "test-entry",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15550555555",
                phone_number_id: "test-phone-id",
              },
              test: true,
            },
            field: "messages",
          },
        ],
      },
    ],
  };
  // console.log("Sending test webhook to:", config.webhookUrl , testPayload);
  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    // console.log('Test :::==========>' , response);
    if (!response.ok) {
      throw new AppError(
        500,
        `Test webhook failed with status ${response.status}`
      );
    }

    // Proactively update lastPingAt when test is successful
    await storage.updateWebhookConfig(id, {
      lastPingAt: new Date(),
    });

    res.json({ success: true, message: "Test webhook sent successfully" });
  } catch (error) {
    throw new AppError(
      500,
      `Failed to send test webhook: ${(error as Error).message}`
    );
  }
});

export const handleWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      "hub.mode": mode,
      "hub.challenge": challenge,
      "hub.verify_token": verifyToken,
    } = req.query;
    const { id: webhookId } = req.params;

    // Handle webhook verification
    if (mode && challenge) {
      console.log(`Webhook verification attempt for ID: ${webhookId}, Mode: ${mode}`);

      const configs = await storage.getWebhookConfigs();
      // 1. Try to find by ID if provided
      // 2. Fallback to find by verifyToken
      const matchedConfig = (webhookId !== ":id" && configs.find(c => c.id === webhookId)) ||
        configs.find(c => c.verifyToken === verifyToken && c.isActive);

      const envVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
      const isVerified = (matchedConfig && verifyToken === matchedConfig.verifyToken) ||
        (envVerifyToken && verifyToken === envVerifyToken);

      if (isVerified) {
        console.log("Webhook verified successfully");
        if (matchedConfig) {
          await storage.updateWebhookConfig(matchedConfig.id, {
            lastPingAt: new Date(),
          });
        }
        return res.send(challenge);
      }
      console.error("Webhook verification failed: Token mismatch");
      throw new AppError(403, "Verification failed");
    }

    // Handle webhook events
    const body = req.body;
    console.log(`Webhook received (ID: ${webhookId}):`, JSON.stringify(body, null, 2));

    // Update last ping timestamp for webhook events
    const configs = await storage.getWebhookConfigs();
    let configToUpdate = (webhookId !== ":id" && configs.find(c => c.id === webhookId));

    // Fallback: If no ID or ID mismatch, try matching by phoneNumberId from payload
    if (!configToUpdate && body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id) {
      const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
      configToUpdate = configs.find(c => c.channelId === phoneNumberId);
    }

    // Secondary Fallback: Use first active if still no match
    if (!configToUpdate) {
      configToUpdate = configs.find((c) => c.isActive && (c.channelId === null || c.channelId === undefined));
    }

    // Final Fallback: Use any first active
    if (!configToUpdate) {
      configToUpdate = configs.find((c) => c.isActive);
    }

    if (configToUpdate) {
      console.log(`Updating lastPingAt for webhook config: ${configToUpdate.id}`);
      await storage.updateWebhookConfig(configToUpdate.id, {
        lastPingAt: new Date(),
      });
    }

    if (body.entry) {
      for (const entry of body.entry) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field === "messages") {
            await handleMessageChange(change.value);
          } else if (change.field === "message_template_status_update") {
            await handleTemplateStatusUpdate(change.value);
          }
        }
      }
    }

    res.sendStatus(200);
  }
);

// async function handleMessageChange(value: any) {
//   const { messages, contacts, metadata, statuses } = value;

//   // Handle message status updates (sent, delivered, read, failed)
//   if (statuses && statuses.length > 0) {
//     await handleMessageStatuses(statuses, metadata);
//     return;
//   }

//   if (!messages || messages.length === 0) {
//     return;
//   }

//   // Find channel by phone number ID
//   const phoneNumberId = metadata?.phone_number_id;
//   if (!phoneNumberId) {
//     console.error('No phone_number_id in webhook');
//     return;
//   }

//   const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
//   if (!channel) {
//     console.error(`No channel found for phone_number_id: ${phoneNumberId}`);
//     return;
//   }

//   for (const message of messages) {
//     const { from, id: whatsappMessageId, text, type, timestamp } = message;

//     // Find or create conversation
//     let conversation = await storage.getConversationByPhone(from);
//     if (!conversation) {
//       // Find or create contact first
//       let contact = await storage.getContactByPhone(from);
//       if (!contact) {
//         const contactName = contacts?.find((c: any) => c.wa_id === from)?.profile?.name || from;
//         contact = await storage.createContact({
//           name: contactName,
//           phone: from,
//           channelId: channel.id
//         });
//       }

//       conversation = await storage.createConversation({
//         contactId: contact.id,
//         contactPhone: from,
//         contactName: contact.name || from,
//         channelId: channel.id,
//         unreadCount: 1
//       });

//     //  execute automations;
//     // const result = await startAutomationExecutionFunction(contact?.id, conversation?.id,{ from, whatsappMessageId, text, type, timestamp });
//     // console.log(result);

//     // In your webhook handler
//     await triggerService.handleNewConversation(conversation?.id, contact?.channelId, contact?.id,);

//     } else {
//       // Increment unread count

//       await storage.updateConversation(conversation.id, {
//         unreadCount: (conversation.unreadCount || 0) + 1,
//         lastMessageAt: new Date(),
//         lastMessageText:text?.body || `[${type} message]`,
//       });
//     }

//     console.log("Webhook Message ::>>" , text , text?.body)

//     // Create message
//     const newMessage = await storage.createMessage({
//       conversationId: conversation.id,
//       content: text?.body || `[${type} message]`,
//       fromUser: false,
//       direction: 'inbound',
//       status: 'received',
//       whatsappMessageId,
//       timestamp: new Date(parseInt(timestamp, 10) * 1000)
//     });

//     // Broadcast new message via WebSocket
//     if ((global as any).broadcastToConversation) {
//       (global as any).broadcastToConversation(conversation.id, {
//         type: 'new-message',
//         message: newMessage
//       });
//     }
//   }
// }

// async function handleMessageChange(value: any) {
//   const { messages, contacts, metadata, statuses } = value;

//   // Handle message status updates (sent, delivered, read, failed)
//   if (statuses && statuses.length > 0) {
//     await handleMessageStatuses(statuses, metadata);
//     return;
//   }

//   if (!messages || messages.length === 0) {
//     return;
//   }

//   // Find channel by phone number ID
//   const phoneNumberId = metadata?.phone_number_id;
//   if (!phoneNumberId) {
//     console.error('No phone_number_id in webhook');
//     return;
//   }

//   const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
//   if (!channel) {
//     console.error(`No channel found for phone_number_id: ${phoneNumberId}`);
//     return;
//   }

//   for (const message of messages) {
//     const { from, id: whatsappMessageId, text, type, timestamp } = message;

//     // Find or create conversation
//     let conversation = await storage.getConversationByPhone(from);
//     let contact = await storage.getContactByPhone(from);
//     let isNewConversation = false;

//     if (!conversation) {
//       // This is a new conversation
//       isNewConversation = true;

//       // Find or create contact first
//       if (!contact) {
//         const contactName = contacts?.find((c: any) => c.wa_id === from)?.profile?.name || from;
//         contact = await storage.createContact({
//           name: contactName,
//           phone: from,
//           channelId: channel.id
//         });
//       }

//       conversation = await storage.createConversation({
//         contactId: contact.id,
//         contactPhone: from,
//         contactName: contact.name || from,
//         channelId: channel.id,
//         unreadCount: 1
//       });
//     } else {
//       // Existing conversation - increment unread count
//       await storage.updateConversation(conversation.id, {
//         unreadCount: (conversation.unreadCount || 0) + 1,
//         lastMessageAt: new Date(),
//         lastMessageText: text?.body || `[${type} message]`,
//       });
//     }

//     console.log("Webhook Message ::>>", text, text?.body);

//     // Create message record
//     const newMessage = await storage.createMessage({
//       conversationId: conversation.id,
//       content: text?.body || `[${type} message]`,
//       fromUser: false,
//       direction: 'inbound',
//       status: 'received',
//       whatsappMessageId,
//       timestamp: new Date(parseInt(timestamp, 10) * 1000)
//     });

//     // Broadcast new message via WebSocket
//     if ((global as any).broadcastToConversation) {
//       (global as any).broadcastToConversation(conversation.id, {
//         type: 'new-message',
//         message: newMessage
//       });
//     }

//     // ============== AUTOMATION HANDLING ==============

//     try {
//       if (isNewConversation) {
//         // Handle new conversation automation triggers
//         console.log(`🎯 Triggering new conversation automation for: ${conversation.id}`);
//         await triggerService.handleNewConversation(
//           conversation.id,
//           channel.id,
//           contact.id
//         );
//       } else {
//         // Handle message received triggers (including user responses)
//         console.log(`💬 Triggering message received automation for: ${conversation.id}`);

//         // The triggerService.handleMessageReceived method will:
//         // 1. Check if there's a pending execution waiting for user response
//         // 2. If yes, process as user response and resume execution
//         // 3. If no, trigger normal message-based automations

//         await triggerService.handleMessageReceived(
//           conversation.id,
//           {
//             content: text?.body || `[${type} message]`,
//             text: text?.body,
//             type: type,
//             from: from,
//             whatsappMessageId: whatsappMessageId,
//             timestamp: timestamp
//           },
//           channel.id,
//           contact.id
//         );
//       }
//     } catch (automationError) {
//       // Log automation errors but don't fail the webhook
//       console.error(`❌ Automation error for conversation ${conversation.id}:`, automationError);

//       // Optionally notify monitoring/alerting systems
//       // await notifyAutomationError(conversation.id, automationError);
//     }
//   }
// }

// Enhanced webhook handler with AI auto-reply on trigger words
async function handleMessageChange(value: any) {
  const { messages, contacts, metadata, statuses } = value;

  // Handle message status updates (sent, delivered, read, failed)
  if (statuses && statuses.length > 0) {
    await handleMessageStatuses(statuses, metadata);
    return;
  }

  if (!messages || messages.length === 0) {
    return;
  }

  // Find channel by phone number ID
  const phoneNumberId = metadata?.phone_number_id;
  if (!phoneNumberId) {
    console.error("No phone_number_id in webhook");
    return;
  }

  const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
  if (!channel) {
    console.error(`No channel found for phone_number_id: ${phoneNumberId}`);
    return;
  }

  // Create WhatsApp API service instance for fetching media
  const waApi = new WhatsAppApiService(channel);

  for (const message of messages) {
    const { from, id: whatsappMessageId, text, type, timestamp, interactive } = message;

    // Extract message content and interactive data
    let messageContent = "";
    let interactiveData: any = null;

    // Media fields
    let mediaId: string | null = null;
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;
    let mediaSha256: string | null = null;

    if (type === "text" && text) {
      messageContent = text.body;
    } else if (type === "button" && message.button) {
      // Handle template quick reply buttons
      messageContent = message.button.text;
      interactiveData = {
        type: "button_reply",
        button_reply: {
          id: message.button.payload,
          title: message.button.text
        }
      };
      console.log("Quick reply button response:", message.button);
    } else if (type === "interactive" && interactive) {
      if (interactive.type === "button_reply") {
        messageContent = interactive.button_reply.title;
        interactiveData = interactive;
        console.log("Interactive button response:", interactive.button_reply);
      } else if (interactive.type === "list_reply") {
        messageContent = interactive.list_reply.title;
        interactiveData = interactive;
        console.log("Interactive list response:", interactive.list_reply);
      }
    } else if (type === "image" && message.image) {
      messageContent = message.image.caption || "[Image]";
      mediaId = message.image.id;
      mediaMimeType = message.image.mime_type;
      mediaSha256 = message.image.sha256;
    } else if (type === "document" && message.document) {
      messageContent =
        message.document.caption ||
        `[Document: ${message.document.filename || "file"}]`;
      mediaId = message.document.id;
      mediaMimeType = message.document.mime_type;
      mediaSha256 = message.document.sha256;
    } else if (type === "audio" && message.audio) {
      messageContent = "[Audio message]";
      mediaId = message.audio.id;
      mediaMimeType = message.audio.mime_type;
      mediaSha256 = message.audio.sha256;
    } else if (type === "video" && message.video) {
      messageContent = message.video.caption || "[Video]";
      mediaId = message.video.id;
      mediaMimeType = message.video.mime_type;
      mediaSha256 = message.video.sha256;
    } else {
      messageContent = `[${type} message]`;
    }

    // If media exists, fetch its temporary URL
    if (mediaId) {
      try {
        mediaUrl = await waApi.fetchMediaUrl(mediaId);
      } catch (err) {
        console.error("❌ Failed to fetch media URL:", err);
      }
    }

    // Find or create conversation
    let conversation = await storage.getConversationByPhone(from);
    let contact = await storage.getContactByPhone(from);
    let isNewConversation = false;

    if (!conversation) {
      isNewConversation = true;

      if (!contact) {
        const contactName =
          contacts?.find((c: any) => c.wa_id === from)?.profile?.name || from;
        contact = await storage.createContact({
          name: contactName,
          phone: from,
          channelId: channel.id,
        });
      }

      conversation = await storage.createConversation({
        contactId: contact.id,
        contactPhone: from,
        contactName: contact.name || from,
        channelId: channel.id,
        unreadCount: 1,
      });
    } else {
      await storage.updateConversation(conversation.id, {
        unreadCount: (conversation.unreadCount || 0) + 1,
        lastMessageAt: new Date(),
        lastMessageText: messageContent,
      });
    }

    console.log(
      "Webhook Message:",
      messageContent,
      "Type:",
      type,
      "Interactive:",
      !!interactiveData
    );

    // Create message record
    const newMessage = await storage.createMessage({
      conversationId: conversation.id,
      content: messageContent,
      fromUser: false,
      direction: "inbound",
      status: "received",
      whatsappMessageId,
      messageType: type,
      metadata: interactiveData ? JSON.stringify(interactiveData) : null,
      timestamp: new Date(parseInt(timestamp, 10) * 1000),

      // Media fields
      mediaId,
      mediaUrl,
      mediaMimeType,
      mediaSha256,
    });

    // Broadcast new message via WebSocket
    if ((global as any).broadcastToConversation) {
      (global as any).broadcastToConversation(conversation.id, {
        type: "new-message",
        message: newMessage,
      });
    }

    // --- AI AUTO-REPLY CHECK (NEW) ---
    try {
      const shouldSendAiReply = await checkAndSendAiReply(
        messageContent,
        conversation,
        contact,
        waApi
      );

      if (shouldSendAiReply) {
        console.log(`✅ AI auto-reply sent for conversation ${conversation.id}`);
        // Continue to prevent automation triggers when AI handles it
        continue;
      }
    } catch (aiError) {
      console.error(`❌ AI auto-reply error:`, aiError);
      // Continue with normal flow if AI fails
    }

    // --- Automation handling ---
    try {
      const hasPendingExecution =
        triggerService.getExecutionService().hasPendingExecution(conversation.id);

      if (hasPendingExecution) {
        console.log(
          `Processing as user response to pending automation execution`
        );

        const result =
          await triggerService.getExecutionService().handleUserResponse(
            conversation.id,
            messageContent,
            interactiveData
          );

        if (result && result.success) {
          console.log(
            `Successfully processed user response for execution ${result.executionId}`
          );

          if ((global as any).broadcastToConversation) {
            (global as any).broadcastToConversation(conversation.id, {
              type: "automation-resumed",
              data: {
                executionId: result.executionId,
                userResponse: result.userResponse,
                savedVariable: result.savedVariable,
                resumedAt: result.resumedAt,
              },
            });
          }

          continue;
        } else {
          console.warn(
            `Failed to process user response, will try triggering new automations`
          );
        }
      }

      if (isNewConversation) {
        console.log(
          `New conversation automation trigger for: ${conversation.id}`
        );
        await triggerService.handleNewConversation(
          conversation.id,
          channel.id,
          contact?.id
        );
      } else {
        console.log(
          `Message received automation trigger for: ${conversation.id}`
        );
        console.log(
          `Debug info - Channel ID: ${channel.id}, Message: "${messageContent}"`
        );

        const messageData = {
          content: messageContent,
          text: messageContent,
          body: messageContent,
          type: type,
          from: from,
          whatsappMessageId: whatsappMessageId,
          timestamp: timestamp,
          interactive: interactiveData,
          messageType: type,
          hasInteraction: !!interactiveData,
          buttonId: interactiveData?.button_reply?.id || null,
          buttonTitle: interactiveData?.button_reply?.title || null,
          listId: interactiveData?.list_reply?.id || null,
          listTitle: interactiveData?.list_reply?.title || null,
        };

        await triggerService.handleMessageReceived(
          conversation.id,
          messageData,
          channel.id,
          contact?.id
        );
      }
    } catch (automationError) {
      console.error(
        `❌ Automation error for conversation ${conversation.id}:`,
        automationError
      );

      if ((global as any).broadcastToConversation) {
        (global as any).broadcastToConversation(conversation.id, {
          type: "automation-error",
          error: {
            message: (automationError as Error).message,
            conversationId: conversation.id,
            timestamp: new Date(),
          },
        });
      }
    }
  }
}

// --- AI AUTO-REPLY HELPER FUNCTION (NEW) ---
async function checkAndSendAiReply(
  messageContent: string,
  conversation: any,
  contact: any,
  whatsappApi: any
): Promise<boolean> {
  // Get active AI settings
  const getAiSettings = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.channelId, conversation.channelId))
    .limit(1)
    .then((res) => res[0]);

  if (!getAiSettings || !getAiSettings.isActive) {
    return false;
  }

  // ✅ Parse words correctly (handle both string and array)
  let triggerWords: string[] = [];

  if (Array.isArray(getAiSettings.words)) {
    triggerWords = getAiSettings.words;
  } else if (typeof getAiSettings.words === "string") {
    try {
      triggerWords = JSON.parse(getAiSettings.words);
    } catch {
      console.warn("⚠️ AI settings words not valid JSON, using empty array");
      triggerWords = [];
    }
  }

  if (!Array.isArray(triggerWords) || triggerWords.length === 0) {
    console.log("ℹ️ No trigger words configured, skipping AI auto-reply");
    return false;
  }

  const messageLower = messageContent.toLowerCase().trim();
  const hasMatch = triggerWords.some((word: string) =>
    messageLower.includes(word.toLowerCase().trim())
  );

  if (!hasMatch) {
    return false;
  }

  console.log(`🤖 Trigger word matched for message: "${messageContent}"`);

  // Get conversation history for context
  const conversationHistory = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(desc(messages.timestamp));

  // Generate AI response
  const aiResponse = await generateAiResponse(
    messageContent,
    conversationHistory,
    contact,
    getAiSettings
  );

  if (!aiResponse) {
    console.error("❌ Failed to generate AI response");
    return false;
  }

  // Send AI reply via WhatsApp
  try {
    const result = await whatsappApi.sendTextMessage(
      conversation.contactPhone,
      aiResponse
    );

    // Save AI response as outbound message
    const aiMessage = await storage.createMessage({
      conversationId: conversation.id,
      content: aiResponse,
      fromUser: true,
      direction: "outbound",
      status: "sent",
      whatsappMessageId: result.messages?.[0]?.id || null,
      messageType: "text",
      metadata: JSON.stringify({ aiGenerated: true, trigger: messageContent }),
      timestamp: new Date(),
    });

    // Update conversation
    await storage.updateConversation(conversation.id, {
      lastMessageAt: new Date(),
      lastMessageText: aiResponse,
    });

    // Broadcast AI message via WebSocket
    if ((global as any).broadcastToConversation) {
      (global as any).broadcastToConversation(conversation.id, {
        type: "new-message",
        message: aiMessage,
      });

      (global as any).broadcastToConversation(conversation.id, {
        type: "ai-reply-sent",
        data: {
          messageId: aiMessage.id,
          trigger: messageContent,
          response: aiResponse,
        },
      });
    }

    return true;
  } catch (error) {
    console.error("❌ Failed to send AI reply:", error);
    throw error;
  }
}

// --- AI RESPONSE GENERATION (NEW) ---
async function generateAiResponse(
  userMessage: string,
  conversationHistory: any[],
  contact: any,
  aiSettings: any
): Promise<string | null> {
  try {
    const { provider, apiKey, model, endpoint, temperature, maxTokens } = aiSettings;

    // Build conversation context
    const messages = [
      {
        role: "system",
        content: `You are a helpful WhatsApp assistant. Respond naturally and helpfully to customer messages. Keep responses concise and friendly. Customer name: ${contact?.name || "Customer"}`,
      },
    ];

    // Add conversation history (last 10 messages for context)
    conversationHistory
      .slice(-10)
      .reverse()
      .forEach((msg) => {
        messages.push({
          role: msg.fromUser ? "assistant" : "user",
          content: msg.content,
        });
      });

    // Add current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    // Call AI API based on provider
    let aiResponse: string | null = null;

    if (provider === "openai") {
      aiResponse = await callOpenAI(
        messages,
        apiKey,
        model,
        endpoint || "https://api.openai.com/v1",
        parseFloat(temperature || "0.7"),
        parseInt(maxTokens || "2048", 10)
      );
    } else if (provider === "anthropic") {
      aiResponse = await callAnthropic(
        messages,
        apiKey,
        model,
        endpoint || "https://api.anthropic.com/v1",
        parseFloat(temperature || "0.7"),
        parseInt(maxTokens || "2048", 10)
      );
    } else {
      console.error(`Unsupported AI provider: ${provider}`);
      return null;
    }

    return aiResponse;
  } catch (error) {
    console.error("❌ Error generating AI response:", error);
    return null;
  }
}

// --- OpenAI API Call ---
async function callOpenAI(
  messages: any[],
  apiKey: string,
  model: string,
  endpoint: string,
  temperature: number,
  maxTokens: number
): Promise<string | null> {
  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("OpenAI API call failed:", error);
    return null;
  }
}

// --- Anthropic API Call ---
async function callAnthropic(
  messages: any[],
  apiKey: string,
  model: string,
  endpoint: string,
  temperature: number,
  maxTokens: number
): Promise<string | null> {
  try {
    // Extract system message and convert format
    const systemMessage = messages.find((m) => m.role === "system")?.content || "";
    const conversationMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    const response = await fetch(`${endpoint}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        messages: conversationMessages,
        system: systemMessage,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Anthropic API error:", error);
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error("Anthropic API call failed:", error);
    return null;
  }
}



async function handleMessageStatuses(statuses: any[], metadata: any) {
  const phoneNumberId = metadata?.phone_number_id;
  if (!phoneNumberId) {
    console.error("No phone_number_id in webhook status update");
    return;
  }

  const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
  if (!channel) {
    console.error(`No channel found for phone_number_id: ${phoneNumberId}`);
    return;
  }

  for (const statusUpdate of statuses) {
    const {
      id: whatsappMessageId,
      status,
      timestamp,
      errors,
      recipient_id,
    } = statusUpdate;

    console.log(
      `📊 Message status update: ${whatsappMessageId} - ${status}`,
      errors ? `Errors: ${errors.length}` : ""
    );

    // Find the message by WhatsApp ID
    const message = await storage.getMessageByWhatsAppId(whatsappMessageId);
    if (!message) {
      console.log(`⚠️ Message not found for WhatsApp ID: ${whatsappMessageId}`);
      continue;
    }

    // Map WhatsApp status to our status
    let messageStatus: "sent" | "delivered" | "read" | "failed" = "sent";
    let errorDetails = null;

    if (status === "sent") {
      messageStatus = "sent";
    } else if (status === "delivered") {
      messageStatus = "delivered";
    } else if (status === "read") {
      messageStatus = "read";
    } else if (status === "failed" && errors && errors.length > 0) {
      messageStatus = "failed";
      // Capture the error details
      const error = errors[0];
      errorDetails = {
        code: error.code,
        title: error.title,
        message: error.message || error.details,
        errorData: error.error_data,
        recipientId: recipient_id,
        timestamp: timestamp,
      };

      console.error(`❌ Message failed with error:`, errorDetails);
    }

    // Update message status and error details
    const updatedMessage = await storage.updateMessage(message.id, {
      status: messageStatus,
      errorDetails: errorDetails ? JSON.stringify(errorDetails) : null,
      deliveredAt:
        messageStatus === "delivered"
          ? new Date(parseInt(timestamp, 10) * 1000)
          : message.deliveredAt,
      readAt:
        messageStatus === "read"
          ? new Date(parseInt(timestamp, 10) * 1000)
          : message.readAt,
      updatedAt: new Date(),
    });

    // Broadcast status update
    if ((global as any).broadcastToConversation && message.conversationId) {
      (global as any).broadcastToConversation(message.conversationId, {
        type: "message-status-update",
        data: {
          messageId: message.id,
          whatsappMessageId,
          status: messageStatus,
          errorDetails,
          timestamp: new Date(parseInt(timestamp, 10) * 1000),
        },
      });
    }

    // If message has a campaign ID, update campaign stats
    if (message.campaignId) {
      const campaign = await storage.getCampaign(message.campaignId);
      if (campaign) {
        const updates: any = {};

        if (messageStatus === "delivered" && message.status !== "delivered") {
          updates.deliveredCount = (campaign.deliveredCount || 0) + 1;
        } else if (messageStatus === "read" && message.status !== "read") {
          updates.readCount = (campaign.readCount || 0) + 1;
        } else if (messageStatus === "failed" && message.status !== "failed") {
          updates.failedCount = (campaign.failedCount || 0) + 1;
          // Only decrease sent count if message was previously marked as sent
          if (message.status === "sent") {
            updates.sentCount = Math.max(0, (campaign.sentCount || 0) - 1);
          }
        }

        if (Object.keys(updates).length > 0) {
          await storage.updateCampaign(campaign.id, updates);
        }
      }
    }
  }
}

async function handleTemplateStatusUpdate(value: any) {
  const { message_template_id, message_template_name, event, reason } = value;

  console.log(
    `Template status update: ${message_template_name} - ${event}${reason ? ` - Reason: ${reason}` : ""
    }`
  );

  if (message_template_id && event) {
    // Map WhatsApp status to our status
    let status = "pending";
    if (event === "APPROVED") {
      status = "approved";
    } else if (event === "REJECTED") {
      status = "rejected";
    }

    // Update template status in database
    const templates = await storage.getTemplates();
    const template = templates.find(
      (t) => t.whatsappTemplateId === message_template_id
    );

    if (template) {
      const updateData: any = { status };
      // If rejected, save the rejection reason
      if (event === "REJECTED" && reason) {
        updateData.rejectionReason = reason;
      }
      await storage.updateTemplate(template.id, updateData);
      console.log(
        `Updated template ${template.name} status to ${status}${reason ? ` with reason: ${reason}` : ""
        }`
      );
    }
  }
}

// ============== ADDITIONAL HELPER FUNCTIONS ==============

/**
 * Get automation execution status for a conversation
 * Useful for debugging and monitoring
 */
export const getConversationAutomationStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { conversationId } = req.params;

    const executionService = triggerService.getExecutionService();
    const hasPending = executionService.hasPendingExecution(conversationId);
    const pendingExecutions = executionService
      .getPendingExecutions()
      .filter((pe) => pe.conversationId === conversationId);

    res.json({
      conversationId,
      hasPendingExecution: hasPending,
      pendingExecutions,
      totalPendingCount: pendingExecutions.length,
    });
  }
);

/**
 * Cancel automation execution for a conversation
 * Useful for manual intervention
 */
export const cancelConversationAutomation = asyncHandler(
  async (req: Request, res: Response) => {
    const { conversationId } = req.params;

    const executionService = triggerService.getExecutionService();
    const cancelled = await executionService.cancelExecution(conversationId);

    res.json({
      success: cancelled,
      conversationId,
      message: cancelled
        ? "Automation execution cancelled successfully"
        : "No pending execution found for this conversation",
    });
  }
);

/**
 * Get all pending executions across all conversations
 * Useful for monitoring dashboard
 */
export const getAllPendingExecutions = asyncHandler(
  async (req: Request, res: Response) => {
    const executionService = triggerService.getExecutionService();
    const pendingExecutions = executionService.getPendingExecutions();

    res.json({
      totalCount: pendingExecutions.length,
      executions: pendingExecutions,
    });
  }
);

/**
 * Cleanup expired executions manually
 * Can be called via API or scheduled job
 */
export const cleanupExpiredExecutions = asyncHandler(
  async (req: Request, res: Response) => {
    const { timeoutMinutes = 30 } = req.query;
    const timeoutMs = parseInt(timeoutMinutes as string) * 60 * 1000;

    const executionService = triggerService.getExecutionService();
    const cleanedCount = await executionService.cleanupExpiredExecutions(
      timeoutMs
    );

    res.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} expired executions`,
    });
  }
);





// Razorpay Webhook Handler
export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'] as string;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = req.body;
    const eventType = event.event;

    console.log('Razorpay Webhook Event:', eventType);

    switch (eventType) {
      case 'payment.authorized':
        await handleRazorpayPaymentAuthorized(event);
        break;

      case 'payment.captured':
        await handleRazorpayPaymentCaptured(event);
        break;

      case 'payment.failed':
        await handleRazorpayPaymentFailed(event);
        break;

      case 'order.paid':
        await handleRazorpayOrderPaid(event);
        break;

      case 'refund.created':
        await handleRazorpayRefundCreated(event);
        break;

      default:
        console.log('Unhandled Razorpay event:', eventType);
    }

    res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed', error });
  }
};

// Stripe Webhook Handler
export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const signature = req.headers['stripe-signature'] as string;

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Stripe signature verification failed:', err.message);
      return res.status(400).json({
        success: false,
        message: `Webhook signature verification failed: ${err.message}`
      });
    }

    const eventType = event.type;
    console.log('Stripe Webhook Event:', eventType);

    switch (eventType) {
      case 'payment_intent.succeeded':
        await handleStripePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handleStripePaymentIntentFailed(event.data.object);
        break;

      case 'charge.succeeded':
        await handleStripeChargeSucceeded(event.data.object);
        break;

      case 'charge.refunded':
        await handleStripeChargeRefunded(event.data.object);
        break;

      case 'invoice.paid':
        await handleStripeInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleStripeInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleStripeSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleStripeSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleStripeSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log('Unhandled Stripe event:', eventType);
    }

    res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed', error });
  }
};

// ==================== RAZORPAY HANDLERS ====================

async function handleRazorpayPaymentAuthorized(event: any) {
  const payment = event.payload.payment.entity;
  console.log('Payment authorized:', payment.id);

  // Update transaction status to authorized (optional intermediate state)
  await updateTransactionByProviderOrderId(
    payment.order_id,
    {
      status: 'authorized',
      providerPaymentId: payment.id,
      metadata: {
        method: payment.method,
        amount: payment.amount / 100,
        currency: payment.currency
      }
    }
  );
}

async function handleRazorpayPaymentCaptured(event: any) {
  const payment = event.payload.payment.entity;
  console.log('Payment captured:', payment.id);

  // Find transaction by order_id
  const transaction = await findTransactionByProviderOrderId(payment.order_id);

  if (transaction) {
    // Update transaction to completed
    await db.update(transactions)
      .set({
        status: 'completed',
        providerPaymentId: payment.id,
        paidAt: new Date(),
        metadata: {
          method: payment.method,
          amount: payment.amount / 100,
          currency: payment.currency,
          cardId: payment.card_id,
          bank: payment.bank,
          wallet: payment.wallet
        },
        updatedAt: new Date()
      })
      .where(eq(transactions.id, transaction.id));

    // Create subscription if not exists
    await createSubscriptionFromTransaction(transaction);
  }
}

async function handleRazorpayPaymentFailed(event: any) {
  const payment = event.payload.payment.entity;
  console.log('Payment failed:', payment.id);

  await updateTransactionByProviderOrderId(
    payment.order_id,
    {
      status: 'failed',
      providerPaymentId: payment.id,
      metadata: {
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        errorReason: payment.error_reason
      }
    }
  );
}

async function handleRazorpayOrderPaid(event: any) {
  const order = event.payload.order.entity;
  console.log('Order paid:', order.id);

  await updateTransactionByProviderOrderId(
    order.id,
    {
      status: 'completed',
      paidAt: new Date()
    }
  );
}

async function handleRazorpayRefundCreated(event: any) {
  const refund = event.payload.refund.entity;
  console.log('Refund created:', refund.id);

  await updateTransactionByProviderPaymentId(
    refund.payment_id,
    {
      status: 'refunded',
      refundedAt: new Date(),
      metadata: {
        refundId: refund.id,
        refundAmount: refund.amount / 100
      }
    }
  );
}

// ==================== STRIPE HANDLERS ====================

async function handleStripePaymentIntentSucceeded(paymentIntent: any) {
  console.log('Payment intent succeeded:', paymentIntent.id);

  // Find transaction by provider transaction ID
  const transaction = await findTransactionByProviderTransactionId(paymentIntent.id);

  if (transaction) {
    await db.update(transactions)
      .set({
        status: 'completed',
        paidAt: new Date(),
        metadata: {
          paymentMethod: paymentIntent.payment_method,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency
        },
        updatedAt: new Date()
      })
      .where(eq(transactions.id, transaction.id));

    await createSubscriptionFromTransaction(transaction);
  }
}

async function handleStripePaymentIntentFailed(paymentIntent: any) {
  console.log('Payment intent failed:', paymentIntent.id);

  await updateTransactionByProviderTransactionId(
    paymentIntent.id,
    {
      status: 'failed',
      metadata: {
        errorMessage: paymentIntent.last_payment_error?.message,
        errorCode: paymentIntent.last_payment_error?.code
      }
    }
  );
}

async function handleStripeChargeSucceeded(charge: any) {
  console.log('Charge succeeded:', charge.id);

  await updateTransactionByProviderTransactionId(
    charge.payment_intent,
    {
      providerPaymentId: charge.id,
      metadata: {
        cardLast4: charge.payment_method_details?.card?.last4,
        cardBrand: charge.payment_method_details?.card?.brand,
        receiptUrl: charge.receipt_url
      }
    }
  );
}

async function handleStripeChargeRefunded(charge: any) {
  console.log('Charge refunded:', charge.id);

  await updateTransactionByProviderPaymentId(
    charge.id,
    {
      status: 'refunded',
      refundedAt: new Date(),
      metadata: {
        refundAmount: charge.amount_refunded / 100
      }
    }
  );
}

async function handleStripeInvoicePaid(invoice: any) {
  console.log('Invoice paid:', invoice.id);
  // Handle subscription renewal or invoice payment
}

async function handleStripeInvoicePaymentFailed(invoice: any) {
  console.log('Invoice payment failed:', invoice.id);
  // Handle failed subscription renewal
}

async function handleStripeSubscriptionCreated(subscription: any) {
  console.log('Subscription created:', subscription.id);
  // Handle subscription creation from Stripe
}

async function handleStripeSubscriptionUpdated(subscription: any) {
  console.log('Subscription updated:', subscription.id);
  // Handle subscription updates
}

async function handleStripeSubscriptionDeleted(subscription: any) {
  console.log('Subscription deleted:', subscription.id);
  // Handle subscription cancellation
}

// ==================== HELPER FUNCTIONS ====================

async function findTransactionByProviderOrderId(orderId: string) {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.providerOrderId, orderId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

async function findTransactionByProviderTransactionId(transactionId: string) {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.providerTransactionId, transactionId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

async function findTransactionByProviderPaymentId(paymentId: string) {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.providerPaymentId, paymentId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

async function updateTransactionByProviderOrderId(orderId: string, updateData: any) {
  const transaction = await findTransactionByProviderOrderId(orderId);
  if (transaction) {
    await db.update(transactions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(transactions.id, transaction.id));
  }
}

async function updateTransactionByProviderTransactionId(transactionId: string, updateData: any) {
  const transaction = await findTransactionByProviderTransactionId(transactionId);
  if (transaction) {
    await db.update(transactions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(transactions.id, transaction.id));
  }
}

async function updateTransactionByProviderPaymentId(paymentId: string, updateData: any) {
  const transaction = await findTransactionByProviderPaymentId(paymentId);
  if (transaction) {
    await db.update(transactions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(transactions.id, transaction.id));
  }
}

async function createSubscriptionFromTransaction(transaction: any) {
  // Check if subscription already exists
  if (transaction.subscriptionId) {
    return;
  }

  // Calculate subscription dates
  const startDate = new Date();
  const endDate = new Date();

  if (transaction.billingCycle === 'annual') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Create subscription
  const newSubscription = await db
    .insert(subscriptions)
    .values({
      userId: transaction.userId,
      planId: transaction.planId,
      status: 'active',
      billingCycle: transaction.billingCycle,
      startDate,
      endDate,
      autoRenew: true
    })
    .returning();

  // Update transaction with subscription ID
  await db
    .update(transactions)
    .set({ subscriptionId: newSubscription[0].id })
    .where(eq(transactions.id, transaction.id));

  console.log('Subscription created:', newSubscription[0].id);
}