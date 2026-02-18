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
  onAccessRevoked: (cb: (data: { userId: string }) => void) => void;
  onAccessChanged: (cb: (data: { userId: string; role: string }) => void) => void;
}

// ── WebRTC peer wrapper ──
interface Peer {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  ready: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useRealtime({
  roomId,
  userId,
  userName,
}: UseRealtimeOptions): RealtimeHandle {
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const drawingCbRef = useRef<((data: { elements: unknown[] }) => void) | null>(null);
  const filesCbRef = useRef<((data: { files: Record<string, unknown> }) => void) | null>(null);
  const cursorCbRef = useRef<((data: unknown) => void) | null>(null);
  const usersCbRef = useRef<((users: RoomUser[]) => void) | null>(null);
  const accessRevokedCbRef = useRef<((data: { userId: string }) => void) | null>(null);
  const accessChangedCbRef = useRef<((data: { userId: string; role: string }) => void) | null>(null);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingElements = useRef<unknown[] | null>(null);

  // Handle incoming data channel messages
  const handleDcMessage = useCallback((ev: MessageEvent) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.t === "d") drawingCbRef.current?.({ elements: msg.e });
      else if (msg.t === "c") cursorCbRef.current?.(msg.d);
    } catch { /* ignore malformed */ }
  }, []);

  // Setup a data channel (either created or received)
  const setupDc = useCallback((socketId: string, dc: RTCDataChannel) => {
    const peer = peersRef.current.get(socketId);
    if (!peer) return;
    peer.dc = dc;
    dc.onopen = () => { peer.ready = true; };
    dc.onclose = () => { peer.ready = false; };
    dc.onmessage = handleDcMessage;
  }, [handleDcMessage]);

  // Create a new peer connection and initiate offer
  const createPeer = useCallback(async (socketId: string, initiator: boolean) => {
    const socket = socketRef.current;
    if (!socket) return;

    // Clean up existing
    peersRef.current.get(socketId)?.pc.close();

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer: Peer = { pc, dc: null, ready: false };
    peersRef.current.set(socketId, peer);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("rtc-signal", { to: socketId, signal: { candidate: e.candidate } });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        peer.ready = false;
      }
    };

    if (initiator) {
      const dc = pc.createDataChannel("draw", { ordered: false, maxRetransmits: 0 });
      setupDc(socketId, dc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("rtc-signal", { to: socketId, signal: { sdp: pc.localDescription } });
    } else {
      pc.ondatachannel = (e) => setupDc(socketId, e.channel);
    }

    return peer;
  }, [setupDc]);

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

    // ── WebRTC signaling ──
    socket.on("peer-joined", async ({ socketId }: { socketId: string }) => {
      // We are the existing peer — initiate the offer
      await createPeer(socketId, true);
    });

    socket.on("rtc-signal", async ({ from, signal }: { from: string; signal: any }) => {
      let peer = peersRef.current.get(from);

      if (signal.sdp) {
        if (signal.sdp.type === "offer") {
          // We received an offer — create answering peer
          peer = await createPeer(from, false);
          if (!peer) return;
          await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          socket.emit("rtc-signal", { to: from, signal: { sdp: peer.pc.localDescription } });
        } else if (signal.sdp.type === "answer" && peer) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.candidate && peer) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
      }
    });

    socket.on("peer-left", ({ socketId }: { socketId: string }) => {
      const peer = peersRef.current.get(socketId);
      if (peer) {
        peer.pc.close();
        peersRef.current.delete(socketId);
      }
    });

    // ── Socket.IO fallback listeners (used when P2P not available) ──
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

    socket.on("access-revoked", (data: { userId: string }) => {
      accessRevokedCbRef.current?.(data);
    });

    socket.on("access-changed", (data: { userId: string; role: string }) => {
      accessChangedCbRef.current?.(data);
    });

    socket.on("connect_error", (err) => {
      console.error("[realtime] connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      clearTimeout(emitTimerRef.current);
      // Close all peer connections
      for (const peer of peersRef.current.values()) peer.pc.close();
      peersRef.current.clear();
    };
  }, [roomId, userId, userName, createPeer]);

  // ── Broadcast to all P2P peers, returns true if at least one peer received it ──
  const broadcastP2P = useCallback((msg: string): boolean => {
    let sent = false;
    for (const peer of peersRef.current.values()) {
      if (peer.ready && peer.dc?.readyState === "open") {
        try { peer.dc.send(msg); sent = true; } catch { /* channel closing */ }
      }
    }
    return sent;
  }, []);

  // Throttled element emit — P2P first, Socket.IO fallback
  const emitDrawingUpdate = useCallback(
    (elements: unknown[]) => {
      pendingElements.current = elements;
      if (!emitTimerRef.current) {
        emitTimerRef.current = setTimeout(() => {
          emitTimerRef.current = undefined;
          if (pendingElements.current) {
            const payload = pendingElements.current;
            pendingElements.current = null;
            // Try P2P first
            const sentP2P = broadcastP2P(JSON.stringify({ t: "d", e: payload }));
            // Always send via Socket.IO too — server needs it for late joiners
            // But if P2P worked, we could skip. For simplicity & reliability, always relay.
            socketRef.current?.emit("drawing-update", { roomId, elements: payload });
          }
        }, 100);
      }
    },
    [roomId, broadcastP2P]
  );

  // Files: always Socket.IO (large payloads, infrequent)
  const emitFiles = useCallback(
    (files: Record<string, unknown>) => {
      socketRef.current?.emit("files-update", { roomId, files });
    },
    [roomId]
  );

  // Cursors: P2P first (latency-critical), Socket.IO fallback
  const emitCursorMove = useCallback(
    (cursor: { x: number; y: number; tool?: string; button?: string }) => {
      const msg = JSON.stringify({ t: "c", d: { ...cursor, userId, name: userName } });
      const sentP2P = broadcastP2P(msg);
      if (!sentP2P) {
        socketRef.current?.volatile.emit("cursor-move", { roomId, cursor });
      }
    },
    [roomId, userId, userName, broadcastP2P]
  );

  const onDrawingUpdate = useCallback((cb: (data: { elements: unknown[] }) => void) => { drawingCbRef.current = cb; }, []);
  const onFilesUpdate = useCallback((cb: (data: { files: Record<string, unknown> }) => void) => { filesCbRef.current = cb; }, []);
  const onCursorMove = useCallback((cb: (data: unknown) => void) => { cursorCbRef.current = cb; }, []);
  const onRoomUsers = useCallback((cb: (users: RoomUser[]) => void) => { usersCbRef.current = cb; }, []);
  const onAccessRevoked = useCallback((cb: (data: { userId: string }) => void) => { accessRevokedCbRef.current = cb; }, []);
  const onAccessChanged = useCallback((cb: (data: { userId: string; role: string }) => void) => { accessChangedCbRef.current = cb; }, []);

  return useMemo(() => ({
    emitDrawingUpdate,
    emitCursorMove,
    emitFiles,
    onDrawingUpdate,
    onFilesUpdate,
    onCursorMove,
    onRoomUsers,
    onAccessRevoked,
    onAccessChanged,
  }), [emitDrawingUpdate, emitCursorMove, emitFiles, onDrawingUpdate, onFilesUpdate, onCursorMove, onRoomUsers, onAccessRevoked, onAccessChanged]);
}
