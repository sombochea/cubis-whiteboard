import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as HTTPServer } from "http";
import {
  addRoomUser,
  removeRoomUser,
  getRoomUsers,
  getRoomSize,
  clearRoom,
  getPubSubClients,
} from "./redis";

let io: SocketIOServer | null = null;

// Lightweight in-process map for cursor metadata (not shared state — no need for Redis)
const socketMeta = new Map<string, { userId: string; name: string; color: string }>();

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
];

/** Broadcast room-users list only when there are active members. */
async function broadcastRoomUsers(roomId: string) {
  if (!io) return;
  const users = await getRoomUsers(roomId);
  if (users.length > 0) {
    io.to(roomId).emit("room-users", users);
  }
}

export function getIO(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 5e6,
    transports: ["polling", "websocket"],
  });

  const { pub, sub } = getPubSubClients();
  io.adapter(createAdapter(pub, sub));
  console.log("[socket] Redis adapter attached");

  io.on("connection", (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);
    let currentRoom: string | null = null;

    socket.on("join-room", async ({ roomId, userId, name }) => {
      currentRoom = roomId;
      socket.join(roomId);

      const size = await getRoomSize(roomId);
      const color = COLORS[size % COLORS.length];
      const userMeta = { userId, name, color };
      socketMeta.set(socket.id, userMeta);
      await addRoomUser(roomId, socket.id, userMeta);

      await broadcastRoomUsers(roomId);

      // Notify existing peers for WebRTC
      socket.to(roomId).emit("peer-joined", { socketId: socket.id, userId, name });
      // Tell the new peer about everyone already in the room (excluding self)
      for (const [sid, meta] of socketMeta) {
        if (sid !== socket.id && io!.sockets.adapter.rooms.get(roomId)?.has(sid)) {
          socket.emit("peer-joined", { socketId: sid, userId: meta.userId, name: meta.name });
        }
      }

      console.log(`[socket] ${name} joined ${roomId} (${io!.sockets.adapter.rooms.get(roomId)?.size ?? 1} users)`);
    });

    // ── WebRTC signaling ──
    socket.on("rtc-signal", ({ to, signal }) => {
      io!.to(to).emit("rtc-signal", { from: socket.id, signal });
    });

    socket.on("drawing-update", async ({ roomId, elements }) => {
      const room = io!.sockets.adapter.rooms.get(roomId);
      if (room && room.size > 1) {
        socket.to(roomId).emit("drawing-update", { elements });
      }
    });

    socket.on("files-update", async ({ roomId, files }) => {
      const room = io!.sockets.adapter.rooms.get(roomId);
      if (room && room.size > 1) {
        socket.to(roomId).emit("files-update", { files });
      }
    });

    socket.on("cursor-move", ({ roomId, cursor }) => {
      const room = io!.sockets.adapter.rooms.get(roomId);
      if (room && room.size > 1) {
        const meta = socketMeta.get(socket.id);
        socket.volatile.to(roomId).emit("cursor-move", {
          x: cursor.x,
          y: cursor.y,
          tool: cursor.tool || "pointer",
          button: cursor.button || "up",
          ...(meta ?? {}),
        });
      }
    });

    // ── Access control events ──
    socket.on("watch-board", ({ boardId }) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("access-request", ({ boardId, userName, userEmail }) => {
      socket.to(`board:${boardId}`).emit("access-request", { userName, userEmail });
    });

    socket.on("access-response", ({ boardId, userId: targetUserId, action }) => {
      io!.to(`board:${boardId}`).emit("access-response", { userId: targetUserId, action });
    });

    socket.on("access-revoked", ({ boardId, userId: targetUserId }) => {
      io!.to(boardId).to(`board:${boardId}`).emit("access-revoked", { userId: targetUserId });
    });

    socket.on("access-changed", ({ boardId, userId: targetUserId, role }) => {
      io!.to(boardId).to(`board:${boardId}`).emit("access-changed", { userId: targetUserId, role });
    });

    socket.on("disconnect", async (reason) => {
      console.log(`[socket] client disconnected: ${socket.id} (${reason})`);
      socketMeta.delete(socket.id);
      if (currentRoom) {
        await removeRoomUser(currentRoom, socket.id);
        const remaining = await getRoomSize(currentRoom);
        if (remaining === 0) {
          await clearRoom(currentRoom);
        } else {
          await broadcastRoomUsers(currentRoom);
          io!.to(currentRoom).emit("peer-left", { socketId: socket.id });
        }
      }
    });
  });

  return io;
}
