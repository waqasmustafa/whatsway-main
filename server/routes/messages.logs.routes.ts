import type { Express } from 'express';
import { getMessageLogs, updateMessageStatus, deleteMessages } from '../controllers/messages.logs.controller';

export function registerMessageLogsRoutes(app: Express) {
  // Get message logs with filters
  app.get('/api/messages/logs', getMessageLogs);

  // Update message status
  app.put('/api/messages/:messageId/status', updateMessageStatus);

  // Delete messages (bulk)
  app.delete('/api/messages/logs', deleteMessages);
}