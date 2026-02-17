import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

// Track active users per room
const roomUsers = new Map<string, Map<string, { userId: string; name: string; color: string }>>();

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
];

export function getIO(httpServer?: HTTPServer): SocketIOServer {
  if (io) return io;
  if (!httpServer) throw new Error("Socket.IO not initialized");

  io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: { origin: process.env.NEXT_PUBLIC_APP_URL, credentials: true },
  });

  io.on("connection", (socket) => {
    let currentRoom: string | null = null;

    socket.on("join-room", ({ roomId, userId, name }) => {
      currentRoom = roomId;
      socket.join(roomId);

      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
      const users = roomUsers.get(roomId)!;
      const color = COLORS[users.size % COLORS.length];
      users.set(socket.id, { userId, name, color });

      // Broadcast updated user list
      io!.to(roomId).emit("room-users", Array.from(users.values()));
    });

    socket.on("drawing-update", ({ roomId, elements, appState, files }) => {
      socket.to(roomId).emit("drawing-update", { elements, appState, files });
    });

    socket.on("cursor-move", ({ roomId, cursor }) => {
      const users = roomUsers.get(roomId);
      const user = users?.get(socket.id);
      if (user) {
        socket.to(roomId).emit("cursor-move", { ...cursor, ...user });
      }
    });

    socket.on("disconnect", () => {
      if (currentRoom) {
        const users = roomUsers.get(currentRoom);
        if (users) {
          users.delete(socket.id);
          if (users.size === 0) roomUsers.delete(currentRoom);
          else io!.to(currentRoom).emit("room-users", Array.from(users.values()));
        }
      }
    });
  });

  return io;
}
