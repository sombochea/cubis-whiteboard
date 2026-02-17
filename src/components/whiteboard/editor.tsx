"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ShareDialog from "./share-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { saveToLocal, loadFromLocal, clearLocal } from "@/lib/local-store";
import "@excalidraw/excalidraw/index.css";

interface BinaryFileData {
  id: string;
  mimeType: string;
  dataURL: string;
  created?: number;
}

interface WhiteboardEditorProps {
  whiteboardId: string;
  initialData?: {
    elements?: unknown[];
    appState?: Record<string, unknown>;
    files?: Record<string, BinaryFileData>;
  };
  initialTitle?: string;
  userId: string;
  userName: string;
  userImage?: string | null;
  isOwner?: boolean;
  serverUpdatedAt?: number;
}

export default function WhiteboardEditor({
  whiteboardId,
  initialData,
  initialTitle = "Untitled",
  userId,
  userName,
  userImage,
  isOwner = false,
  serverUpdatedAt = 0,
}: WhiteboardEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ExcalidrawComp, setExcalidrawComp] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawUtils, setExcalidrawUtils] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resolvedData, setResolvedData] = useState<any>(initialData);
  const [dataReady, setDataReady] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [roomUsers, setRoomUsers] = useState<
    { userId: string; name: string; color: string }[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawRef = useRef<any>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const lastFileKeysRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collaboratorsRef = useRef<Map<string, any>>(new Map());

  // Load Excalidraw
  useEffect(() => {
    import("@excalidraw/excalidraw").then((mod) => {
      setExcalidrawComp(() => mod.Excalidraw);
      setExcalidrawUtils({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reconcileElements: (mod as any).reconcileElements,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        CaptureUpdateAction: (mod as any).CaptureUpdateAction,
      });
    });
  }, []);

  // ── Reconcile local (IndexedDB) vs server state on mount ──
  useEffect(() => {
    loadFromLocal(whiteboardId).then((local) => {
      if (local && local.savedAt > serverUpdatedAt) {
        // Local is newer — use it and push to server
        setResolvedData({ elements: local.elements, appState: local.appState, files: local.files });
        fetch(`/api/whiteboards/${whiteboardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { elements: local.elements, appState: local.appState, files: local.files } }),
        }).then(() => clearLocal(whiteboardId)).catch(() => {});
      } else {
        // Server is newer or no local — clear stale local
        clearLocal(whiteboardId).catch(() => {});
      }
      setDataReady(true);
    }).catch(() => setDataReady(true));
  }, [whiteboardId, serverUpdatedAt]);

  // ── Realtime ──
  const rt = useRealtime({ roomId: whiteboardId, userId, userName });

  // Register realtime callbacks (uses refs internally, no stale closure)
  useEffect(() => {
    rt.onDrawingUpdate(({ elements: remoteElements }) => {
      const api = excalidrawRef.current;
      if (!api) return;
      const appState = api.getAppState();
      // Don't update while user is actively drawing/resizing — it resets their in-progress element
      if (appState.newElement || appState.resizingElement || appState.draggingElement || appState.editingTextElement) return;
      const localElements = api.getSceneElements();
      if (excalidrawUtils?.reconcileElements) {
        const merged = excalidrawUtils.reconcileElements(localElements, remoteElements, appState);
        api.updateScene({ elements: merged, captureUpdate: excalidrawUtils.CaptureUpdateAction?.NEVER });
      } else {
        api.updateScene({ elements: remoteElements });
      }
    });

    rt.onFilesUpdate(({ files }) => {
      const api = excalidrawRef.current;
      if (!api || !files) return;
      const fileArray = Object.values(files).map((f: unknown) => {
        const file = f as BinaryFileData;
        return {
          id: file.id,
          mimeType: file.mimeType,
          dataURL: file.dataURL,
          created: file.created || Date.now(),
        };
      });
      if (fileArray.length > 0) api.addFiles(fileArray);
    });

    // Feed cursor positions into Excalidraw's collaborators Map for native cursor rendering
    rt.onCursorMove((data: unknown) => {
      const api = excalidrawRef.current;
      if (!api) return;
      const d = data as { userId: string; name: string; color: string; x: number; y: number; button?: string; tool?: string };
      // Must create a NEW Map — Excalidraw won't re-render if same reference
      const updated = new Map(collaboratorsRef.current);
      updated.set(d.userId, {
        username: d.name,
        pointer: { x: d.x, y: d.y, tool: (d.tool || "pointer") as "pointer" | "laser" },
        button: d.button || "up",
        color: { background: d.color, stroke: d.color },
      });
      collaboratorsRef.current = updated;
      api.updateScene({ collaborators: updated });
    });

    rt.onRoomUsers((users) => {
      setRoomUsers(users);
      const api = excalidrawRef.current;
      if (!api) return;
      const updated = new Map<string, { username?: string; color?: { background: string; stroke: string } }>();
      for (const u of users) {
        if (u.userId === userId) continue;
        const existing = collaboratorsRef.current.get(u.userId);
        updated.set(u.userId, existing || {
          username: u.name,
          color: { background: u.color, stroke: u.color },
        });
      }
      collaboratorsRef.current = updated;
      api.updateScene({ collaborators: updated });
    });
  }, [rt, excalidrawUtils, userId]);

  // ── Persistence: IndexedDB (immediate) + server (debounced 5s) ──
  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSave = useRef<{ elements: unknown[]; appState: unknown; files: Record<string, BinaryFileData> } | null>(null);

  const flushToServer = useCallback(async () => {
    const data = pendingSave.current;
    if (!data) return;
    pendingSave.current = null;
    try {
      await fetch(`/api/whiteboards/${whiteboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      // Server has latest — clear local cache
      clearLocal(whiteboardId).catch(() => {});
    } catch {
      pendingSave.current = data;
    }
  }, [whiteboardId]);

  // Flush on unmount / tab close using sendBeacon (works during unload)
  useEffect(() => {
    const onBeforeUnload = () => {
      const data = pendingSave.current;
      if (!data) return;
      pendingSave.current = null;
      // keepalive: true ensures fetch completes even during page unload
      fetch(`/api/whiteboards/${whiteboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearTimeout(serverSaveTimer.current);
      flushToServer();
    };
  }, [flushToServer, whiteboardId]);

  const saveScene = useCallback(
    (elements: unknown[], appState: unknown, files: Record<string, BinaryFileData>) => {
      // 1. IndexedDB — immediate, survives crashes
      saveToLocal(whiteboardId, { elements, appState, files }).catch(() => {});

      // 2. Server — debounced 5s
      pendingSave.current = { elements, appState, files };
      clearTimeout(serverSaveTimer.current);
      serverSaveTimer.current = setTimeout(flushToServer, 5000);
    },
    [whiteboardId, flushToServer]
  );

  // ── Excalidraw onChange ──
  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any, files: Record<string, BinaryFileData>) => {
      // Emit elements over socket (throttled inside hook)
      rt.emitDrawingUpdate(elements as unknown[]);

      // Only emit files when new ones are added
      const fileKeys = Object.keys(files || {}).sort().join(",");
      if (fileKeys !== lastFileKeysRef.current) {
        lastFileKeysRef.current = fileKeys;
        rt.emitFiles(files || {});
      }

      // Save to DB
      saveScene(elements as unknown[], appState, files);
    },
    [rt, saveScene]
  );

  const handlePointerUpdate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (payload: any) => {
      rt.emitCursorMove({
        x: payload.pointer.x,
        y: payload.pointer.y,
        tool: payload.pointer.tool,
        button: payload.button,
      });
    },
    [rt]
  );

  const handleTitleSave = async () => {
    setIsEditingTitle(false);
    await fetch(`/api/whiteboards/${whiteboardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  };

  const startEditingTitle = () => {
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  };

  // ── Loading state ──
  if (!ExcalidrawComp || !dataReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: "#fafaf8" }}>
        <div className="flex flex-col items-center gap-5">
          {/* Animated logo */}
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-[#6965db] flex items-center justify-center shadow-lg shadow-[#6965db]/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-[draw_2s_ease-in-out_infinite]">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-[#6965db]/30 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#1b1b1f]">Preparing your canvas</p>
            <p className="mt-1 text-xs text-[#8b8b8e]">Loading drawing tools…</p>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-48 overflow-hidden rounded-full bg-[#e8e8e4]">
            <div className="h-full w-1/2 rounded-full bg-[#6965db] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        </div>

        <style>{`
          @keyframes draw {
            0%, 100% { opacity: 1; transform: rotate(0deg); }
            50% { opacity: 0.6; transform: rotate(3deg); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>
      </div>
    );
  }

  const allUsers = [
    { userId, name: userName, color: "#6965db", image: userImage, isSelf: true },
    ...roomUsers
      .filter((u) => u.userId !== userId)
      .map((u) => ({ ...u, image: null, isSelf: false })),
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* ── Full-bleed canvas ── */}
      <div className="absolute inset-0">
        <ExcalidrawComp
          excalidrawAPI={(api: any) => { excalidrawRef.current = api; }}
          isCollaborating={true}
          initialData={{
            elements: (resolvedData?.elements as any) || [],
            appState: {
              ...(resolvedData?.appState || {}),
              collaborators: new Map(),
            },
            files: resolvedData?.files ? Object.values(resolvedData.files) : [],
          }}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          generateIdForFile={(file: File) =>
            `${whiteboardId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
          }
          UIOptions={{ canvasActions: { loadScene: false } }}
        />
      </div>

      {/* ── Floating overlay ── */}
      <div className="absolute inset-0 pointer-events-none z-[10]">
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          {/* ── Breadcrumb / Title pill ── */}
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg px-1 py-1 shadow-sm">
            <Link
              href="/whiteboards"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Home
            </Link>

            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
              <polyline points="9 18 15 12 9 6" />
            </svg>

            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") {
                    setTitle(initialTitle);
                    setIsEditingTitle(false);
                  }
                }}
                className="h-7 w-44 rounded-lg border border-[var(--primary)]/30 bg-transparent px-2 text-xs font-semibold text-[var(--foreground)] outline-none ring-2 ring-[var(--primary)]/20"
                autoFocus
              />
            ) : (
              <button
                onClick={startEditingTitle}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] truncate max-w-[180px]"
              >
                {title}
              </button>
            )}
          </div>

          {/* ── Right: avatars + share ── */}
          <div className="pointer-events-auto flex items-center gap-2.5">
            <TooltipProvider>
              <div className="flex items-center -space-x-2">
                {allUsers.map((u, i) => (
                  <Tooltip key={u.userId}>
                    <TooltipTrigger asChild>
                      <div
                        className="relative rounded-full ring-[2.5px] ring-white transition-transform hover:scale-110 hover:z-10"
                        style={{ zIndex: allUsers.length - i }}
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: u.color }}
                        >
                          {u.image ? (
                            <img src={u.image} alt={u.name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            u.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="rounded-lg bg-[var(--foreground)] px-2.5 py-1 text-[11px] text-[var(--background)]">
                      {u.isSelf ? `${u.name} (you)` : u.name}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>

            {allUsers.length > 1 && (
              <span className="text-[11px] font-semibold tabular-nums text-[var(--muted-foreground)]">
                {allUsers.length}
              </span>
            )}

            <div className="h-5 w-px bg-[var(--border)]" />

            {isOwner && (
              <ShareDialog
                whiteboardId={whiteboardId}
                isPublic={isPublic}
                onTogglePublic={setIsPublic}
              />
            )}

            <Link
              href="/whiteboards"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg text-[var(--muted-foreground)] shadow-sm transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
