import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

const roomUsers = new Map<
  string,
  Map<string, { userId: string; name: string; color: string }>
>();

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
];

export function getIO(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 5e6,
    // Use polling first, then upgrade — more reliable
    transports: ["polling", "websocket"],
  });

  io.on("connection", (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);
    let currentRoom: string | null = null;

    socket.on("join-room", ({ roomId, userId, name }) => {
      currentRoom = roomId;
      socket.join(roomId);

      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
      const users = roomUsers.get(roomId)!;
      const color = COLORS[users.size % COLORS.length];
      users.set(socket.id, { userId, name, color });

      io!.to(roomId).emit("room-users", Array.from(users.values()));
      console.log(`[socket] ${name} joined ${roomId} (${users.size} users)`);
    });

    socket.on("drawing-update", ({ roomId, elements }) => {
      socket.to(roomId).emit("drawing-update", { elements });
    });

    socket.on("files-update", ({ roomId, files }) => {
      socket.to(roomId).emit("files-update", { files });
    });

    socket.on("cursor-move", ({ roomId, cursor }) => {
      const users = roomUsers.get(roomId);
      const user = users?.get(socket.id);
      if (user) {
        socket.volatile.to(roomId).emit("cursor-move", {
          x: cursor.x,
          y: cursor.y,
          tool: cursor.tool || "pointer",
          ...user,
        });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] client disconnected: ${socket.id} (${reason})`);
      if (currentRoom) {
        const users = roomUsers.get(currentRoom);
        if (users) {
          users.delete(socket.id);
          if (users.size === 0) {
            roomUsers.delete(currentRoom);
          } else {
            io!.to(currentRoom).emit("room-users", Array.from(users.values()));
          }
        }
      }
    });
  });

  return io;
}
