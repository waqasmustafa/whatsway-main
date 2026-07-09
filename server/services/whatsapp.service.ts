import { SocksProxyAgent } from "socks-proxy-agent";
import * as _baileysPkg from "@whiskeysockets/baileys";
const baileysPkg = _baileysPkg as any;

// Baileys v7 uses named exports. Try namespace first, fallback to .default for CJS bundles.
const _b: any = baileysPkg.initAuthCreds ? baileysPkg : (baileysPkg.default ?? baileysPkg);

const makeWASocket = _b.makeWASocket ?? _b.default;
const initAuthCreds = _b.initAuthCreds;
const DisconnectReason = _b.DisconnectReason;
const makeCacheableSignalKeyStore = _b.makeCacheableSignalKeyStore;
const Browsers = _b.Browsers;
const proto = _b.proto;
const fetchLatestBaileysVersion = _b.fetchLatestBaileysVersion;
const makeInMemoryStore = _b.makeInMemoryStore;
const downloadMediaMessage = _b.downloadMediaMessage;

import type {
  AuthenticationState,
  AuthenticationCreds,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createDOClient } from "../config/digitalOceanConfig";
import { db } from "../db";
import { whatsappSessions, scanWhatsappDevices, scanConversations, scanMessages, scanCampaigns, scanContacts, scanAutoReplies, scanAutoReplyLogs } from "@shared/schema";
import { eq, and, or, desc, like } from "drizzle-orm";
import { Server } from "socket.io";
import { MediaStorageService } from "./media-storage.service";

const logger = pino({ level: "silent" });

/**
 * Local cache to speed up DB auth state and prevent race conditions
 */
const authCache = new Map<string, Map<string, any>>();

// ─── LID / PN Helper Functions (per Baileys docs) ─────────────────────────────
function normalizePn(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

function jidToPn(jid?: string | null): string | null {
  if (!jid) return null;
  if (jid.includes("@s.whatsapp.net")) {
    return normalizePn(jid.split("@")[0].split(":")[0]);
  }
  return null;
}

function resolveCanonicalContactId(msg: any) {
  const key = msg?.key || {};
  const remoteJid: string = key.remoteJid || "";
  const remoteJidAlt: string = key.remoteJidAlt || "";
  const senderPn: string = key.senderPn || msg.senderPn || "";

  // Preferred phone number (display / grouping key)
  const pn =
    normalizePn(senderPn) ||
    jidToPn(remoteJidAlt) ||
    jidToPn(remoteJid);

  // Canonical conversation key — never use bare numeric LID as phone number
  const canonicalId = pn || remoteJidAlt || remoteJid;

  return {
    remoteJid,
    remoteJidAlt,
    senderPn,
    pn,
    canonicalId,
    isLid: remoteJid.includes("@lid"),
  };
}
// ──────────────────────────────────────────────────────────────────────────────


/**
 * Recursively restores Buffers from JSON objects like {type: 'Buffer', data: [...]}
 * and handles nested objects/arrays.
 */
function fixBuffer(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'object' && obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return Buffer.from(obj.data);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => fixBuffer(item));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = fixBuffer(obj[key]);
    }
    return newObj;
  }
  
  return obj;
}

/**
 * Custom implementation of Baileys Auth State to store session in Postgres
 */
