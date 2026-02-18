"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ShareDialog from "./share-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { saveToLocal, loadFromLocal, clearLocal, enqueueSave, drainSyncQueue, pendingQueueCount, saveLibraryLocal, loadLibraryLocal } from "@/lib/local-store";
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
  isPublicInitial?: boolean;
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
  isPublicInitial = false,
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
  const [isPublic, setIsPublic] = useState(isPublicInitial);
  const [roomUsers, setRoomUsers] = useState<
    { userId: string; name: string; color: string }[]
  >([]);
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "offline" | "syncing">("synced");
  const [libraryItems, setLibraryItems] = useState<unknown[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawRef = useRef<any>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const lastFileKeysRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collaboratorsRef = useRef<Map<string, any>>(new Map());

  const isOnline = useOnlineStatus();

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
        setResolvedData({ elements: local.elements, appState: local.appState, files: local.files });
        if (navigator.onLine) {
          fetch(`/api/whiteboards/${whiteboardId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: { elements: local.elements, appState: local.appState, files: local.files } }),
          }).then(() => clearLocal(whiteboardId)).catch(() => {});
        }
      } else {
        clearLocal(whiteboardId).catch(() => {});
      }
      setDataReady(true);
    }).catch(() => setDataReady(true));
  }, [whiteboardId, serverUpdatedAt]);

  // ── Load personal library: local-first, then merge server ──
  useEffect(() => {
    loadLibraryLocal().then((local) => {
      if (local?.items?.length) setLibraryItems(local.items);
    }).catch(() => {});
    if (navigator.onLine) {
      fetch("/api/library").then((r) => r.ok ? r.json() : []).then((serverItems: unknown[]) => {
        if (serverItems.length) setLibraryItems(serverItems);
      }).catch(() => {});
    }
  }, []);

  // ── Drain sync queue when coming back online ──
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus("offline");
      return;
    }
    let cancelled = false;
    setSyncStatus("syncing");
    drainSyncQueue().then((count) => {
      if (cancelled) return;
      if (count > 0) toast.success(`Synced ${count} offline change${count > 1 ? "s" : ""}`);
      setSyncStatus("synced");
    }).catch(() => {
      if (!cancelled) setSyncStatus("synced");
    });
    return () => { cancelled = true; };
  }, [isOnline]);

  // ── Realtime ──
  const rt = useRealtime({ roomId: whiteboardId, userId, userName });

  useEffect(() => {
    rt.onDrawingUpdate(({ elements: remoteElements }) => {
      const api = excalidrawRef.current;
      if (!api) return;
      const appState = api.getAppState();
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
        return { id: file.id, mimeType: file.mimeType, dataURL: file.dataURL, created: file.created || Date.now() };
      });
      if (fileArray.length > 0) api.addFiles(fileArray);
    });

    rt.onCursorMove((data: unknown) => {
      const api = excalidrawRef.current;
      if (!api) return;
      const d = data as { userId: string; name: string; color: string; x: number; y: number; button?: string; tool?: string };
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
        updated.set(u.userId, existing || { username: u.name, color: { background: u.color, stroke: u.color } });
      }
      collaboratorsRef.current = updated;
      api.updateScene({ collaborators: updated });
    });
  }, [rt, excalidrawUtils, userId]);

  // ── Realtime access control ──
  useEffect(() => {
    rt.onAccessRevoked(({ userId: targetId }) => {
      if (targetId === userId) {
        toast.error("Your access has been revoked");
        window.location.href = "/whiteboards";
      }
    });

    rt.onAccessChanged(({ userId: targetId, role }) => {
      if (targetId === userId) {
        if (role === "viewer") {
          toast("Your access has been changed to view-only");
          window.location.href = `/share/${whiteboardId}`;
        } else if (role === "editor") {
          toast.success("You now have editor access");
          window.location.reload();
        }
      }
    });
  }, [rt, userId, whiteboardId]);

  // ── Persistence ──
  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSave = useRef<{ elements: unknown[]; appState: unknown; files: Record<string, BinaryFileData> } | null>(null);

  const flushToServer = useCallback(async () => {
    const data = pendingSave.current;
    if (!data) return;

    if (!navigator.onLine) {
      await enqueueSave(whiteboardId, data).catch(() => {});
      pendingSave.current = null;
      setSyncStatus("offline");
      return;
    }

    pendingSave.current = null;
    setSyncStatus("saving");

    // Generate thumbnail
    let thumbnail: string | undefined;
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const elems = (data.elements as any[]).filter((e: any) => !e.isDeleted);
      if (elems.length > 0) {
        const blob = await exportToBlob({
          elements: elems,
          appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
          files: data.files as any,
          maxWidthOrHeight: 320,
        });
        thumbnail = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch { /* thumbnail is optional */ }

    try {
      await fetch(`/api/whiteboards/${whiteboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, ...(thumbnail && { thumbnail }) }),
      });
      clearLocal(whiteboardId).catch(() => {});
      setSyncStatus("synced");
    } catch {
      await enqueueSave(whiteboardId, data).catch(() => {});
      setSyncStatus("offline");
    }
  }, [whiteboardId]);

  useEffect(() => {
    const onBeforeUnload = () => {
      const data = pendingSave.current;
      if (!data) return;
      pendingSave.current = null;
      if (navigator.onLine) {
        fetch(`/api/whiteboards/${whiteboardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
          keepalive: true,
        }).catch(() => {});
      } else {
        // Can't await in beforeunload — saveToLocal is fire-and-forget here
        // The data is already in IndexedDB from the immediate save below
      }
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
      // 1. IndexedDB — immediate, survives crashes & offline
      saveToLocal(whiteboardId, { elements, appState, files }).catch(() => {});

      // 2. Server — debounced 3s (reduced from 5s for snappier sync)
      pendingSave.current = { elements, appState, files };
      clearTimeout(serverSaveTimer.current);
      serverSaveTimer.current = setTimeout(flushToServer, 3000);
    },
    [whiteboardId, flushToServer]
  );

  // ── Performance: throttled onChange (fires at most every 100ms during drawing) ──
  const changeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestChange = useRef<{ elements: readonly unknown[]; appState: unknown; files: Record<string, BinaryFileData> } | null>(null);

  const processChange = useCallback(() => {
    const c = latestChange.current;
    if (!c) return;
    latestChange.current = null;

    // Emit elements over socket
    rt.emitDrawingUpdate(c.elements as unknown[]);

    // Only emit files when new ones are added
    const fileKeys = Object.keys(c.files || {}).sort().join(",");
    if (fileKeys !== lastFileKeysRef.current) {
      lastFileKeysRef.current = fileKeys;
      rt.emitFiles(c.files || {});
    }

    // Persist
    saveScene(c.elements as unknown[], c.appState, c.files);
  }, [rt, saveScene]);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any, files: Record<string, BinaryFileData>) => {
      latestChange.current = { elements, appState, files };
      if (!changeTimer.current) {
        changeTimer.current = setTimeout(() => {
          changeTimer.current = undefined;
          processChange();
        }, 100);
      }
    },
    [processChange]
  );

  // Cleanup throttle timer
  useEffect(() => () => { clearTimeout(changeTimer.current); processChange(); }, [processChange]);

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

  // ── Library change: save locally immediately, debounce server sync ──
  const libSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleLibraryChange = useCallback(
    (items: unknown[]) => {
      setLibraryItems(items);
      saveLibraryLocal(items).catch(() => {});
      clearTimeout(libSaveTimer.current);
      libSaveTimer.current = setTimeout(() => {
        if (navigator.onLine) {
          fetch("/api/library", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          }).catch(() => {});
        }
      }, 2000);
    },
    []
  );
  useEffect(() => () => clearTimeout(libSaveTimer.current), []);

  const handleTitleSave = async () => {
    setIsEditingTitle(false);
    if (!navigator.onLine) { toast.info("Title will sync when back online"); return; }
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

  // ── Memoize initial data to prevent Excalidraw re-init ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawInitialData = useMemo(() => ({
    elements: (resolvedData?.elements as any) || [],
    appState: {
      ...(resolvedData?.appState || {}),
      collaborators: new Map(),
    },
    files: resolvedData?.files ? Object.values(resolvedData.files) : [],
    libraryItems,
  }), [resolvedData, libraryItems]);

  // ── Loading state ──
  if (!ExcalidrawComp || !dataReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: "#fafaf8" }}>
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-[#6965db] flex items-center justify-center shadow-lg shadow-[#6965db]/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-[draw_2s_ease-in-out_infinite]">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-[#6965db]/30 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#1b1b1f]">Preparing your canvas</p>
            <p className="mt-1 text-xs text-[#8b8b8e]">Loading drawing tools…</p>
          </div>
          <div className="h-1 w-48 overflow-hidden rounded-full bg-[#e8e8e4]">
            <div className="h-full w-1/2 rounded-full bg-[#6965db] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
        <style>{`
          @keyframes draw { 0%, 100% { opacity: 1; transform: rotate(0deg); } 50% { opacity: 0.6; transform: rotate(3deg); } }
          @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
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
          isCollaborating={isOnline}
          initialData={excalidrawInitialData}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          onLibraryChange={handleLibraryChange}
          generateIdForFile={(file: File) =>
            `${whiteboardId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
          }
          UIOptions={{ canvasActions: { loadScene: false } }}
        />
      </div>

      {/* ── Floating overlay ── */}
      <div className="absolute inset-0 pointer-events-none z-[10]">
        <div className="absolute top-3 left-2 right-2 sm:left-3 sm:right-3 flex items-start justify-between gap-2">
          {/* ── Breadcrumb / Title pill ── */}
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg px-1 py-1 shadow-sm min-w-0 shrink">
            <Link
              href="/whiteboards"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="hidden sm:inline">Home</span>
            </Link>

            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 shrink-0 hidden sm:block">
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
                  if (e.key === "Escape") { setTitle(initialTitle); setIsEditingTitle(false); }
                }}
                className="h-7 w-32 sm:w-44 rounded-lg border border-[var(--primary)]/30 bg-transparent px-2 text-xs font-semibold text-[var(--foreground)] outline-none ring-2 ring-[var(--primary)]/20"
                autoFocus
              />
            ) : (
              <button
                onClick={startEditingTitle}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] truncate max-w-[100px] sm:max-w-[180px]"
              >
                {title}
              </button>
            )}

            {/* ── Sync status indicator ── */}
            <SyncIndicator status={syncStatus} isOnline={isOnline} />
          </div>

          {/* ── Right: avatars + share ── */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <TooltipProvider>
              <div className="flex items-center -space-x-2">
                {allUsers.slice(0, 3).map((u, i) => (
                  <Tooltip key={u.userId}>
                    <TooltipTrigger asChild>
                      <div
                        className="relative rounded-full ring-[2.5px] ring-white transition-transform hover:scale-110 hover:z-10"
                        style={{ zIndex: allUsers.length - i }}
                      >
                        <div
                          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[10px] sm:text-[11px] font-bold text-white"
                          style={{ backgroundColor: u.color }}
                        >
                          {u.image ? (
                            <img src={u.image} alt={u.name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            u.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border-2 border-white bg-emerald-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="rounded-lg bg-[var(--foreground)] px-2.5 py-1 text-[11px] text-[var(--background)]">
                      {u.isSelf ? `${u.name} (you)` : u.name}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {allUsers.length > 3 && (
                  <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[var(--muted)] text-[10px] font-bold text-[var(--muted-foreground)] ring-[2.5px] ring-white">
                    +{allUsers.length - 3}
                  </div>
                )}
              </div>
            </TooltipProvider>

            <div className="h-5 w-px bg-[var(--border)] hidden sm:block" />

            {isOwner && (
              <ShareDialog
                whiteboardId={whiteboardId}
                isPublic={isPublic}
                onTogglePublic={setIsPublic}
              />
            )}

            <Link
              href="/whiteboards"
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-lg text-[var(--muted-foreground)] shadow-sm transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// ── Sync status pill ──
function SyncIndicator({ status, isOnline }: { status: string; isOnline: boolean }) {
  const display = !isOnline ? "offline" : status;

  const config: Record<string, { color: string; bg: string; label: string }> = {
    synced:  { color: "text-emerald-600", bg: "bg-emerald-500", label: "Saved" },
    saving:  { color: "text-amber-600",   bg: "bg-amber-500",   label: "Saving…" },
    syncing: { color: "text-blue-600",    bg: "bg-blue-500",    label: "Syncing…" },
    offline: { color: "text-gray-500",    bg: "bg-gray-400",    label: "Offline" },
  };

  const c = config[display] || config.synced;

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium ${c.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.bg} ${display === "syncing" || display === "saving" ? "animate-pulse" : ""}`} />
      {c.label}
    </div>
  );
}
