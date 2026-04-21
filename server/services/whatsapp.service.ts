import baileys from "@whiskeysockets/baileys";
const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  Browsers,
} = baileys;
import type {
  AuthenticationState,
  AuthenticationCreds,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { db } from "../db";
import { whatsappSessions, scanWhatsappDevices } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { Server } from "socket.io";

const logger = pino({ level: "silent" });

/**
 * Custom implementation of Baileys Auth State to store session in Postgres
 */
export async function useDatabaseAuthState(deviceId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> {
  // Load creds from DB
  const loadData = async (type: string, id: string) => {
    const result = await db.query.whatsappSessions.findFirst({
      where: and(
        eq(whatsappSessions.deviceId, deviceId),
        eq(whatsappSessions.sessionType, type),
        eq(whatsappSessions.keyId, id)
      )
    });
    return result ? result.data : null;
  };

  const writeData = async (data: any, type: string, id: string) => {
    const existing = await db.query.whatsappSessions.findFirst({
      where: and(
        eq(whatsappSessions.deviceId, deviceId),
        eq(whatsappSessions.sessionType, type),
        eq(whatsappSessions.keyId, id)
      )
    });

    if (existing) {
      await db.update(whatsappSessions)
        .set({ data, updatedAt: new Date() })
        .where(eq(whatsappSessions.id, existing.id));
    } else {
      await db.insert(whatsappSessions).values({
        deviceId,
        sessionType: type,
        keyId: id,
        data,
      });
    }
  };

  const removeData = async (type: string, id: string) => {
    await db.delete(whatsappSessions)
      .where(and(
        eq(whatsappSessions.deviceId, deviceId),
        eq(whatsappSessions.sessionType, type),
        eq(whatsappSessions.keyId, id)
      ));
  };

  const creds: AuthenticationCreds = (await loadData("creds", "creds")) || (await import("@whiskeysockets/baileys")).initAuthCreds();

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
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          for (const type in data) {
            for (const id in data[type as keyof SignalDataTypeMap]) {
              const value = data[type as keyof SignalDataTypeMap]![id];
              if (value) {
                await writeData(value, type, id);
              } else {
                await removeData(type, id);
              }
            }
          }
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
  private io: Server | null = null;

  setIo(io: Server) {
    this.io = io;
  }

  private pendingInitializations: Set<string> = new Set();
  private retryMap: Map<string, number> = new Map();

  async initializeSession(deviceId: string, userId: string) {
    if (this.pendingInitializations.has(deviceId)) {
      console.log(`[WhatsApp] Initialization already pending for device: ${deviceId}`);
      return;
    }

    this.pendingInitializations.add(deviceId);

    // Kill existing session for this device first
    if (this.sessions.has(deviceId)) {
      console.log(`[WhatsApp] Killing existing session for device ${deviceId} before reinit`);
      try {
        const oldSock = this.sessions.get(deviceId);
        oldSock?.end?.(undefined);
      } catch (_) {}
      this.sessions.delete(deviceId);
    }

    const { state, saveCreds } = await useDatabaseAuthState(deviceId);
    
    // Hardcode stable version for v6 to ensure handshake reliability
    const version: [number, number, number] = [2, 2413, 1];
    console.log(`[WhatsApp] Using stable Baileys version: ${version} for device: ${deviceId}`);

    const sock = makeWASocket({
      version,
      printQRInTerminal: false,
      browser: Browsers.macOS("Desktop"), // Most stable for device linking
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 60000,
      generateHighQualityLinkPreview: true,
    });

      this.sessions.set(deviceId, sock);
      this.pendingInitializations.delete(deviceId);
      console.log(`[WhatsApp] Session created for device: ${deviceId}`);

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && this.io) {
          this.io.to(`user_${userId}`).emit("whatsapp_qr", { deviceId, qr });
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          console.log(`[WhatsApp] Connection closed for ${deviceId}. Status: ${statusCode}, Reconnecting: ${shouldReconnect}`);
          this.sessions.delete(deviceId);
          
          if (shouldReconnect) {
            // Add a 5 second delay before reconnecting to prevent tight loops
            const retries = this.retryMap.get(deviceId) || 0;
            if (retries < 5) {
              this.retryMap.set(deviceId, retries + 1);
              setTimeout(() => this.initializeSession(deviceId, userId), 5000);
            } else {
              console.error(`[WhatsApp] Max retries reached for ${deviceId}`);
              this.retryMap.delete(deviceId);
            }
          } else {
            this.retryMap.delete(deviceId);
            await db.delete(whatsappSessions).where(eq(whatsappSessions.deviceId, deviceId));
            await db.update(scanWhatsappDevices).set({ status: "disconnected", phoneNumber: null }).where(eq(scanWhatsappDevices.id, deviceId));
            if (this.io) this.io.to(`user_${userId}`).emit("whatsapp_status", { deviceId, status: "disconnected" });
          }
        } else if (connection === "open") {
          console.log(`[WhatsApp] Connection opened for ${deviceId}`);
          this.retryMap.delete(deviceId);
          const phoneNumber = sock.user?.id.split(":")[0];
          await db.update(scanWhatsappDevices).set({ status: "connected", phoneNumber, lastSeen: new Date() }).where(eq(scanWhatsappDevices.id, deviceId));
          if (this.io) this.io.to(`user_${userId}`).emit("whatsapp_status", { deviceId, status: "connected", phoneNumber });
        }
      });

      return sock;
    } catch (err) {
      this.pendingInitializations.delete(deviceId);
      console.error(`[WhatsApp] Failed to initialize socket for ${deviceId}:`, err);
      throw err;
    }
  }

  async getSession(deviceId: string) {
    return this.sessions.get(deviceId);
  }

  async logout(deviceId: string) {
    const sock = this.sessions.get(deviceId);
    if (sock) {
      await sock.logout();
      this.sessions.delete(deviceId);
    }
  }
}

export const whatsappManager = new WhatsappManager();
