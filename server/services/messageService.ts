import { storage } from '../storage';
import { AppError } from '../middlewares/error.middleware';
import { WhatsAppApiService } from '../services/whatsapp-api';

export async function sendBusinessMessage({ to, message, templateName, parameters, language, channelId, conversationId }: {
  to: string;
  message?: string;
  templateName?: string;
  parameters?: any[];
  language?: string;
  channelId?: string;
  conversationId?: string;  // ✅ allow explicit conversation link
}) {
  // Get channelId (or fallback to active channel)
  if (!channelId) {
    const activeChannel = await storage.getActiveChannel();
    if (!activeChannel) {
      throw new AppError(400, "No active channel found. Please select a channel.");
    }
    channelId = activeChannel.id;
  }

  const channel = await storage.getChannel(channelId);
  if (!channel) {
    throw new AppError(404, "Channel not found");
  }
  console.log('Sending message via channel:', channelId, 'to:', to);
  const whatsappApi = new WhatsAppApiService(channel);

  // Send via WhatsApp API
  let result;
  if (templateName) {
    // console.log('Sending template message:', templateName, 'with parameters:', parameters);
    result = await whatsappApi.sendMessage(to, templateName, parameters || [], language);
  } else {
    // console.log('Sending text message:', message);
    result = await whatsappApi.sendTextMessage(to, message || "Test message");
  }
  console.log('WhatsApp API result:', result);
  // Find or create conversation
  let conversation = conversationId
    ? await storage.getConversation(conversationId)
    : await storage.getConversationByPhone(to);
  // console.log('Using conversation:', conversation?.id);
  if (!conversation) {
    let contact = await storage.getContactByPhone(to);
    if (!contact) {
      contact = await storage.createContact({
        name: to,
        phone: to,
        channelId,
      });
    }

    conversation = await storage.createConversation({
      contactId: contact.id,
      contactPhone: to,
      contactName: contact.name || to,
      channelId,
      unreadCount: 0,
    });
  }

  let newMsg = templateName ? (await storage.getTemplatesByName(templateName))[0] : null;

  console.log('Using template for message body:', {
    conversationId: conversation.id,
    content: message || newMsg?.body,
    sender: "business",
    status: "sent",
    whatsappMessageId: result.messages?.[0]?.id,
  });
  // Save message
  const createdMessage = await storage.createMessage({
    conversationId: conversation.id,
    content: message ?? newMsg?.body ?? "",
    status: "sent",
    whatsappMessageId: result.messages?.[0]?.id,
  });


  // console.log('Created message:', createdMessage);
  // Update conversation last message
  await storage.updateConversation(conversation.id, {
    lastMessageAt: new Date(),
    lastMessageText: message || newMsg?.body,
  });

  // Broadcast to websocket
  if ((global as any).broadcastToConversation) {
    (global as any).broadcastToConversation(conversation.id, {
      type: "new-message",
      message: createdMessage,
    });
  }
  console.log('Broadcasted new message to conversation:', conversation.id);
  // console.log('sendBusinessMessage completed successfully' , {    success: true,
  // messageId: result.messages?.[0]?.id,
  // conversationId: conversation.id,
  // createdMessage});
  return {
    success: true,
    messageId: result.messages?.[0]?.id,
    conversationId: conversation.id,
    createdMessage,
  };
}
