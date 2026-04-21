import { io, Socket } from "socket.io-client";

const API_BASE = `${window.location.origin}`;
export const socket: Socket = io(API_BASE, {
  transports: ["websocket", "polling"],
  autoConnect: true
});

socket.on("connect", () => {
  console.log("[Socket] Connected to server");
});

socket.on("disconnect", () => {
  console.log("[Socket] Disconnected from server");
});
