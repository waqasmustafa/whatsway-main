import type { Request, Response } from 'express';
import { storage } from '../storage';
import { AppError, asyncHandler } from '../middlewares/error.middleware';
import { eq, desc, and, or, like, gte, sql } from 'drizzle-orm';
import { messages, conversations, contacts, whatsappChannels } from '@shared/schema';
import { db } from '../db';


export const getMessageLogs = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, status, dateRange, search } = req.query;

  let conditions = [];

  // Channel filter
  if (channelId) {
    conditions.push(eq(conversations.channelId, channelId as string));
  }

  // Date range filter
  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
    }

    conditions.push(gte(messages.createdAt, startDate));
  }

  // Status filter
  if (status && status !== 'all') {
    conditions.push(eq(messages.status, status as any));
  }

  // Add search condition if provided
  if (search) {
    conditions.push(
      or(
        like(conversations.contactPhone, `%${search}%`),
        like(messages.content, `%${search}%`),
        like(conversations.contactName, `%${search}%`)
      )!
    );
  }

  // Build the query
  let baseQuery = db
    .select({
      id: messages.id,
      channelId: conversations.channelId,
      phoneNumber: conversations.contactPhone,
      contactName: conversations.contactName,
      channelName: whatsappChannels.name,
      content: messages.content,
      direction: messages.direction,
      fromUser: messages.fromUser,
      status: messages.status,
      errorCode: messages.errorCode,
      errorMessage: messages.errorMessage,
      errorDetails: messages.errorDetails,
      deliveredAt: messages.deliveredAt,
      readAt: messages.readAt,
      whatsappMessageId: messages.whatsappMessageId,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .leftJoin(whatsappChannels, eq(conversations.channelId, whatsappChannels.id));

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions)) as typeof baseQuery;
  }

  const messageLogs = await baseQuery
    .orderBy(desc(messages.createdAt))
    .limit(100); // Limit to last 100 messages


  // Transform to match expected format
  const formattedLogs = messageLogs.map(log => ({
    id: log.id,
    channelId: log.channelId || '',
    phoneNumber: log.phoneNumber || '',
    contactName: log.contactName || '',
    messageType: (log.direction === 'outbound' || log.direction === 'outgoing') ? 'sent' : 'received',
    content: log.content || '',
    templateName: log.content?.startsWith('Template:') ? log.content.replace('Template: ', '') : undefined,
    status: log.status || 'pending',
    errorCode: log.errorCode,
    errorMessage: log.errorMessage,
    errorDetails: log.errorDetails,
    deliveredAt: log.deliveredAt,
    readAt: log.readAt,
    whatsappMessageId: log.whatsappMessageId,
    createdAt: log.createdAt || new Date().toISOString(),
    updatedAt: log.updatedAt || new Date().toISOString(),
  }));

  res.json(formattedLogs);
});

export const updateMessageStatus = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { status } = req.body;

  // Update message status
  const [updatedMessage] = await db
    .update(messages)
    .set({
      status,
    })
    .where(eq(messages.id, messageId))
    .returning();

  if (!updatedMessage) {
    throw new AppError(404, 'Message not found');
  }

  res.json(updatedMessage);
});

export const deleteMessages = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new AppError(400, 'No message IDs provided');
  }

  // Delete messages
  await db.delete(messages).where(sql`${messages.id} IN ${ids}`);

  res.json({ message: 'Messages deleted successfully' });
});