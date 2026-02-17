"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseRealtimeOptions {
  roomId: string;
  userId: string;
  userName: string;
  onDrawingUpdate?: (data: { elements: unknown[]; appState: unknown; files: Record<string, unknown> }) => void;
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
    const socket = io({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName]);

  const emitDrawingUpdate = useCallback(
    (elements: unknown[], appState: unknown, files?: Record<string, unknown>) => {
      socketRef.current?.emit("drawing-update", { roomId, elements, appState, files: files || {} });
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
