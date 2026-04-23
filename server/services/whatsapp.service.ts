import pkg from "@whiskeysockets/baileys";
const baileysPkg = pkg as any;

const makeWASocket = baileysPkg.default || baileysPkg;
const initAuthCreds = baileysPkg.initAuthCreds;
const DisconnectReason = baileysPkg.DisconnectReason;
const makeCacheableSignalKeyStore = baileysPkg.makeCacheableSignalKeyStore;
const Browsers = baileysPkg.Browsers;
const proto = baileysPkg.proto;
const fetchLatestBaileysVersion = baileysPkg.fetchLatestBaileysVersion;
const makeInMemoryStore = baileysPkg.makeInMemoryStore;

import type {
  AuthenticationState,
  AuthenticationCreds,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { db } from "../db";
import { whatsappSessions, scanWhatsappDevices, scanConversations, scanMessages } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { Server } from "socket.io";

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

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          
          // Documentation: Handle different disconnect reasons
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isRestartRequired = statusCode === 515; // restartRequired
          const shouldReconnect = !isLoggedOut;

          console.log(`[WhatsApp] Connection closed for ${deviceId}. Status: ${statusCode || "unknown"}, Reconnect: ${shouldReconnect}`);
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
          if (!msg.message) continue; // Skip empty messages

          const key = msg.key || {};
          const isFromMe = !!key.fromMe;
          const remoteJid: string = key.remoteJid || "";

          // Skip groups, newsletters, broadcasts
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
            (msg.message.imageMessage ? "[Image]" : "[Message]");

          // ── Resolve canonical conversation key ───────────────────────────
          const resolved = resolveCanonicalContactId(msg);
          let conversationKey = resolved.canonicalId;
          let displayNumber = resolved.pn;

          // Extra fallback chain for @lid
          if (!displayNumber && resolved.isLid) {
            const rawLid = resolved.remoteJid.split("@")[0].split(":")[0];

            // 1. In-memory cache
            const cached = this.lidToPhone.get(deviceId)?.get(rawLid);
            if (cached) {
              displayNumber = cached;
              conversationKey = cached;
            } else {
              // 2. InMemoryStore
              const store = this.stores.get(deviceId);
              const storeContact = store?.contacts?.[`${rawLid}@lid`];
              const storePn =
                normalizePn(storeContact?.phoneNumber) || jidToPn(storeContact?.id);
              if (storePn) {
                displayNumber = storePn;
                conversationKey = storePn;
                if (!this.lidToPhone.has(deviceId)) this.lidToPhone.set(deviceId, new Map());
                this.lidToPhone.get(deviceId)!.set(rawLid, storePn);
              } else {
                // 3. signalRepository async lookup
                try {
                  const repo = (sock as any).signalRepository?.lidMapping;
                  const repoPn =
                    (await repo?.getPNForLID?.(`${rawLid}@lid`)) ||
                    (await repo?.getPNForLID?.(rawLid));
                  if (repoPn) {
                    const cleanPn = normalizePn(repoPn) || jidToPn(repoPn);
                    if (cleanPn) {
                      displayNumber = cleanPn;
                      conversationKey = cleanPn;
                      if (!this.lidToPhone.has(deviceId)) this.lidToPhone.set(deviceId, new Map());
                      this.lidToPhone.get(deviceId)!.set(rawLid, cleanPn);
                    }
                  }
                } catch (_) {}

                // 4. Final fallback: use full JID (not bare numeric digits)
                if (!conversationKey || conversationKey === rawLid) {
                  conversationKey = remoteJid; // e.g. 178395778416742@lid
                }
              }
            }
          }

          console.log(
            `[WhatsApp] ${isFromMe ? "outbound" : "inbound"} | key=${conversationKey} | pn=${displayNumber || "n/a"} | jid=${remoteJid} | alt=${resolved.remoteJidAlt || "n/a"}`
          );

          try {
            // 1. Find or create conversation by canonical key
            let [conv] = await db.select().from(scanConversations).where(
              and(
                eq(scanConversations.userId, userId),
                eq(scanConversations.deviceId, deviceId),
                eq(scanConversations.remoteNumber, conversationKey)
              )
            ).limit(1);

            if (!conv) {
              [conv] = await db.insert(scanConversations).values({
                userId,
                deviceId,
                remoteNumber: conversationKey,
                lastMessage: text,
                unreadCount: isFromMe ? 0 : 1,
              }).returning();
            } else {
              [conv] = await db.update(scanConversations)
                .set({
                  lastMessage: text,
                  unreadCount: isFromMe
                    ? (conv.unreadCount || 0)
                    : (conv.unreadCount || 0) + 1,
                  lastMessageAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(scanConversations.id, conv.id))
                .returning();
            }

            // 2. Insert message record
            const [newMsg] = await db.insert(scanMessages).values({
              userId,
              conversationId: conv.id,
              senderDeviceId: deviceId,
              receiverNumber: conversationKey,
              direction: isFromMe ? "outbound" : "inbound",
              content: text,
              status: isFromMe ? "sent" : "delivered",
              waMessageId: key.id,
            }).returning();

            // 3. Emit live update
            if (this.io) {
              this.io.to(`user_${userId}`).emit("scan_new_message", {
                conversation: conv,
                message: newMsg,
              });
            }
          } catch (err) {
            console.error("[WhatsApp] Error saving message:", err);
          }
        }
      });

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

  async sendMessage(deviceId: string, remoteJid: string, text: string) {
    const sock = this.sessions.get(deviceId);
    if (!sock) throw new Error("No active session for this device");
    // If bare number, convert to @s.whatsapp.net JID
    // If already a full JID (including @lid), use as-is
    let jid = remoteJid;
    if (!jid.includes("@")) {
      jid = `${remoteJid.replace(/\D/g, "")}@s.whatsapp.net`;
    }
    return await sock.sendMessage(jid, { text });
  }
}

export const whatsappManager = new WhatsappManager();
