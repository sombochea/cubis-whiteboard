"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

interface Props {
  whiteboardId: string;
  title: string;
  data: any;
  isLoggedIn: boolean;
  requestStatus: "none" | "pending" | "denied" | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

export default function PublicBoard({ whiteboardId, title, data: raw, isLoggedIn, requestStatus: initialStatus, userId, userName, userEmail }: Props) {
  const [Exc, setExc] = useState<any>(null);
  const [reqStatus, setReqStatus] = useState(initialStatus);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  useEffect(() => {
    // @ts-expect-error -- CSS module loaded at runtime
    import("@excalidraw/excalidraw/index.css");
    import("@excalidraw/excalidraw").then((m) => setExc(() => m.Excalidraw));
  }, []);

  // Socket connection for realtime access-response
  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    const s = io({ path: "/api/socketio", transports: ["polling", "websocket"] });
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("watch-board", { boardId: whiteboardId });
    });

    s.on("access-response", ({ userId: targetId, action }: { userId: string; action: string }) => {
      if (targetId !== userId) return;
      if (action === "approved") {
        toast.success("Access granted! Redirecting…");
        setTimeout(() => router.push(`/whiteboards/${whiteboardId}`), 1000);
      } else {
        setReqStatus("denied");
        toast.error("Your request was denied");
      }
    });

    s.on("access-changed", ({ userId: targetId, role }: { userId: string; role: string }) => {
      if (targetId !== userId) return;
      if (role === "editor") {
        toast.success("You now have editor access! Redirecting…");
        setTimeout(() => router.push(`/whiteboards/${whiteboardId}`), 1000);
      }
    });

    s.on("access-revoked", ({ userId: targetId }: { userId: string }) => {
      if (targetId !== userId) return;
      toast.error("Your access has been revoked");
      setReqStatus("none");
    });

    return () => { s.disconnect(); };
  }, [isLoggedIn, userId, whiteboardId, router]);

  const requestAccess = async () => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/access-requests`, { method: "POST" });
    if (res.ok || res.status === 200) {
      setReqStatus("pending");
      toast.success("Request sent! The owner will review it.");
      // Notify owner in realtime
      socketRef.current?.emit("access-request", { boardId: whiteboardId, userName, userEmail });
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Failed to send request");
    }
  };

  const init = useMemo(() => ({
    elements: (raw?.elements as any) || [],
    appState: { ...(raw?.appState || {}), viewBackgroundColor: "#ffffff", collaborators: new Map() },
    files: raw?.files ? Object.values(raw.files) : [],
  }), [raw]);

  if (!Exc) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6965db] border-t-transparent" />
        <p className="text-sm text-[#8b8b8e]">Loading board…</p>
      </div>
    </div>
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0">
        <Exc initialData={init} viewModeEnabled={true} UIOptions={{ canvasActions: { loadScene: false } }} />
      </div>
      <div className="absolute inset-0 pointer-events-none z-[10]">
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg px-3 py-1.5 shadow-sm min-w-0">
            <span className="text-xs font-semibold text-[var(--foreground)] truncate">{title}</span>
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 shrink-0">Public</span>
          </div>

          {!isLoggedIn ? (
            <div className="pointer-events-auto flex items-center gap-1.5">
              <Link href="/login" className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg text-[var(--muted-foreground)] shadow-sm transition-colors hover:bg-[var(--muted)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </Link>
              <Link href="/login" className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg px-3 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--muted)]">
                Sign in to edit
              </Link>
            </div>
          ) : reqStatus === "pending" ? (
            <div className="pointer-events-auto flex items-center gap-1.5">
              <Link href="/whiteboards" className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg text-[var(--muted-foreground)] shadow-sm transition-colors hover:bg-[var(--muted)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </Link>
              <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50/90 backdrop-blur-lg px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm">
                Request pending…
              </div>
            </div>
          ) : reqStatus === "denied" ? (
            <div className="pointer-events-auto flex items-center gap-1.5">
              <Link href="/whiteboards" className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg text-[var(--muted-foreground)] shadow-sm transition-colors hover:bg-[var(--muted)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </Link>
              <button
                onClick={requestAccess}
                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/90 backdrop-blur-lg px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100/90"
              >
                Request denied
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              </button>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center gap-1.5">
              <Link href="/whiteboards" className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg text-[var(--muted-foreground)] shadow-sm transition-colors hover:bg-[var(--muted)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </Link>
              <button
                onClick={requestAccess}
                className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Request edit access
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