export async function useDatabaseAuthState(deviceId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const loadData = async (type: string, id: string) => {
    // Check cache first
    const deviceCache = authCache.get(deviceId);
    if (deviceCache?.has(`${type}:${id}`)) {
      return deviceCache.get(`${type}:${id}`);
    }

    try {
      const result = await db.query.whatsappSessions.findFirst({
        where: and(
          eq(whatsappSessions.deviceId, deviceId),
          eq(whatsappSessions.sessionType, type),
          eq(whatsappSessions.keyId, id)
        ),
      });
      
      if (!result) return null;
      
      const data = fixBuffer(result.data);
      
      // Update cache
      if (!authCache.has(deviceId)) authCache.set(deviceId, new Map());
      authCache.get(deviceId)!.set(`${type}:${id}`, data);
      
      return data;
    } catch (e) {
      console.error(`[WhatsApp DB Auth] Load error for ${type}/${id}:`, e);
      return null;
    }
  };

  const writeData = async (data: any, type: string, id: string) => {
    // Deep clone to prevent mutating original data but ensure Buffers stay Buffers for serialization
    // Baileys needs the actual Buffers in memory, but DB will serialize them as JSON objects
    
    // Update cache immediately with the original object (with Buffers)
    if (!authCache.has(deviceId)) authCache.set(deviceId, new Map());
    authCache.get(deviceId)!.set(`${type}:${id}`, data);

    try {
      // Postgres JSONB handles Buffer serialization automatically as {type: 'Buffer', data: [...]}
      const existing = await db.query.whatsappSessions.findFirst({
        where: and(
          eq(whatsappSessions.deviceId, deviceId),
          eq(whatsappSessions.sessionType, type),
          eq(whatsappSessions.keyId, id)
        ),
      });

      if (existing) {
        await db.update(whatsappSessions)
          .set({ data, updatedAt: new Date() })
          .where(eq(whatsappSessions.id, existing.id));
      } else {
        await db.insert(whatsappSessions).values({ deviceId, sessionType: type, keyId: id, data });
      }
    } catch (e) {
      console.error(`[WhatsApp DB Auth] Write error for ${type}/${id}:`, e);
    }
  };

  const removeData = async (type: string, id: string) => {
    // Update cache
    authCache.get(deviceId)?.delete(`${type}:${id}`);

    try {
      await db.delete(whatsappSessions).where(
        and(
          eq(whatsappSessions.deviceId, deviceId),
          eq(whatsappSessions.sessionType, type),
          eq(whatsappSessions.keyId, id)
        )
      );
    } catch (e) {
      console.error(`[WhatsApp DB Auth] Remove error for ${type}/${id}:`, e);
    }
  };

  const credsData = await loadData("creds", "creds");
  const creds: AuthenticationCreds = credsData || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: any } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await loadData(type, id);
              if (type === "app-state-sync-key" && value) {
                if (proto?.Message?.AppStateSyncKeyData) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const type in data) {
            for (const id in data[type as keyof SignalDataTypeMap]) {
              const value = data[type as keyof SignalDataTypeMap]![id];
              if (value) {
                tasks.push(writeData(value, type, id));
              } else {
                tasks.push(removeData(type, id));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData(creds, "creds", "creds");
    },
  };
}

class WhatsappManager {
  private sessions: Map<string, any> = new Map();

  hasSession(deviceId: string): boolean {
    return this.sessions.has(deviceId);
  }
  private pendingInitializations: Set<string> = new Set();
  private retryMap: Map<string, number> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private pairingRequests: Set<string> = new Set();
  private io: Server | null = null;
  // Per-device LID -> Phone Number map (WhatsApp Multi-Device)
  private lidToPhone: Map<string, Map<string, string>> = new Map();
  // Per-device in-memory stores for contact tracking
  private stores: Map<string, any> = new Map();

  setIo(io: Server) {
    this.io = io;
  }

