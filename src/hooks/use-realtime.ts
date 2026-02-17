"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseRealtimeOptions {
  roomId: string;
  userId: string;
  userName: string;
  onDrawingUpdate?: (data: { elements: unknown[]; appState: unknown }) => void;
  onCursorMove?: (data: unknown) => void;
  onRoomUsers?: (users: { userId: string; name: string; color: string }[]) => void;
}

export function useRealtime({
  roomId,
  userId,
  userName,
  onDrawingUpdate,
  onCursorMove,
  onRoomUsers,
}: UseRealtimeOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_APP_URL!, {
      path: "/api/socketio",
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", { roomId, userId, name: userName });
    });

    if (onDrawingUpdate) socket.on("drawing-update", onDrawingUpdate);
    if (onCursorMove) socket.on("cursor-move", onCursorMove);
    if (onRoomUsers) socket.on("room-users", onRoomUsers);

    return () => {
      socket.disconnect();
    };
  }, [roomId, userId, userName]);

  const emitDrawingUpdate = useCallback(
    (elements: unknown[], appState: unknown) => {
      socketRef.current?.emit("drawing-update", { roomId, elements, appState });
    },
    [roomId]
  );

  const emitCursorMove = useCallback(
    (cursor: { x: number; y: number }) => {
      socketRef.current?.emit("cursor-move", { roomId, cursor });
    },
    [roomId]
  );

  return { emitDrawingUpdate, emitCursorMove };
}
