import type { Request, Response } from 'express';
import { storage } from '../storage';
import { insertMessageSchema } from '@shared/schema';
import { AppError, asyncHandler } from '../middlewares/error.middleware';
import { WhatsAppApiService } from '../services/whatsapp-api';
import type { RequestWithChannel } from '../middlewares/channel.middleware';
import { triggerService } from "../services/automation-execution.service";

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const messages = await storage.getMessages(conversationId);

  await storage.updateConversation(conversationId, {
    unreadCount: null
  });
  res.json(messages);
});

// export const createMessage = asyncHandler(async (req: Request, res: Response) => {
//   const { conversationId } = req.params;
//   const { content, fromUser } = req.body;

//   console.log("Req body : ===> "  , req.body)


export const createMessage = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { content, fromUser, caption, templateName, parameters } = req.body;
  const file = (req as any).file as Express.Multer.File & { cloudUrl?: string };

  // Get conversation
  const conversation = await storage.getConversation(conversationId);
  if (!conversation) throw new AppError(404, "Conversation not found");

  let msgBody = content;
  let messageType = "text";
  let result: any = null;
  let mediaId: string | null = null;
  let mediaUrl: string | null = null;

  let messageStatus: "sent" | "failed" = "sent";


  // If message is from user, push it to WhatsApp
  if (fromUser) {
    if (!conversation.channelId) throw new Error("ChannelId is missing");
    if (!conversation.contactPhone) throw new Error("Contact phone is missing");

    const channel = await storage.getChannel(conversation.channelId);
    if (!channel) throw new AppError(404, "Channel not found");

    const whatsappApi = new WhatsAppApiService(channel);

    try {
      let templateButtons = undefined;
      if (templateName) {
        // Send template
        result = await whatsappApi.sendMessage(conversation.contactPhone, templateName, parameters || []);
        const apiTemplates = await storage.getTemplatesByName(templateName);
        const template = apiTemplates?.[0];
        msgBody = template?.body || `[template: ${templateName}]`;
        messageType = "template";
        templateButtons = template?.buttons; // Store buttons for rendering in inbox
      } else if (file) {
        // Upload + send media
        const mimeType = file.mimetype;

        // Check if file was uploaded to cloud or is still local
        const isCloudFile = !!file.cloudUrl;
        const filePath = file.cloudUrl || file.path;

        console.log(`📤 Processing media: ${isCloudFile ? 'Cloud' : 'Local'}`);
        console.log(`   File location: ${filePath}`);
        console.log(`   MIME type: ${mimeType}`);

        // Upload media to WhatsApp
        // If cloud file, download first; if local, read directly
        if (isCloudFile) {
          // Download from cloud URL and upload to WhatsApp
          console.log("⬇️ Downloading from cloud for WhatsApp upload...");
          const response = await fetch(file.cloudUrl!);
          const buffer = Buffer.from(await response.arrayBuffer());

          // Upload buffer to WhatsApp
          mediaId = await whatsappApi.uploadMediaBuffer(buffer, mimeType, file.originalname);
          console.log("✅ Media uploaded to WhatsApp, ID:", mediaId);
        } else {
          // Upload from local file (fallback)
          console.log("📁 Uploading local file to WhatsApp...");
          mediaId = await whatsappApi.uploadMedia(file.path, mimeType);
          console.log("✅ Media uploaded to WhatsApp, ID:", mediaId);
        }

        // Get media URL from WhatsApp for display purposes
        try {
          mediaUrl = await whatsappApi.getMediaUrl(mediaId!);
          console.log("🌐 WhatsApp media URL retrieved:", mediaUrl);
        } catch (error) {
          console.warn("⚠️ Failed to get WhatsApp media URL:", error);
          // Use cloud URL as fallback
          mediaUrl = file.cloudUrl || null;
        }

        // Determine message type
        if (mimeType.startsWith("image")) messageType = "image";
        else if (mimeType.startsWith("video")) messageType = "video";
        else if (mimeType.startsWith("audio")) messageType = "audio";
        else messageType = "document";

        // Send media message via WhatsApp
        result = await whatsappApi.sendMediaMessage(
          conversation.contactPhone,
          mediaId!,
          messageType as any,
          caption || content
        );
        msgBody = caption || `[${messageType}]`;
      } else {
        // Plain text
        // result = await whatsappApi.sendTextMessage(conversation.contactPhone, content);
        try {
          result = await whatsappApi.sendTextMessage(conversation.contactPhone, content);
        } catch (error: any) {
          console.warn("❌ WhatsApp send failed:", error.message || error);
          messageStatus = "failed"; // mark as failed
        }

        msgBody = content;
        messageType = "text";
      }

      // Save message with media information
      const message = await storage.createMessage({
        conversationId,
        fromUser: true,
        content: msgBody,
        status: "sent",
        whatsappMessageId: result?.messages?.[0]?.id,
        messageType,
        type: messageType,
        mediaId: mediaId || undefined,
        mediaUrl: mediaUrl || file?.cloudUrl || undefined, // Use cloud URL if available
        mediaMimeType: file?.mimetype || undefined,
        metadata: {
          ...(file
            ? {
              mimeType: file.mimetype,
              originalName: file.originalname,
              cloudUrl: file.cloudUrl, // Store cloud URL
              isCloud: !!file.cloudUrl,
              fileSize: file.size
            }
            : {}),
          ...(templateButtons ? { buttons: templateButtons } : {})
        }
      });

      await storage.updateConversation(conversationId, {
        lastMessageAt: new Date(),
        lastMessageText: msgBody
      });

      if ((global as any).broadcastToConversation) {
        (global as any).broadcastToConversation(conversationId, {
          type: "new-message",
          message
        });
      }

      return res.json(message);
    } catch (error) {
      console.error("❌ Error sending WhatsApp message:", error);
      throw new AppError(500, error instanceof Error ? error.message : "Failed to send message");
    }
  } else {
    // Incoming message flow (unchanged)
    const validatedMessage = insertMessageSchema.parse({
      ...req.body,
      conversationId
    });

    const message = await storage.createMessage(validatedMessage);

    try {
      if (!conversation.channelId) throw new Error("ChannelId is missing");
      if (!conversation.contactId) throw new Error("contactId is missing");

      await triggerService.handleMessageReceived(
        conversationId,
        message,
        conversation.channelId,
        conversation.contactId
      );
      console.log(`✅ Triggered automations for message: ${message.id}`);
    } catch (error) {
      console.error("❌ Failed to trigger message automations:", error);
    }

    await storage.updateConversation(conversationId, {
      lastMessageAt: new Date(),
      lastMessageText: msgBody
    });

    if ((global as any).broadcastToConversation) {
      (global as any).broadcastToConversation(conversationId, {
        type: "new-message",
        message
      });
    }

    return res.json(message);
  }
});


