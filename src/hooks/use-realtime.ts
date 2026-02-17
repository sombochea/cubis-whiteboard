"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";

interface RoomUser {
  userId: string;
  name: string;
  color: string;
}

interface UseRealtimeOptions {
  roomId: string;
  userId: string;
  userName: string;
}

interface RealtimeHandle {
  emitDrawingUpdate: (elements: unknown[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitCursorMove: (cursor: any) => void;
  emitFiles: (files: Record<string, unknown>) => void;
  onDrawingUpdate: (cb: (data: { elements: unknown[] }) => void) => void;
  onFilesUpdate: (cb: (data: { files: Record<string, unknown> }) => void) => void;
  onCursorMove: (cb: (data: unknown) => void) => void;
  onRoomUsers: (cb: (users: RoomUser[]) => void) => void;
}

export function useRealtime({
  roomId,
  userId,
  userName,
}: UseRealtimeOptions): RealtimeHandle {
  const socketRef = useRef<Socket | null>(null);
  const drawingCbRef = useRef<((data: { elements: unknown[] }) => void) | null>(null);
  const filesCbRef = useRef<((data: { files: Record<string, unknown> }) => void) | null>(null);
  const cursorCbRef = useRef<((data: unknown) => void) | null>(null);
  const usersCbRef = useRef<((users: RoomUser[]) => void) | null>(null);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingElements = useRef<unknown[] | null>(null);

  useEffect(() => {
    const socket = io({
      path: "/api/socketio",
      transports: ["polling", "websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[realtime] connected, joining room", roomId);
      socket.emit("join-room", { roomId, userId, name: userName });
    });

    socket.on("drawing-update", (data: { elements: unknown[] }) => {
      drawingCbRef.current?.(data);
    });

    socket.on("files-update", (data: { files: Record<string, unknown> }) => {
      filesCbRef.current?.(data);
    });

    socket.on("cursor-move", (data: unknown) => {
      cursorCbRef.current?.(data);
    });

    socket.on("room-users", (users: RoomUser[]) => {
      usersCbRef.current?.(users);
    });

    socket.on("connect_error", (err) => {
      console.error("[realtime] connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      clearTimeout(emitTimerRef.current);
    };
  }, [roomId, userId, userName]);

  // Throttled element emit — max once per 100ms
  const emitDrawingUpdate = useCallback(
    (elements: unknown[]) => {
      pendingElements.current = elements;
      if (!emitTimerRef.current) {
        emitTimerRef.current = setTimeout(() => {
          emitTimerRef.current = undefined;
          if (pendingElements.current) {
            socketRef.current?.emit("drawing-update", {
              roomId,
              elements: pendingElements.current,
            });
            pendingElements.current = null;
          }
        }, 100);
      }
    },
    [roomId]
  );

  // Files sent separately and infrequently
  const emitFiles = useCallback(
    (files: Record<string, unknown>) => {
      socketRef.current?.emit("files-update", { roomId, files });
    },
    [roomId]
  );

  const emitCursorMove = useCallback(
    (cursor: { x: number; y: number; tool?: string; button?: string }) => {
      socketRef.current?.volatile.emit("cursor-move", { roomId, cursor });
    },
    [roomId]
  );

  // Register callbacks via refs to avoid stale closures
  const onDrawingUpdate = useCallback(
    (cb: (data: { elements: unknown[] }) => void) => {
      drawingCbRef.current = cb;
    },
    []
  );

  const onFilesUpdate = useCallback(
    (cb: (data: { files: Record<string, unknown> }) => void) => {
      filesCbRef.current = cb;
    },
    []
  );

  const onCursorMove = useCallback(
    (cb: (data: unknown) => void) => {
      cursorCbRef.current = cb;
    },
    []
  );

  const onRoomUsers = useCallback(
    (cb: (users: RoomUser[]) => void) => {
      usersCbRef.current = cb;
    },
    []
  );

  return useMemo(() => ({
    emitDrawingUpdate,
    emitCursorMove,
    emitFiles,
    onDrawingUpdate,
    onFilesUpdate,
    onCursorMove,
    onRoomUsers,
  }), [emitDrawingUpdate, emitCursorMove, emitFiles, onDrawingUpdate, onFilesUpdate, onCursorMove, onRoomUsers]);
}
