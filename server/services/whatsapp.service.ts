import { 
  makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore,
  AuthenticationState,
  AuthenticationCreds,
  SignalDataTypeMap,
  proto
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

  async initializeSession(deviceId: string, userId: string) {
    // Kill existing session for this device first (to avoid multiple session conflict)
    if (this.sessions.has(deviceId)) {
      console.log(`[WhatsApp] Killing existing session for device ${deviceId} before reinit`);
      try {
        const oldSock = this.sessions.get(deviceId);
        oldSock?.end?.(undefined);
      } catch (_) {}
      this.sessions.delete(deviceId);
    }

    const { state, saveCreds } = await useDatabaseAuthState(deviceId);
    
    // Try to get latest version, fall back to known working version
    let version: any = [2, 3000, 1015901307];
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
      console.log(`[WhatsApp] Using Baileys version: ${version} for device: ${deviceId}`);
    } catch (e) {
      console.warn(`[WhatsApp] Could not fetch latest version, using fallback: ${version}`);
    }

    const { Browsers } = await import("@whiskeysockets/baileys");

    const sock = makeWASocket({
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
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: 2000,
    });

    // Store session BEFORE events to prevent race conditions
    this.sessions.set(deviceId, sock);
    console.log(`[WhatsApp] Session initialized for device: ${deviceId}`);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && this.io) {
        this.io.to(`user_${userId}`).emit("whatsapp_qr", { deviceId, qr });
      }

      if (connection === "close") {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.sessions.delete(deviceId);
        
        if (shouldReconnect) {
          this.initializeSession(deviceId, userId);
        } else {
          // Logged out, clean persistent data
          await db.delete(whatsappSessions).where(eq(whatsappSessions.deviceId, deviceId));
          await db.update(scanWhatsappDevices).set({ status: "disconnected", phoneNumber: null }).where(eq(scanWhatsappDevices.id, deviceId));
          if (this.io) this.io.to(`user_${userId}`).emit("whatsapp_status", { deviceId, status: "disconnected" });
        }
      } else if (connection === "open") {
        const phoneNumber = sock.user?.id.split(":")[0];
        await db.update(scanWhatsappDevices).set({ status: "connected", phoneNumber, lastSeen: new Date() }).where(eq(scanWhatsappDevices.id, deviceId));
        if (this.io) this.io.to(`user_${userId}`).emit("whatsapp_status", { deviceId, status: "connected", phoneNumber });
      }
    });

    return sock;
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
