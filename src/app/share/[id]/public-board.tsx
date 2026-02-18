"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";

interface Props {
  whiteboardId: string;
  title: string;
  data: any;
  isLoggedIn: boolean;
  requestStatus: "none" | "pending" | "denied" | null;
}

export default function PublicBoard({ whiteboardId, title, data: raw, isLoggedIn, requestStatus: initialStatus }: Props) {
  const [Exc, setExc] = useState<any>(null);
  const [reqStatus, setReqStatus] = useState(initialStatus);

  useEffect(() => {
    // @ts-expect-error -- CSS module loaded at runtime
    import("@excalidraw/excalidraw/index.css");
    import("@excalidraw/excalidraw").then((m) => setExc(() => m.Excalidraw));
  }, []);

  const init = useMemo(() => ({
    elements: (raw?.elements as any) || [],
    appState: { ...(raw?.appState || {}), viewBackgroundColor: "#ffffff", collaborators: new Map() },
    files: raw?.files ? Object.values(raw.files) : [],
  }), [raw]);

  const requestAccess = async () => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/access-requests`, { method: "POST" });
    if (res.ok || res.status === 200) {
      setReqStatus("pending");
      toast.success("Request sent! The owner will review it.");
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Failed to send request");
    }
  };

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
            <Link href="/login" className="pointer-events-auto shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg px-3 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--muted)]">
              Sign in to edit
            </Link>
          ) : reqStatus === "pending" ? (
            <div className="pointer-events-auto shrink-0 rounded-xl border border-amber-200 bg-amber-50/90 backdrop-blur-lg px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm">
              Request pending
            </div>
          ) : reqStatus === "denied" ? (
            <div className="pointer-events-auto shrink-0 rounded-xl border border-red-200 bg-red-50/90 backdrop-blur-lg px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm">
              Request denied
            </div>
          ) : (
            <button
              onClick={requestAccess}
              className="pointer-events-auto shrink-0 rounded-xl border border-[var(--border)] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Request edit access
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
