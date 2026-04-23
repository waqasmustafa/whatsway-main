import { io, Socket } from "socket.io-client";

const API_BASE = `${window.location.protocol}//${window.location.host}`;
export const socket: Socket = io(API_BASE, {
  transports: ["polling", "websocket"], // Force polling first
  withCredentials: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000
});

socket.on("connect", () => {
  console.log("[Socket] Connected to server successfully!");
});

socket.on("connect_error", (err) => {
  console.error("[Socket] Connection error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("[Socket] Disconnected:", reason);
});