  async initializeSession(deviceId: string, userId: string, phoneNumber?: string) {
    if (this.pendingInitializations.has(deviceId)) {
      console.log(`[WhatsApp] Init already pending for: ${deviceId}`);
      return;
    }

    this.pendingInitializations.add(deviceId);

    try {
      console.log(`[WhatsApp] Initializing session for device: ${deviceId}, phone: ${phoneNumber || "none"}`);

      // Clear any pending retry timeouts for this device
      if (this.retryTimeouts.has(deviceId)) {
        clearTimeout(this.retryTimeouts.get(deviceId)!);
        this.retryTimeouts.delete(deviceId);
      }

      // Manual link request or fresh start - clear old session data if it's not connected
      if (phoneNumber) {
        console.log(`[WhatsApp] ${deviceId}: Clearing old session data for fresh pairing...`);
        authCache.delete(deviceId); // Clear local cache
        await db.delete(whatsappSessions).where(eq(whatsappSessions.deviceId, deviceId));
        this.retryMap.delete(deviceId); // Reset retries on manual connect
        this.pairingRequests.delete(deviceId); // Reset pairing request state
      }

      const { state, saveCreds } = await useDatabaseAuthState(deviceId);

      // Load device proxy config if set
      const deviceRecord = await db.select().from(scanWhatsappDevices).where(eq(scanWhatsappDevices.id, deviceId)).limit(1);
      let proxyAgent: SocksProxyAgent | undefined;
      if (deviceRecord[0]?.proxyHost) {
        const d = deviceRecord[0];
        const auth = d.proxyUsername ? `${encodeURIComponent(d.proxyUsername)}:${encodeURIComponent(d.proxyPassword || "")}@` : "";
        const proxyUrl = `socks5h://${auth}${d.proxyHost}:${d.proxyPort || 1080}`;
        proxyAgent = new SocksProxyAgent(proxyUrl);
        console.log(`[WhatsApp] ${deviceId}: Using SOCKS5 proxy ${d.proxyHost}:${d.proxyPort || 1080}`);
      }

      // Stable version fallback
      let version: [number, number, number] = [2, 3000, 1015901307];
      try {
        const result = await fetchLatestBaileysVersion();
        if (result?.version) version = result.version;
      } catch (e) {
        console.warn(`[WhatsApp] Version fetch failed, using fallback ${version}`);
      }

      console.log(`[WhatsApp] ${deviceId}: Creating socket with version ${version}...`);
      // Ensure makeWASocket is a function (handles ESM/CJS interop)
      const socketBuilder = typeof makeWASocket === 'function' ? makeWASocket : (makeWASocket as any).default;

      if (typeof socketBuilder !== 'function') {
        throw new Error("makeWASocket is not a function. Check @whiskeysockets/baileys installation.");
      }

      const sock = socketBuilder({
        version,
        printQRInTerminal: false,
        browser: Browsers.ubuntu("Chrome"),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 60000,
        ...(proxyAgent ? { agent: proxyAgent } : {}),
      });

      this.sessions.set(deviceId, sock);
      this.pendingInitializations.delete(deviceId);
      console.log(`[WhatsApp] Socket ready for ${deviceId}`);

      // Bind in-memory store to track contacts (helps resolve LIDs)
      if (makeInMemoryStore) {
        try {
          const store = makeInMemoryStore({ logger });
          store.bind(sock.ev);
          this.stores.set(deviceId, store);
          console.log(`[WhatsApp] ${deviceId}: InMemoryStore bound for contact tracking`);
        } catch (e) {
          console.warn(`[WhatsApp] ${deviceId}: Could not bind InMemoryStore:`, e);
        }
      }

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Handle Pairing Code Request according to docs
        if (phoneNumber && !sock.authState.creds.registered && !this.pairingRequests.has(deviceId)) {
          if (connection === "connecting" || qr) {
            this.pairingRequests.add(deviceId);
            console.log(`[WhatsApp] ${deviceId}: Requesting pairing code for ${phoneNumber}...`);
            // Small delay to ensure socket is actually ready for requests
            setTimeout(async () => {
              try {
                if (this.sessions.get(deviceId) !== sock) return;
                const cleanNumber = phoneNumber.replace(/\D/g, "");
                const code = await sock.requestPairingCode(cleanNumber);
                console.log(`[WhatsApp] ${deviceId}: Pairing code generated: ${code}`);
                if (this.io) {
                  this.io.to(`user_${userId}`).emit("whatsapp_pairing_code", { deviceId, code });
                }
              } catch (err: any) {
                this.pairingRequests.delete(deviceId);
                console.error(`[WhatsApp] ${deviceId}: Pairing code request error:`, err?.message || err);
              }
            }, 3000);
          }
        }

        if (qr && this.io && !phoneNumber) {
          console.log(`[WhatsApp] ${deviceId}: New QR code generated`);
          this.io.to(`user_${userId}`).emit("whatsapp_qr", { deviceId, qr });
        }

        if (connection === "close") {
          // IMPORTANT: If this socket is no longer the active session for this device,
          // do NOT trigger any reconnect logic or status updates.
          if (this.sessions.get(deviceId) !== sock) {
            console.log(`[WhatsApp] ${deviceId}: Old socket closed, ignoring.`);
            return;
          }

          const boomErr = lastDisconnect?.error as Boom;
          const statusCode = boomErr?.output?.statusCode;
          const errorMsg = boomErr?.message || (lastDisconnect?.error as any)?.message || "";

          // Documentation: Handle different disconnect reasons
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isRestartRequired = statusCode === 515; // restartRequired
          const shouldReconnect = !isLoggedOut;

          console.log(`[WhatsApp] Connection closed for ${deviceId}. Status: ${statusCode || "unknown"}, Error: ${errorMsg || "none"}, Reconnect: ${shouldReconnect}`);
          this.sessions.delete(deviceId);
          this.pairingRequests.delete(deviceId);

          if (shouldReconnect) {
            const delay = isRestartRequired ? 1000 : 10000; // Faster reconnect for restartRequired
            const retries = this.retryMap.get(deviceId) || 0;
            
            if (retries < 5) {
              this.retryMap.set(deviceId, retries + 1);
              console.log(`[WhatsApp] ${deviceId}: Reconnecting in ${delay/1000}s (Retry ${retries + 1}/5)...`);
              const timeout = setTimeout(() => {
                this.retryTimeouts.delete(deviceId);
                this.initializeSession(deviceId, userId, phoneNumber);
              }, delay);
              this.retryTimeouts.set(deviceId, timeout);
            } else {
              console.error(`[WhatsApp] ${deviceId}: Max retries reached`);
              this.retryMap.delete(deviceId);
              if (this.io) this.io.to(`user_${userId}`).emit("whatsapp_status", { deviceId, status: "disconnected" });
            }
          } else {
            console.log(`[WhatsApp] ${deviceId}: Session logged out (401). Wiping session data.`);
            this.retryMap.delete(deviceId);
            await db.delete(whatsappSessions).where(eq(whatsappSessions.deviceId, deviceId));
            await db.update(scanWhatsappDevices)
              .set({ status: "disconnected", phoneNumber: null })
              .where(eq(scanWhatsappDevices.id, deviceId));
            if (this.io) this.io.to(`user_${userId}`).emit("whatsapp_status", { deviceId, status: "disconnected" });
          }
        } else if (connection === "open") {
          console.log(`[WhatsApp] Connection opened for ${deviceId}`);
          this.retryMap.delete(deviceId);
          const phoneNumberResult = sock.user?.id.split(":")[0];
          await db.update(scanWhatsappDevices)
            .set({ status: "connected", phoneNumber: phoneNumberResult, lastSeen: new Date() })
            .where(eq(scanWhatsappDevices.id, deviceId));
          if (this.io) this.io.to(`user_${userId}`).emit("whatsapp_status", { deviceId, status: "connected", phoneNumber: phoneNumberResult });
        }
      });

