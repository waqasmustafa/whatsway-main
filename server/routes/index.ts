import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";

// Import all route modules
import { registerChannelRoutes } from "./channels.routes";
import { registerDashboardRoutes } from "./dashboard.routes";
import { registerAnalyticsRoutes } from "./analytics.routes";
import { registerContactRoutes } from "./contacts.routes";
import { registerCampaignRoutes } from "./campaigns.routes";
import { registerTemplateRoutes } from "./templates.routes";
import { registerMediaRoutes } from "./media.routes";
import { registerConversationRoutes } from "./conversations.routes";
import { registerAutomationRoutes } from "./automation.routes";
// import { registerAutomationsRoutes } from "./automations.routes";
import { registerWhatsAppRoutes } from "./whatsapp.routes";
import { registerWebhookRoutes } from "./webhooks.routes";
import { registerMessageRoutes } from "./messages.routes";
import { registerPaymentsRoutes } from "./payment.routes";
import { registerMessageLogsRoutes } from "./messages.logs.routes";
import { registerPlansRoutes } from "./plans.routes";
import { userRoutes } from "./user.route"
import teamRoutes from "./team.routes";
import authRoutes from "./auth.routes";
import { registerSMTPRoutes } from "./smtp.route";

// Import error handler middleware
import { errorHandler } from "../middlewares/error.middleware";
import { registerPanelConfigRoutes } from "./panel.config.routes";
import { registerStorageSettingsRoutes } from "./storage.settings.route";
import { registerAISettingsRoutes } from "./ai.settings.routes";
import { registerWidgetRoutes } from "./chatbot.routes";
import { registerTicketsRoutes } from "./support.tickets.routes";
import { registerNotificationsRoutes } from "./notifications.routes";
import { registerFirebaseRoutes } from "./firebase.routes";
import { registerGroupRoutes } from "./group.routes";

export async function registerRoutes(app: Express, httpServer: Server): Promise<Server> {
  // Auth routes (no authentication required)
  app.use("/api/auth", authRoutes);

  // Register all route modules
  registerWidgetRoutes(app);
  registerGroupRoutes(app);
  registerPlansRoutes(app);
  registerNotificationsRoutes(app);
  registerFirebaseRoutes(app);
  userRoutes(app);
  registerSMTPRoutes(app);
  registerStorageSettingsRoutes(app);
  registerAISettingsRoutes(app);
  registerChannelRoutes(app);
  registerDashboardRoutes(app);
  registerAnalyticsRoutes(app); // Legacy - kept for compatibility
  registerContactRoutes(app);
  registerCampaignRoutes(app);
  registerTemplateRoutes(app);
  registerMediaRoutes(app);
  registerConversationRoutes(app);
  registerAutomationRoutes(app);
  // registerAutomationsRoutes(app);
  registerWhatsAppRoutes(app);
  registerWebhookRoutes(app);
  registerMessageRoutes(app);
  registerMessageLogsRoutes(app);
  registerPanelConfigRoutes(app)
  registerPaymentsRoutes(app);
  registerTicketsRoutes(app);

  // Team management routes
  app.use("/api/team", teamRoutes);

  // User routes for team assignment
  app.get("/api/users", async (req, res) => {
    try {
      const { storage } = await import("../storage");
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // httpServer is now passed as an argument

  // Add WebSocket server for real-time features
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });



  // Store WebSocket connections by conversation ID
  const conversationClients = new Map<string, Set<WebSocket>>();

  // Store all connected clients for broadcasting
  const allClients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    allClients.add(ws);
    let currentConversationId: string | null = null;
    let joinedAllConversations = false;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'join-all-conversations') {
          // Mark this client as listening to all conversations
          joinedAllConversations = true;
          ws.send(JSON.stringify({ type: 'joined-all' }));
        } else if (data.type === 'join-conversation') {
          // Leave previous conversation if any
          if (currentConversationId && conversationClients.has(currentConversationId)) {
            conversationClients.get(currentConversationId)!.delete(ws);
          }

          // Join new conversation
          currentConversationId = data.conversationId;
          if (currentConversationId) {
            if (!conversationClients.has(currentConversationId)) {
              conversationClients.set(currentConversationId, new Set());
            }
            conversationClients.get(currentConversationId)!.add(ws);
          }

          ws.send(JSON.stringify({ type: 'joined', conversationId: currentConversationId }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove from all clients
      allClients.delete(ws);

      // Remove from conversation clients
      if (currentConversationId && conversationClients.has(currentConversationId)) {
        conversationClients.get(currentConversationId)!.delete(ws);
        if (conversationClients.get(currentConversationId)!.size === 0) {
          conversationClients.delete(currentConversationId);
        }
      }
      console.log('WebSocket client disconnected');
    });
  });

  // Export broadcast function for use in message routes
  (global as any).broadcastToConversation = (conversationId: string, data: any) => {
    const payload = { ...data, conversationId };
    const message = JSON.stringify(payload);

    // 1. Send to raw WebSocket clients (wss)
    // Send to clients joined to this specific conversation
    const clients = conversationClients.get(conversationId);
    if (clients) {
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }

    // Also send to all clients that joined all conversations
    allClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    // 2. Send to Socket.io clients (io)
    const io = (global as any).io;
    if (io) {
      // Emit to the specific conversation room
      io.to(`conversation:${conversationId}`).emit("new_message", payload);

      // Also emit globally for sidebar updates if needed 
      // (The inbox listens specifically to its conversation or all new messages)
      io.emit("new_message", payload);
    }
  };

  // Error handling middleware - must be registered last
  app.use(errorHandler);

  return httpServer;
}