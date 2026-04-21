import pkg from "@whiskeysockets/baileys";
const baileysPkg = pkg as any;

const makeWASocket = baileysPkg.default || baileysPkg;
const initAuthCreds = baileysPkg.initAuthCreds;
const DisconnectReason = baileysPkg.DisconnectReason;
const makeCacheableSignalKeyStore = baileysPkg.makeCacheableSignalKeyStore;
const Browsers = baileysPkg.Browsers;
const proto = baileysPkg.proto;
const fetchLatestBaileysVersion = baileysPkg.fetchLatestBaileysVersion;

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
export async function useDatabaseAuthState(deviceId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const loadData = async (type: string, id: string) => {
    try {
      const result = await db.query.whatsappSessions.findFirst({
        where: and(
          eq(whatsappSessions.deviceId, deviceId),
          eq(whatsappSessions.sessionType, type),
          eq(whatsappSessions.keyId, id)
        ),
      });
      return result ? result.data : null;
    } catch (e) {
      console.error(`[WhatsApp DB Auth] Load error for ${type}/${id}:`, e);
      return null;
    }
  };

  const writeData = async (data: any, type: string, id: string) => {
    try {
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

  const creds: AuthenticationCreds = (await loadData("creds", "creds")) || initAuthCreds();

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
  private pendingInitializations: Set<string> = new Set();
  private retryMap: Map<string, number> = new Map();
  private io: Server | null = null;

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

      // Kill existing session first
      if (this.sessions.has(deviceId)) {
        try {
          const old = this.sessions.get(deviceId);
          old?.end?.(undefined);
        } catch (_) {}
        this.sessions.delete(deviceId);
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
        browser: Browsers.macOS("Desktop"),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 60000,
      });

      // Request Pairing Code if phone number is provided
      if (phoneNumber && !sock.authState.creds.registered) {
        console.log(`[WhatsApp] ${deviceId}: Pairing code requested for ${phoneNumber}. Waiting for socket ready...`);
        setTimeout(async () => {
          try {
            const cleanNumber = phoneNumber.replace(/\D/g, "");
            console.log(`[WhatsApp] ${deviceId}: Generating pairing code for ${cleanNumber}`);
            const code = await sock.requestPairingCode(cleanNumber);
            console.log(`[WhatsApp] ${deviceId}: Pairing code generated: ${code}`);
            if (this.io) {
              this.io.to(`user_${userId}`).emit("whatsapp_pairing_code", { deviceId, code });
            }
          } catch (err: any) {
            console.error(`[WhatsApp] ${deviceId}: Pairing code request error:`, err?.message || err);
            if (this.io) {
              this.io.to(`user_${userId}`).emit("whatsapp_error", { deviceId, message: "Failed to generate pairing code. Please try again." });
            }
          }
        }, 5000);
      }

      this.sessions.set(deviceId, sock);
      this.pendingInitializations.delete(deviceId);
      console.log(`[WhatsApp] Socket ready for ${deviceId}`);

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && this.io) {
          console.log(`[WhatsApp] ${deviceId}: New QR code generated`);
          this.io.to(`user_${userId}`).emit("whatsapp_qr", { deviceId, qr });
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[WhatsApp] Connection closed for ${deviceId}. Status: ${statusCode || "unknown"}`);
          this.sessions.delete(deviceId);

          if (shouldReconnect) {
            const retries = this.retryMap.get(deviceId) || 0;
            if (retries < 3) {
              this.retryMap.set(deviceId, retries + 1);
              console.log(`[WhatsApp] Retry ${retries + 1}/3 in 10s...`);
              setTimeout(() => this.initializeSession(deviceId, userId, phoneNumber), 10000);
            } else {
              console.error(`[WhatsApp] Max retries reached for ${deviceId}`);
              this.retryMap.delete(deviceId);
              if (this.io) this.io.to(`user_${userId}`).emit("whatsapp_status", { deviceId, status: "disconnected" });
            }
          } else {
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
}

export const whatsappManager = new WhatsappManager();