      // Build LID -> Phone map from contacts (fires on connect & update)
      const buildLidMap = (contacts: any[]) => {
        if (!this.lidToPhone.has(deviceId)) {
          this.lidToPhone.set(deviceId, new Map());
        }
        const deviceMap = this.lidToPhone.get(deviceId)!;
        for (const contact of contacts) {
          // Handle new Contact type shape: lid + phoneNumber or id
          const lid =
            contact?.lid?.split("@")[0] ||
            (contact?.id?.includes("@lid") ? contact.id.split("@")[0] : null);
          const phone =
            normalizePn(contact?.phoneNumber) ||
            (contact?.id?.includes("@s.whatsapp.net")
              ? contact.id.split("@")[0].split(":")[0]
              : null);
          if (lid && phone) {
            deviceMap.set(lid, phone);
          }
        }
      };
      sock.ev.on("contacts.upsert", buildLidMap);
      sock.ev.on("contacts.update", buildLidMap);

      // Handle ALL messages for Inbox (inbound + fromMe for mobile reply threading)
      sock.ev.on("messages.upsert", async (m: any) => {
        if (m.type !== "notify") return;

        for (const msg of m.messages) {
          if (!msg.message) continue;

          const key = msg.key || {};
          const isFromMe = !!key.fromMe;
          const remoteJid: string = key.remoteJid || "";

          // 1. Robust Duplicate Protection (User + Device + MessageId)
          if (key.id) {
            try {
              const [existing] = await db.select().from(scanMessages).where(
                and(
                  eq(scanMessages.userId, userId),
                  eq(scanMessages.senderDeviceId, deviceId),
                  eq(scanMessages.waMessageId, key.id)
                )
              ).limit(1);
              if (existing) continue;
            } catch (e) {}
          }

          // Skip non-personal JIDs
          if (
            !remoteJid ||
            remoteJid.includes("@g.us") ||
            remoteJid.includes("@newsletter") ||
            remoteJid.includes("@broadcast")
          ) {
            continue;
          }

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            msg.message.documentMessage?.caption ||
            (msg.message.imageMessage ? "[Image]" : 
             msg.message.videoMessage ? "[Video]" : 
             msg.message.documentMessage ? "[Document]" :
             msg.message.audioMessage ? "[Audio]" : "[Message]");

          // Media Metadata
          let mediaUrl: string | undefined;
          let mediaType: string | undefined;
          let fileName: string | undefined;
          let fileSize: number | undefined;

          // Check if message contains media
          const mediaTypeKey = Object.keys(msg.message).find(k => 
            ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'].includes(k)
          );

          if (mediaTypeKey) {
            try {
              console.log(`[WhatsApp] Downloading media of type: ${mediaTypeKey}`);
              const buffer = await downloadMediaMessage(msg, 'buffer', {});
              
              const mediaData = msg.message[mediaTypeKey];
              const originalFileName = mediaData.fileName || (mediaTypeKey === 'imageMessage' ? 'image.jpg' : mediaTypeKey === 'videoMessage' ? 'video.mp4' : 'file');
              const mimeType = mediaData.mimetype;

              // Upload to R2
              const uploadResult = await MediaStorageService.uploadToR2(buffer, originalFileName, mimeType);
              
              mediaUrl = uploadResult.url;
              mediaType = uploadResult.mediaType;
              fileName = uploadResult.fileName;
              fileSize = uploadResult.fileSize;
              
              console.log(`[WhatsApp] Media uploaded to R2: ${mediaUrl}`);
            } catch (err) {
              console.error("[WhatsApp] Media processing error:", err);
            }
          }

          const resolved = resolveCanonicalContactId(msg);
          let conversationKey = resolved.canonicalId;
          const remoteJidAlt = resolved.remoteJidAlt;

          // ── Advanced Correlation & Persistence Logic ───────────────────
          let existingConvId: string | null = null;
          let inferenceApplied = false;

          try {
            // LAYER 1a: When senderPn is known, look up by phone number FIRST.
            // This prevents a stale LID stored on another conversation from hijacking this message.
            let conv: any;
            if (resolved.pn) {
              [conv] = await db.select().from(scanConversations).where(
                and(
                  eq(scanConversations.userId, userId),
                  eq(scanConversations.deviceId, deviceId),
                  eq(scanConversations.remoteNumber, resolved.pn)
                )
              ).limit(1);
            }

            // LAYER 1b: JID-based fallback when phone is not known
            if (!conv) {
              const filters: any[] = [eq(scanConversations.remoteJid, remoteJid)];
              if (!resolved.pn) filters.unshift(eq(scanConversations.remoteNumber, conversationKey));
              if (remoteJidAlt) filters.push(eq(scanConversations.remoteJid, remoteJidAlt));
              if (remoteJidAlt) filters.push(eq(scanConversations.remoteNumber, remoteJidAlt.split('@')[0]));

              [conv] = await db.select().from(scanConversations).where(
                and(
                  eq(scanConversations.userId, userId),
                  eq(scanConversations.deviceId, deviceId),
                  or(...filters)
                )
              ).limit(1);
            }

            // Always use actual phone as conversation key when known
            if (resolved.pn) conversationKey = resolved.pn;

            if (conv) {
              existingConvId = conv.id;
              if (resolved.isLid && !conv.remoteJid) {
                await db.update(scanConversations)
                  .set({ remoteJid: remoteJid, updatedAt: new Date() })
                  .where(eq(scanConversations.id, conv.id));
                console.log(`[WhatsApp] Persistently linked LID ${remoteJid} to conversation ${conv.remoteNumber}`);
              }
            } else if (!isFromMe && resolved.isLid) {
              // LAYER 2: Smart Inference — only when sender phone is unknown
              const [recentCandidate] = await db.select()
                .from(scanConversations)
                .where(
                  and(
                    eq(scanConversations.userId, userId),
                    eq(scanConversations.deviceId, deviceId),
                    like(scanConversations.remoteNumber, '%')
                  )
                )
                .orderBy(desc(scanConversations.updatedAt))
                .limit(5);

              if (recentCandidate && !recentCandidate.remoteNumber.includes("@")) {
                existingConvId = recentCandidate.id;
                inferenceApplied = true;
                await db.update(scanConversations)
                  .set({ remoteJid: remoteJid, updatedAt: new Date() })
                  .where(eq(scanConversations.id, recentCandidate.id));

                console.log(`[WhatsApp] Inferred & Linked campaign recipient: ${recentCandidate.remoteNumber} -> ${remoteJid}`);
              }
            }

            // ── Save/Update Conversation & Message ────────────────────────
            let targetConv;
            if (existingConvId) {
              [targetConv] = await db.update(scanConversations)
                .set({
                  lastMessage: text,
                  unreadCount: isFromMe ? 0 : (conv?.unreadCount || 0) + 1,
                  lastMessageAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(scanConversations.id, existingConvId))
                .returning();
            } else {
              [targetConv] = await db.insert(scanConversations).values({
                userId,
                deviceId,
                remoteNumber: conversationKey,
                remoteJid: resolved.isLid ? remoteJid : null,
                remoteJidAlt: remoteJidAlt || null,
                lastMessage: text,
                unreadCount: isFromMe ? 0 : 1,
              }).returning();
            }

            // Insert message
            const [newMsg] = await db.insert(scanMessages).values({
              userId,
              conversationId: targetConv.id,
              senderDeviceId: deviceId,
              receiverNumber: targetConv.remoteNumber,
              direction: isFromMe ? "outbound" : "inbound",
              content: text,
              status: isFromMe ? "sent" : "delivered",
              waMessageId: key.id,
              mediaUrl,
              mediaType,
              fileName,
              fileSize,
              caption: msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.documentMessage?.caption,
            }).returning();

            if (this.io) {
              this.io.to(`user_${userId}`).emit("scan_new_message", {
                conversation: targetConv,
                message: newMsg,
              });
            }

            // Trigger auto reply for inbound messages from campaign contacts
            if (!isFromMe) {
              const actualSender = resolved.pn || targetConv.remoteNumber;
              this.scheduleAutoReply(userId, actualSender, deviceId, targetConv.id).catch((err) =>
                console.error("[AutoReply] Schedule error:", err)
              );
            }
          } catch (err) {
            console.error("[WhatsApp] Core message processing error:", err);
          }
        }
      });

      // ── Message Status Updates (Ticks) ──────────────────────────────────
      // Status codes from WhatsApp proto:
      // 1 = PENDING, 2 = SERVER_ACK (sent), 3 = DELIVERY_ACK (delivered), 4 = READ, 5 = PLAYED
      sock.ev.on("messages.update", async (updates: any[]) => {
        for (const update of updates) {
          try {
            const { key, update: msgUpdate } = update;
            if (!key?.id || !msgUpdate?.status) continue;

            // Only care about our outbound messages
            if (!key.fromMe) continue;

            const statusCode = msgUpdate.status;

            // Map proto status code -> our DB string
            let newStatus: string | null = null;
            if (statusCode === 2) newStatus = "sent";
            else if (statusCode === 3) newStatus = "delivered";
            else if (statusCode === 4 || statusCode === 5) newStatus = "read";

            if (!newStatus) continue;

            // Find the message in DB by waMessageId
            const [existingMsg] = await db
              .select()
              .from(scanMessages)
              .where(
                and(
                  eq(scanMessages.waMessageId, key.id),
                  eq(scanMessages.senderDeviceId, deviceId)
                )
              )
              .limit(1);

            if (!existingMsg) continue;

            // Only upgrade status (don't go backwards: read → delivered)
            const statusRank: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
            const currentRank = statusRank[existingMsg.status || "sent"] || 0;
            const newRank = statusRank[newStatus] || 0;
            if (newRank <= currentRank) continue;

            // Update DB
            await db
              .update(scanMessages)
              .set({ status: newStatus, updatedAt: new Date() })
              .where(eq(scanMessages.id, existingMsg.id));

            // Emit real-time update to frontend via Socket.io
            if (this.io) {
              this.io.to(`user_${userId}`).emit("scan_message_status", {
                messageId: existingMsg.id,
                waMessageId: key.id,
                conversationId: existingMsg.conversationId,
                status: newStatus,
              });
            }

            console.log(`[WhatsApp] Status update: ${key.id} → ${newStatus}`);
          } catch (err) {
            console.error("[WhatsApp] messages.update handler error:", err);
          }
        }
      });
      // ────────────────────────────────────────────────────────────────────

      return sock;
    } catch (err: any) {
      this.pendingInitializations.delete(deviceId);
      console.error(`[WhatsApp] CRITICAL initialization error for ${deviceId}:`, err?.message || err);
    }
  }

  async getSession(deviceId: string) {
    return this.sessions.get(deviceId);
  }

  async logout(deviceId: string) {
    const sock = this.sessions.get(deviceId);
    if (sock) {
      try { await sock.logout(); } catch (_) {}
      this.sessions.delete(deviceId);
    }
  }

  async sendMessage(deviceId: string, remoteJid: string, text: string, media?: { url: string, type: string, fileName?: string }) {
    const sock = this.sessions.get(deviceId);
    if (!sock) throw new Error("No active session for this device");
    
    let jid = remoteJid;
    if (!jid.includes("@")) {
      jid = `${remoteJid.replace(/\D/g, "")}@s.whatsapp.net`;
    }

    if (media && media.url) {
      let mediaType = media.type;
      
      // Auto-detect type from extension if it's an image
      const urlLower = media.url.toLowerCase();
      if (urlLower.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        mediaType = 'image';
      } else if (urlLower.match(/\.(mp4|mov|avi|mkv)$/)) {
        mediaType = 'video';
      } else if (urlLower.match(/\.(mp3|ogg|wav|m4a)$/)) {
        mediaType = 'audio';
      }

      const mediaConfig: any = { caption: text };
      
      let mediaContent: any = { url: media.url };

      // Fetch from R2 if it's our internal URL
      if (media.url.includes('cloudflarestorage.com') || media.url.includes('digitaloceanspaces.com')) {
        try {
          const storage = await createDOClient();
          if (storage) {
            const { s3, bucket } = storage;
            // Extract key from URL (everything after the bucket name)
            const urlObj = new URL(media.url);
            let key = urlObj.pathname.split('/').slice(2).join('/'); // Skip empty and bucket
            if (urlObj.host.includes(bucket) && !urlObj.pathname.startsWith(`/${bucket}`)) {
               key = urlObj.pathname.substring(1); // Virtual hosted style
            }

            const command = new GetObjectCommand({
              Bucket: bucket,
              Key: key
            });
            const response = await s3.send(command);
            const chunks = [];
            for await (const chunk of response.Body as any) {
              chunks.push(chunk);
            }
            mediaContent = Buffer.concat(chunks);
            console.log(`[WhatsApp] Successfully fetched buffer from R2 for ${key}`);
          }
        } catch (err) {
          console.error("[WhatsApp] Failed to fetch buffer from R2, falling back to URL:", err);
        }
      }

      if (mediaType === 'image') {
        return await sock.sendMessage(jid, { image: typeof mediaContent === 'string' ? { url: mediaContent } : mediaContent, ...mediaConfig });
      } else if (mediaType === 'video') {
        return await sock.sendMessage(jid, { video: typeof mediaContent === 'string' ? { url: mediaContent } : mediaContent, ...mediaConfig });
      } else if (mediaType === 'audio') {
        return await sock.sendMessage(jid, { audio: typeof mediaContent === 'string' ? { url: mediaContent } : mediaContent, ...mediaConfig });
      } else {
        return await sock.sendMessage(jid, { 
          document: typeof mediaContent === 'string' ? { url: mediaContent } : mediaContent, 
          fileName: media.fileName || 'file',
          mimetype: 'application/octet-stream',
          ...mediaConfig 
        });
      }
    }

    return await sock.sendMessage(jid, { text });
  }

  // Check if an inbound message is from a campaign contact and schedule an auto reply
  async scheduleAutoReply(userId: string, remoteNumber: string, deviceId: string, conversationId?: string) {
    console.log(`[AutoReply] Triggered — userId=${userId} remoteNumber=${remoteNumber} deviceId=${deviceId}`);

    const campaigns = await db
      .select()
      .from(scanCampaigns)
      .where(and(eq(scanCampaigns.userId, userId), eq(scanCampaigns.autoReplyEnabled, true)));

    console.log(`[AutoReply] Found ${campaigns.length} campaign(s) with autoReplyEnabled=true`);

    for (const campaign of campaigns) {
      console.log(`[AutoReply] Checking campaign "${campaign.name}" (id=${campaign.id})`);

      if (!campaign.contactListId) {
        console.log(`[AutoReply] Skipping — no contactListId`);
        continue;
      }

      const autoReplyIds = campaign.autoReplyMessageIds as string[];
      if (!autoReplyIds || autoReplyIds.length === 0) {
        console.log(`[AutoReply] Skipping — no autoReplyMessageIds`);
        continue;
      }

      const contactList = await db.select().from(scanContacts).where(eq(scanContacts.id, campaign.contactListId)).limit(1);
      if (!contactList.length) {
        console.log(`[AutoReply] Skipping — contact list not found`);
        continue;
      }

      const phones = contactList[0].phoneNumbers as string[];
      const normalize = (p: string) => p.replace(/\D/g, "").slice(-10);
      const normalizedRemote = normalize(remoteNumber);
      console.log(`[AutoReply] normalizedRemote="${normalizedRemote}" phones=${JSON.stringify(phones.map(normalize))}`);

      const isRecipient = phones.some((p) => normalize(p) === normalizedRemote);
      if (!isRecipient) {
        console.log(`[AutoReply] Skipping — ${remoteNumber} not in contact list`);
        continue;
      }

      const existing = await db
        .select()
        .from(scanAutoReplyLogs)
        .where(
          and(
            eq(scanAutoReplyLogs.userId, userId),
            eq(scanAutoReplyLogs.campaignId, campaign.id),
            eq(scanAutoReplyLogs.contactPhone, remoteNumber)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`[AutoReply] Skipping — already sent/scheduled for ${remoteNumber}`);
        continue;
      }

      const robinIdx = campaign.autoReplyRobinIndex ?? 0;
      const selectedId = autoReplyIds[robinIdx % autoReplyIds.length];
      console.log(`[AutoReply] Selected message id=${selectedId} (robin index ${robinIdx})`);

      await db
        .update(scanCampaigns)
        .set({ autoReplyRobinIndex: robinIdx + 1, updatedAt: new Date() })
        .where(eq(scanCampaigns.id, campaign.id));

      const delayMs = (campaign.autoReplyDelay ?? 0) * 60 * 1000;
      const scheduledAt = new Date(Date.now() + delayMs);
      console.log(`[AutoReply] Scheduled in ${campaign.autoReplyDelay} min (${delayMs}ms) at ${scheduledAt.toISOString()}`);

      await db.insert(scanAutoReplyLogs).values({
        userId,
        campaignId: campaign.id,
        autoReplyId: selectedId,
        contactPhone: remoteNumber,
        scheduledAt,
      });

      setTimeout(async () => {
        try {
          console.log(`[AutoReply] Timer fired — sending to ${remoteNumber}`);
          const [autoReply] = await db.select().from(scanAutoReplies).where(eq(scanAutoReplies.id, selectedId)).limit(1);

          if (!autoReply) {
            console.log(`[AutoReply] Message id=${selectedId} not found in DB`);
            return;
          }
          if (autoReply.status === "inactive") {
            console.log(`[AutoReply] Message "${autoReply.name}" is inactive — skipping`);
            return;
          }

          await this.sendMessage(deviceId, remoteNumber, autoReply.content);

          await db
            .update(scanAutoReplyLogs)
            .set({ sentAt: new Date() })
            .where(
              and(
                eq(scanAutoReplyLogs.userId, userId),
                eq(scanAutoReplyLogs.campaignId, campaign.id),
                eq(scanAutoReplyLogs.contactPhone, remoteNumber)
              )
            );

          // Store auto reply in inbox so it shows in chat
          let convId = conversationId;
          if (!convId) {
            const [foundConv] = await db.select().from(scanConversations).where(
              and(eq(scanConversations.userId, userId), eq(scanConversations.remoteNumber, remoteNumber))
            ).limit(1);
            convId = foundConv?.id;
          }

          if (convId) {
            const [savedMsg] = await db.insert(scanMessages).values({
              userId,
              conversationId: convId,
              senderDeviceId: deviceId,
              receiverNumber: remoteNumber,
              direction: "outbound",
              content: autoReply.content,
              status: "sent",
            }).returning();

            // Update conversation last message
            await db.update(scanConversations)
              .set({ lastMessage: autoReply.content, lastMessageAt: new Date(), updatedAt: new Date() })
              .where(eq(scanConversations.id, convId));

            if (this.io) {
              const [updatedConv] = await db.select().from(scanConversations).where(eq(scanConversations.id, convId)).limit(1);
              this.io.to(`user_${userId}`).emit("scan_new_message", {
                conversation: updatedConv,
                message: savedMsg,
              });
            }
          }

          console.log(`[AutoReply] SUCCESS — Sent "${autoReply.name}" to ${remoteNumber}`);
        } catch (err) {
          console.error("[AutoReply] Failed to send:", err);
        }
      }, delayMs);
    }
  }
}

export const whatsappManager = new WhatsappManager();
