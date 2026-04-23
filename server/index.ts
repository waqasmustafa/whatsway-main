import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic, log } from "./vite";
import { MessageStatusUpdater } from "./services/message-status-updater";
import 'dotenv/config';
import { initializeUploadsDirectory } from "./middlewares/upload.middleware";
import cors from 'cors';
import path from "path";
import { createServer } from 'http';
// import { initializeSocket, setSocketIO } from './socket';
import { storage } from "./storage";
import { Server as SocketIOServer } from 'socket.io';
import { whatsappManager } from "./services/whatsapp.service";
import { scanWhatsappDevices } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { scanCampaignWorker } from "./services/scan-campaign-worker.service";

const app = express();
const httpServer = createServer(app);

// ============================================
// INITIALIZE SOCKET.IO
// ============================================
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'], // Prioritize polling for proxy stability
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Make io available globally for the broadcast function in routes/index.ts
(global as any).io = io;

// Store connected users
const connectedUsers = new Map();
const conversationRooms = new Map();

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('Socket.io client connected:', socket.id);

  const { userId, role, siteId } = socket.handshake.query;

  // Store user info
  const user = {
    socketId: socket.id,
    userId: userId as string,
    role: (role as string) || 'agent',
    siteId: siteId as string
  };

  connectedUsers.set(socket.id, user);
  console.log(`User connected: ${userId}, Role: ${role}`);

  // Join site room for broadcasts
  if (siteId) {
    socket.join(`site:${siteId}`);
  }

  // Join individual user room for WhatsApp QR/Status updates
  if (userId) {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room user_${userId}`);
  }

  // Explicitly join scan user room if requested
  socket.on("join_scan_user", ({ userId }) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} explicitly joined room user_${userId}`);
    }
  });

  // ==========================================
  // AGENT EVENTS
  // ==========================================

  // Agent joins a conversation
  socket.on('agent_join_conversation', async ({ conversationId, agentId, agentName }) => {
    console.log(`Agent ${agentName} joining conversation ${conversationId}`);

    socket.join(`conversation:${conversationId}`);

    const user = connectedUsers.get(socket.id);
    if (user) {
      user.conversationId = conversationId;
      user.agentName = agentName;
    }

    if (!conversationRooms.has(conversationId)) {
      conversationRooms.set(conversationId, new Set());
    }
    conversationRooms.get(conversationId)?.add(socket.id);

    // Notify others in the conversation
    socket.to(`conversation:${conversationId}`).emit('agent_joined', {
      conversationId,
      agentId,
      agentName
    });

    // Update database - assign conversation
    try {
      // You'll need to implement this in your storage
      await storage.updateConversation(conversationId, {
        status: 'assigned',
        assignedTo: agentId,
        assignedToName: agentName
      });
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  });

  // Agent is typing
  socket.on('agent_typing', ({ conversationId, agentName }) => {
    console.log(`Agent typing in ${conversationId}`);
    socket.to(`conversation:${conversationId}`).emit('agent_typing', {
      conversationId,
      agentName
    });
  });

  // Agent stopped typing
  socket.on('agent_stopped_typing', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('agent_stopped_typing', {
      conversationId
    });
  });

  // Agent sends message (Redundant, handled by REST API now)
  // socket.on('agent_send_message', ...);

  // Close conversation
  socket.on('close_conversation', async ({ conversationId, agentId }) => {
    console.log(`Closing conversation ${conversationId}`);

    try {
      // Update database
      // await storage.updateConversation(conversationId, {
      //   status: 'closed'
      // });

      // Notify all participants
      io.to(`conversation:${conversationId}`).emit('conversation_status_changed', {
        conversationId,
        status: 'closed'
      });
    } catch (error) {
      console.error('Error closing conversation:', error);
    }
  });

  // ==========================================
  // VISITOR EVENTS (from widget)
  // ==========================================

  // Visitor joins conversation
  socket.on('join_conversation', ({ conversationId }) => {
    console.log(`Visitor joining conversation ${conversationId}`);
    socket.join(`conversation:${conversationId}`);

    if (!conversationRooms.has(conversationId)) {
      conversationRooms.set(conversationId, new Set());
    }
    // Broadcast to all participants in the conversation
    io.to(`conversation:${conversationId}`).emit('new_message', {
      conversationId
    });
    conversationRooms.get(conversationId)?.add(socket.id);
  });

  // Visitor is typing
  socket.on('user_typing', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      conversationId
    });
  });

  // Visitor stopped typing
  socket.on('user_stopped_typing', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
      conversationId
    });
  });

  // Conversation opened (mark as read)
  socket.on('conversation_opened', async ({ conversationId }) => {
    console.log(`Conversation opened: ${conversationId}`);

    try {
      // Mark messages as read
      await storage.markMessagesAsRead(conversationId);

      socket.to(`conversation:${conversationId}`).emit('messages_read', {
        conversationId
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Message read
  socket.on('message_read', async ({ conversationId, messageId }) => {
    try {
      // Update message status
      await storage.updateMessage(messageId, { status: 'read', readAt: new Date() });

      socket.to(`conversation:${conversationId}`).emit('message_status_update', {
        messageId,
        status: 'read'
      });
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  });

  // ==========================================
  // DISCONNECT
  // ==========================================
  socket.on('disconnect', () => {
    console.log('Socket.io client disconnected:', socket.id);

    const user = connectedUsers.get(socket.id);
    if (user?.conversationId) {
      const room = conversationRooms.get(user.conversationId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          conversationRooms.delete(user.conversationId);
        }
      }

      // Notify others
      if (user.role === 'visitor') {
        socket.to(`conversation:${user.conversationId}`).emit('user_left', {
          conversationId: user.conversationId
        });
      }
    }

    connectedUsers.delete(socket.id);
  });
});

// Helper functions
io.getOnlineAgents = function (siteId?: string) {
  const agents: any[] = [];
  connectedUsers.forEach(user => {
    if (user.role === 'agent' || user.role === 'admin') {
      if (!siteId || user.siteId === siteId) {
        agents.push(user);
      }
    }
  });
  return agents;
};

io.isConversationActive = function (conversationId: string) {
  const room = conversationRooms.get(conversationId);
  return room && room.size > 0;
};

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static("uploads"));


app.use('/widget', express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}));