export const getMediaById = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;

  // Get message with media info
  const message = await storage.getMessage(messageId);
  if (!message) {
    throw new AppError(404, "Message not found");
  }

  if (!message.mediaId) {
    throw new AppError(404, "No media found for this message");
  }

  if (!message.conversationId) {
    throw new AppError(400, "Message missing conversationId");
  }

  // Get conversation to access channel info
  const conversation = await storage.getConversation(message.conversationId);
  if (!conversation || !conversation.channelId) {
    throw new AppError(404, "Conversation or channel not found");
  }

  const channel = await storage.getChannel(conversation.channelId);
  if (!channel) {
    throw new AppError(404, "Channel not found");
  }

  try {
    const whatsappApi = new WhatsAppApiService(channel);

    // If we don't have the URL cached, fetch it
    let mediaUrl = message.mediaUrl;
    if (!mediaUrl) {
      mediaUrl = await whatsappApi.getMediaUrl(message.mediaId);

      // Update message with the URL for future use
      await storage.updateMessage(messageId, { mediaUrl });
    }

    if (!mediaUrl) {
      throw new AppError(500, "Failed to get media URL from WhatsApp");
    }

    // Fetch the actual media content
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${channel.accessToken}`,
      },
    });

    if (!mediaResponse.ok) {
      throw new AppError(500, "Failed to fetch media from WhatsApp");
    }

    // Set appropriate headers
    const contentType = message.mediaMimeType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    // Stream the media content
    const arrayBuffer = await mediaResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.send(buffer);
  } catch (error) {
    console.error("Error serving media:", error);
    throw new AppError(500, "Failed to serve media");
  }
});

// Get media URL without downloading
export const getMediaUrl = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;

  const message = await storage.getMessage(messageId);
  if (!message || !message.mediaId) {
    throw new AppError(404, "Message or media not found");
  }

  // Return cached URL if available
  if (message.mediaUrl) {
    return res.json({ url: `/api/media/${messageId}`, whatsappUrl: message.mediaUrl });
  }

  // Get fresh URL from WhatsApp
  if (!message.conversationId) {
    throw new AppError(400, "Message missing conversationId");
  }
  const conversation = await storage.getConversation(message.conversationId);
  const channel = await storage.getChannel(conversation!.channelId!);
  const whatsappApi = new WhatsAppApiService(channel!);

  try {
    const mediaUrl = await whatsappApi.getMediaUrl(message.mediaId);

    // Update message with the URL
    await storage.updateMessage(messageId, { mediaUrl });

    res.json({
      url: `/api/media/${messageId}`,
      whatsappUrl: mediaUrl
    });
  } catch (error) {
    console.error("Error getting media URL:", error);
    throw new AppError(500, "Failed to get media URL");
  }
});


export const getMediaProxy = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { messageId } = req.query;
    const { download } = req.query;

    console.log("Media proxy hit for messageId:", messageId, "download:", download);

    // Get message from database
    if (typeof messageId !== 'string') {
      return res.status(400).json({ error: 'Invalid messageId' });
    }
    const message = await storage.getMessage(messageId);
    if (!message || !message.mediaId) {
      return res.status(404).json({ error: 'Media not found' });
    }

    if (!message.conversationId) {
      return res.status(400).json({ error: 'Message missing conversationId' });
    }

    const conversation = await storage.getConversation(message.conversationId);
    const channel = await storage.getChannel(conversation!.channelId!);
    const whatsappApi = new WhatsAppApiService(channel!);

    console.log("Streaming media for mediaId:", message.mediaId);

    // Set appropriate headers before streaming
    const contentType = message.mediaMimeType || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
    });

    // If download is requested, set download header
    if (download === 'true') {
      const filename = message.metadata || `media_${messageId}`;
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
    }

    // Stream media directly using WhatsApp service
    const success = await whatsappApi.streamMedia(message.mediaId, res);

    if (!success) {
      // If streaming failed, try buffer approach
      const mediaBuffer = await whatsappApi.getMedia(message.mediaId);

      if (!mediaBuffer) {
        return res.status(404).json({ error: 'Media not accessible' });
      }

      res.set('Content-Length', mediaBuffer.length.toString());
      res.send(mediaBuffer);
    }

  } catch (error) {
    console.error('Media proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


export const sendMessage = asyncHandler(async (req: RequestWithChannel, res: Response) => {
  const { to, message, templateName, parameters, language, channelId: bodyChannelId, caption, type } = req.body;
  const file = (req as any).file; // multer adds this

  // Get channel
  let channelId = bodyChannelId;
  if (!channelId) {
    const activeChannel = await storage.getActiveChannel();
    if (!activeChannel) {
      throw new AppError(400, "No active channel found. Please select a channel.");
    }
    channelId = activeChannel.id;
  }

  const channel = await storage.getChannel(channelId);
  if (!channel) throw new AppError(404, "Channel not found");

  const whatsappApi = new WhatsAppApiService(channel);

  let result;
  let msgBody = message;
  let messageType = "text";

  let templateButtons = undefined;
  if (templateName) {
    // Send template
    result = await whatsappApi.sendMessage(to, templateName, parameters || [], language);
    const apiTemplates = await storage.getTemplatesByName(templateName);
    const template = apiTemplates?.[0];
    msgBody = template && template.body ? template.body : templateName;
    messageType = "template";
    templateButtons = template?.buttons;
  } else if (file) {
    // Handle media upload + send
    const mimeType = file.mimetype;
    const mediaId = await whatsappApi.uploadMedia(file.path, mimeType);

    // detect type automatically from mimetype
    if (mimeType.startsWith("image")) messageType = "image";
    else if (mimeType.startsWith("video")) messageType = "video";
    else if (mimeType.startsWith("audio")) messageType = "audio";
    else messageType = "document";

    result = await whatsappApi.sendMediaMessage(to, mediaId, messageType as any, caption || message);
    msgBody = caption || `[${messageType}]`;
  } else {
    // Text
    result = await whatsappApi.sendTextMessage(to, message);
    msgBody = message;
    messageType = "text";
  }

  // Conversation / contact logic (same as before)
  let conversation = await storage.getConversationByPhone(to);
  if (!conversation) {
    let contact = await storage.getContactByPhone(to);
    if (!contact) {
      contact = await storage.createContact({ name: to, phone: to, channelId });
    }
    conversation = await storage.createConversation({
      contactId: contact.id,
      contactPhone: to,
      contactName: contact.name || to,
      channelId,
      unreadCount: 0
    });
  }

  const createdMessage = await storage.createMessage({
    conversationId: conversation.id,
    content: msgBody,
    status: "sent",
    whatsappMessageId: result.messages?.[0]?.id,
    messageType: messageType,
    metadata: {
      ...(file ? { mimeType: file.mimetype, originalName: file.originalname } : {}),
      ...(templateButtons ? { buttons: templateButtons } : {})
    }
  });

  await storage.updateConversation(conversation.id, {
    lastMessageAt: new Date(),
    lastMessageText: msgBody,
  });

  if ((global as any).broadcastToConversation) {
    (global as any).broadcastToConversation(conversation.id, {
      type: "new-message",
      message: createdMessage
    });
  }

  res.json({
    success: true,
    messageId: result.messages?.[0]?.id,
    conversationId: conversation.id
  });
});

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type } = req.body; // 'me' or 'everyone'

  const message = await storage.getMessage(id);
  if (!message) throw new AppError(404, "Message not found");

  if (type === 'me') {
    await storage.updateMessage(id, { isDeletedForMe: true });
  } else if (type === 'everyone') {
    // If it's an outbound message (sent by us) and has a whatsapp ID, revoke it
    if (message.fromUser && message.whatsappMessageId && message.conversationId) {
      const conversation = await storage.getConversation(message.conversationId);
      if (conversation?.channelId) {
        const channel = await storage.getChannel(conversation.channelId);
        if (channel) {
          const whatsappApi = new WhatsAppApiService(channel);
          try {
            await whatsappApi.revokeMessage(message.whatsappMessageId);
          } catch (error) {
            console.error("❌ WhatsApp Revoke Error:", error);
            throw new AppError(400, error instanceof Error ? error.message : "Failed to revoke message on WhatsApp");
          }
        }
      }
    }
    await storage.updateMessage(id, { isRevoked: true });
  }

  // Broadcast the deletion event
  if (message.conversationId && (global as any).broadcastToConversation) {
    (global as any).broadcastToConversation(message.conversationId, {
      type: "message_deleted",
      messageId: id,
      deleteType: type
    });
  }

  res.json({ success: true });
});