// Get online agents
app.get('/api/agents/online', (req, res) => {
  const { siteId } = req.query;
  const agents = io.getOnlineAgents?.(siteId as string) || [];
  res.json({ agents });
});

initializeUploadsDirectory();

// console.log("ENV::", process.env.NODE_ENV ,process.env.FORCE_HTTPS);
// Set up session management
const PostgresSessionStore = connectPgSimple(session);
app.use(
  session({
    store: new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "whatsway-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      // secure: process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS !== "false",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hour
      // maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app, httpServer);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  // server.listen({
  //   port,
  //   host: process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  // }, async () => {
  //   log(`serving on port ${port}`);

  //     // // Only use reusePort if the platform supports it
  // if (process.platform !== "win32" && process.env.NODE_ENV !== "production") {
  //   listenOptions.reusePort = true;
  // }

  //   // Start the message status updater cron job
  //   const messageStatusUpdater = new MessageStatusUpdater();
  //   messageStatusUpdater.startCronJob(60); // Run every 60 seconds instead of 10
  //   log('Message status updater cron job started');

  //   // Start channel health monitor
  //   const { channelHealthMonitor } = await import('./cron/channel-health-monitor');
  //   channelHealthMonitor.start();
  // });

  const listenOptions: any = {
    port,
    host: process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  };

  // Only use reusePort if the platform supports it
  if (process.platform !== "win32" && process.env.NODE_ENV !== "production") {
    listenOptions.reusePort = true;
  }

  httpServer.listen(listenOptions, async () => {
    log(`serving on port ${port}`);

    // Start the message status updater cron job
    const messageStatusUpdater = new MessageStatusUpdater();
    messageStatusUpdater.startCronJob(60);

    const { channelHealthMonitor } = await import("./cron/channel-health-monitor");
    channelHealthMonitor.start();

    // Start Scan WhatsApp Campaign Worker
    scanCampaignWorker.start();

    // Initialize WhatsApp Manager
    whatsappManager.setIo(io);
    
    // Auto-reconnect previously active sessions
    try {
      const activeDevices = await db.select().from(scanWhatsappDevices).where(eq(scanWhatsappDevices.status, "connected"));
      console.log(`Auto-reconnecting ${activeDevices.length} WhatsApp sessions...`);
      for (const device of activeDevices) {
        whatsappManager.initializeSession(device.id, device.userId).catch(err => {
          console.error(`Failed to reconnect session ${device.id}:`, err);
        });
      }
    } catch (err) {
      console.error("Error loading active WhatsApp sessions:", err);
    }
  });
})();
