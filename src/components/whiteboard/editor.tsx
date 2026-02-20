'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtime } from '@/hooks/use-realtime';
import { useOnlineStatus } from '@/hooks/use-online-status';
import ShareDialog from './share-dialog';
import { toast } from 'sonner';
import {
    saveToLocal,
    loadFromLocal,
    clearLocal,
    enqueueSave,
    drainSyncQueue,
    pendingQueueCount,
    saveLibraryLocal,
    loadLibraryLocal,
} from '@/lib/local-store';
import '@excalidraw/excalidraw/index.css';

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
    userEmail?: string;
    userImage?: string | null;
    isOwner?: boolean;
    isPublicInitial?: boolean;
    serverUpdatedAt?: number;
}

export default function WhiteboardEditor({
    whiteboardId,
    initialData,
    initialTitle = 'Untitled',
    userId,
    userName,
    userEmail,
    userImage,
    isOwner = false,
    isPublicInitial = false,
    serverUpdatedAt = 0,
}: WhiteboardEditorProps) {
    const router = useRouter();
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
    const [syncStatus, setSyncStatus] = useState<
        'synced' | 'saving' | 'offline' | 'syncing'
    >('synced');
    const [libraryItems, setLibraryItems] = useState<unknown[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const excalidrawRef = useRef<any>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const lastFileKeysRef = useRef<string>('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collaboratorsRef = useRef<Map<string, any>>(new Map());

    const isOnline = useOnlineStatus();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [WelcomeScreenComp, setWelcomeScreenComp] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [MainMenuComp, setMainMenuComp] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [LiveCollabTrigger, setLiveCollabTrigger] = useState<any>(null);
    const [shareOpen, setShareOpen] = useState(false);

    // Load Excalidraw
    useEffect(() => {
        import('@excalidraw/excalidraw').then((mod) => {
            setExcalidrawComp(() => mod.Excalidraw);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setWelcomeScreenComp(() => (mod as any).WelcomeScreen);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setMainMenuComp(() => (mod as any).MainMenu);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setLiveCollabTrigger(() => (mod as any).LiveCollaborationTrigger);
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
        loadFromLocal(whiteboardId)
            .then((local) => {
                if (local && local.savedAt > serverUpdatedAt) {
                    setResolvedData({
                        elements: local.elements,
                        appState: local.appState,
                        files: local.files,
                    });
                    if (navigator.onLine) {
                        fetch(`/api/whiteboards/${whiteboardId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                data: {
                                    elements: local.elements,
                                    appState: local.appState,
                                    files: local.files,
                                },
                            }),
                        })
                            .then(() => clearLocal(whiteboardId))
                            .catch(() => {});
                    }
                } else {
                    clearLocal(whiteboardId).catch(() => {});
                }
                setDataReady(true);
            })
            .catch(() => setDataReady(true));
    }, [whiteboardId, serverUpdatedAt]);

    // ── Load personal library: local-first, then merge server ──
    useEffect(() => {
        loadLibraryLocal()
            .then((local) => {
                if (local?.items?.length) setLibraryItems(local.items);
            })
            .catch(() => {});
        if (navigator.onLine) {
            fetch('/api/library')
                .then((r) => (r.ok ? r.json() : []))
                .then((serverItems: unknown[]) => {
                    if (serverItems.length) setLibraryItems(serverItems);
                })
                .catch(() => {});
        }
    }, []);

    // ── Drain sync queue when coming back online ──
    useEffect(() => {
        if (!isOnline) {
            setSyncStatus('offline');
            return;
        }
        let cancelled = false;
        setSyncStatus('syncing');
        drainSyncQueue()
            .then((count) => {
                if (cancelled) return;
                if (count > 0)
                    toast.success(
                        `Synced ${count} offline change${count > 1 ? 's' : ''}`,
                    );
                setSyncStatus('synced');
            })
            .catch(() => {
                if (!cancelled) setSyncStatus('synced');
            });
        return () => {
            cancelled = true;
        };
    }, [isOnline]);

    // ── Realtime ──
    const rt = useRealtime({ roomId: whiteboardId, userId, userName });

    useEffect(() => {
        rt.onDrawingUpdate(({ elements: remoteElements }) => {
            const api = excalidrawRef.current;
            if (!api) return;
            const appState = api.getAppState();
            if (
                appState.newElement ||
                appState.resizingElement ||
                appState.draggingElement ||
                appState.editingTextElement
            )
                return;
            const localElements = api.getSceneElements();
            if (excalidrawUtils?.reconcileElements) {
                const merged = excalidrawUtils.reconcileElements(
                    localElements,
                    remoteElements,
                    appState,
                );
                api.updateScene({
                    elements: merged,
                    captureUpdate: excalidrawUtils.CaptureUpdateAction?.NEVER,
                });
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

        rt.onCursorMove((data: unknown) => {
            const api = excalidrawRef.current;
            if (!api) return;
            const d = data as {
                userId: string;
                name: string;
                color: string;
                x: number;
                y: number;
                button?: string;
                tool?: string;
            };
            const key = `${d.userId}:${d.color}`;
            const updated = new Map(collaboratorsRef.current);
            updated.set(key, {
                username: d.name,
                pointer: {
                    x: d.x,
                    y: d.y,
                    tool: (d.tool || 'pointer') as 'pointer' | 'laser',
                },
                button: d.button || 'up',
                color: { background: d.color, stroke: d.color },
            });
            collaboratorsRef.current = updated;
            api.updateScene({ collaborators: updated });
        });

        rt.onRoomUsers((users) => {
            setRoomUsers(users);
            const api = excalidrawRef.current;
            if (!api) return;
            const updated = new Map<
                string,
                {
                    username?: string;
                    color?: { background: string; stroke: string };
                }
            >();
            for (const u of users) {
                // Use a composite key so same-user multi-tab entries don't collide
                const key = `${u.userId}:${u.color}`;
                const existing = collaboratorsRef.current.get(key);
                updated.set(
                    key,
                    existing || {
                        username: u.name,
                        color: { background: u.color, stroke: u.color },
                    },
                );
            }
            // Remove self (current tab) — identified by matching userId AND being the only one with no cursor yet
            // Keep all entries; Excalidraw ignores collaborators with no pointer
            collaboratorsRef.current = updated;
            api.updateScene({ collaborators: updated });
        });
    }, [rt, excalidrawUtils, userId]);

    // ── Realtime access control ──
    const accessHandledRef = useRef(false);
    useEffect(() => {
        rt.onAccessRevoked(({ userId: targetId }) => {
            if (targetId !== userId) return;
            toast.error('Your access has been revoked');
            window.location.href = '/w';
        });

        rt.onAccessChanged(({ userId: targetId, role }) => {
            if (targetId !== userId || accessHandledRef.current) return;
            accessHandledRef.current = true;
            if (role === 'viewer') {
                toast('Your access has been changed to view-only');
                window.location.href = `/s/${whiteboardId}`;
            } else if (role === 'editor') {
                toast.success('You now have editor access');
                router.refresh();
            }
        });
    }, [rt, userId, whiteboardId, router]);

    // ── Persistence ──
    const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const pendingSave = useRef<{
        elements: unknown[];
        appState: unknown;
        files: Record<string, BinaryFileData>;
    } | null>(null);

    const flushToServer = useCallback(async () => {
        const data = pendingSave.current;
        if (!data) return;

        if (!navigator.onLine) {
            await enqueueSave(whiteboardId, data).catch(() => {});
            pendingSave.current = null;
            setSyncStatus('offline');
            return;
        }

        pendingSave.current = null;
        setSyncStatus('saving');

        // Generate thumbnail
        let thumbnail: string | undefined;
        try {
            const { exportToBlob } = await import('@excalidraw/excalidraw');
            const elems = (data.elements as any[]).filter(
                (e: any) => !e.isDeleted,
            );
            if (elems.length > 0) {
                const blob = await exportToBlob({
                    elements: elems,
                    appState: {
                        exportBackground: true,
                        viewBackgroundColor: '#ffffff',
                    },
                    files: data.files as any,
                    maxWidthOrHeight: 320,
                });
                thumbnail = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }
        } catch {
            /* thumbnail is optional */
        }

        try {
            await fetch(`/api/whiteboards/${whiteboardId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data, ...(thumbnail && { thumbnail }) }),
            });
            clearLocal(whiteboardId).catch(() => {});
            setSyncStatus('synced');
        } catch {
            await enqueueSave(whiteboardId, data).catch(() => {});
            setSyncStatus('offline');
        }
    }, [whiteboardId]);

    useEffect(() => {
        const onBeforeUnload = () => {
            const data = pendingSave.current;
            if (!data) return;
            pendingSave.current = null;
            if (navigator.onLine) {
                fetch(`/api/whiteboards/${whiteboardId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data }),
                    keepalive: true,
                }).catch(() => {});
            } else {
                // Can't await in beforeunload — saveToLocal is fire-and-forget here
                // The data is already in IndexedDB from the immediate save below
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            clearTimeout(serverSaveTimer.current);
            flushToServer();
        };
    }, [flushToServer, whiteboardId]);

    const saveScene = useCallback(
        (
            elements: unknown[],
            appState: unknown,
            files: Record<string, BinaryFileData>,
        ) => {
            // 1. IndexedDB — immediate, survives crashes & offline
            saveToLocal(whiteboardId, { elements, appState, files }).catch(
                () => {},
            );

            // 2. Server — debounced 3s (reduced from 5s for snappier sync)
            pendingSave.current = { elements, appState, files };
            clearTimeout(serverSaveTimer.current);
            serverSaveTimer.current = setTimeout(flushToServer, 3000);
        },
        [whiteboardId, flushToServer],
    );

    // ── Performance: throttled onChange (fires at most every 100ms during drawing) ──
    const changeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const latestChange = useRef<{
        elements: readonly unknown[];
        appState: unknown;
        files: Record<string, BinaryFileData>;
    } | null>(null);

    const roomUsersRef = useRef(roomUsers);
    useEffect(() => {
        roomUsersRef.current = roomUsers;
    }, [roomUsers]);

    const hasCollaborators = useCallback(
        () => roomUsersRef.current.length > 1,
        [],
    );

    const processChange = useCallback(() => {
        const c = latestChange.current;
        if (!c) return;
        latestChange.current = null;

        // Only emit realtime updates when others are in the room
        if (hasCollaborators()) {
            rt.emitDrawingUpdate(c.elements as unknown[]);

            const fileKeys = Object.keys(c.files || {})
                .sort()
                .join(',');
            if (fileKeys !== lastFileKeysRef.current) {
                lastFileKeysRef.current = fileKeys;
                rt.emitFiles(c.files || {});
            }
        }

        saveScene(c.elements as unknown[], c.appState, c.files);
    }, [rt, saveScene, hasCollaborators]);

    const handleChange = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (
            elements: readonly any[],
            appState: any,
            files: Record<string, BinaryFileData>,
        ) => {
            latestChange.current = { elements, appState, files };
            if (!changeTimer.current) {
                changeTimer.current = setTimeout(() => {
                    changeTimer.current = undefined;
                    processChange();
                }, 100);
            }
        },
        [processChange],
    );

    // Cleanup throttle timer
    useEffect(
        () => () => {
            clearTimeout(changeTimer.current);
            processChange();
        },
        [processChange],
    );

    const handlePointerUpdate = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
            if (!hasCollaborators()) return;
            rt.emitCursorMove({
                x: payload.pointer.x,
                y: payload.pointer.y,
                tool: payload.pointer.tool,
                button: payload.button,
            });
        },
        [rt, hasCollaborators],
    );

    // ── Library change: save locally immediately, debounce server sync ──
    const libSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const handleLibraryChange = useCallback((items: unknown[]) => {
        setLibraryItems(items);
        saveLibraryLocal(items).catch(() => {});
        clearTimeout(libSaveTimer.current);
        libSaveTimer.current = setTimeout(() => {
            if (navigator.onLine) {
                fetch('/api/library', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items }),
                }).catch(() => {});
            }
        }, 2000);
    }, []);
    useEffect(() => () => clearTimeout(libSaveTimer.current), []);

    // ── Import from .excalidraw file ──
    const importFileRef = useRef<HTMLInputElement>(null);

    const handleImportFile = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = '';
            try {
                const { loadFromBlob } = await import('@excalidraw/excalidraw');
                const api = excalidrawRef.current;
                const appState = api?.getAppState() ?? {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const scene = await loadFromBlob(
                    file,
                    appState as any,
                    api?.getSceneElements() ?? [],
                );
                api?.updateScene({
                    elements: scene.elements,
                    appState: scene.appState,
                });
                if (scene.files)
                    api?.addFiles(Object.values(scene.files) as any);
                toast.success('Imported successfully');
            } catch {
                toast.error('Failed to import file');
            }
        },
        [],
    );

    // Keep Excalidraw's internal name in sync with title (affects export filename)
    useEffect(() => {
        excalidrawRef.current?.updateScene({ appState: { name: title } });
    }, [title]);

    const handleTitleSave = async () => {
        setIsEditingTitle(false);
        if (!navigator.onLine) {
            toast.info('Title will sync when back online');
            return;
        }
        await fetch(`/api/whiteboards/${whiteboardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
    };

    const startEditingTitle = () => {
        setIsEditingTitle(true);
        setTimeout(() => titleInputRef.current?.select(), 0);
    };

    // ── Memoize initial data to prevent Excalidraw re-init ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const excalidrawInitialData = useMemo(
        () => ({
            elements: (resolvedData?.elements as any) || [],
            appState: {
                ...(resolvedData?.appState || {}),
                name: title,
                collaborators: new Map(),
            },
            files: resolvedData?.files ? Object.values(resolvedData.files) : [],
            libraryItems,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [resolvedData, libraryItems],
    );

    // ── Loading state ──
    if (!ExcalidrawComp || !dataReady) {
        return (
            <div
                className="flex h-screen w-screen items-center justify-center"
                style={{ background: '#fafaf8' }}
            >
                <div className="flex flex-col items-center gap-5">
                    <div className="relative">
                        <div className="h-14 w-14 rounded-2xl bg-[#6965db] flex items-center justify-center shadow-lg shadow-[#6965db]/20">
                            <svg
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="animate-[draw_2s_ease-in-out_infinite]"
                            >
                                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                <path d="M2 2l7.586 7.586" />
                                <circle cx="11" cy="11" r="2" />
                            </svg>
                        </div>
                        <div className="absolute inset-0 rounded-2xl border-2 border-[#6965db]/30 animate-ping" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-[#1b1b1f]">
                            Preparing your canvas
                        </p>
                        <p className="mt-1 text-xs text-[#8b8b8e]">
                            Loading drawing tools…
                        </p>
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

    const importIcon = (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    );

    return (
        <div className="relative h-screen w-screen overflow-hidden">
            <input
                ref={importFileRef}
                type="file"
                accept=".excalidraw"
                className="hidden"
                onChange={handleImportFile}
            />

            {isOwner && (
                <ShareDialog
                    whiteboardId={whiteboardId}
                    isPublic={isPublic}
                    onTogglePublic={setIsPublic}
                    ownerEmail={userEmail}
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                />
            )}

            <div className="absolute inset-0">
                <ExcalidrawComp
                    excalidrawAPI={(api: any) => {
                        excalidrawRef.current = api;
                    }}
                    isCollaborating={isOnline}
                    initialData={excalidrawInitialData}
                    onChange={handleChange}
                    onPointerUpdate={handlePointerUpdate}
                    onLibraryChange={handleLibraryChange}
                    generateIdForFile={(file: File) =>
                        `${whiteboardId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
                    }
                    UIOptions={{ canvasActions: { loadScene: false } }}
                    renderTopRightUI={() =>
                        LiveCollabTrigger ? (
                            <LiveCollabTrigger
                                isCollaborating={roomUsers.length > 1}
                                onSelect={() => isOwner && setShareOpen(true)}
                            />
                        ) : null
                    }
                >
                    {/* ── MainMenu ── */}
                    {MainMenuComp && (
                        <MainMenuComp>
                            {/* Board */}
                            <MainMenuComp.Group title="Board">
                                <MainMenuComp.ItemCustom>
                                    <div className="px-1 py-1">
                                        {isEditingTitle ? (
                                            <input
                                                ref={titleInputRef}
                                                value={title}
                                                onChange={(e) =>
                                                    setTitle(e.target.value)
                                                }
                                                onBlur={handleTitleSave}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter')
                                                        handleTitleSave();
                                                    if (e.key === 'Escape') {
                                                        setTitle(initialTitle);
                                                        setIsEditingTitle(
                                                            false,
                                                        );
                                                    }
                                                }}
                                                className="w-full rounded-md border border-[#6965db]/40 bg-transparent px-2 py-1 text-[13px] font-medium outline-none ring-2 ring-[#6965db]/20 focus:ring-[#6965db]/40 dark:text-white"
                                                autoFocus
                                            />
                                        ) : (
                                            <button
                                                onClick={startEditingTitle}
                                                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[13px] font-medium transition-colors hover:bg-[var(--island-bg-color,#f0f0f0)]"
                                            >
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="shrink-0 opacity-40"
                                                >
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                <span className="truncate">
                                                    {title}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </MainMenuComp.ItemCustom>
                                <MainMenuComp.ItemLink
                                    onSelect={() => router.push('/w')}
                                    icon={
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                            <polyline points="9 22 9 12 15 12 15 22" />
                                        </svg>
                                    }
                                >
                                    All boards
                                </MainMenuComp.ItemLink>
                            </MainMenuComp.Group>
                            <MainMenuComp.Separator />

                            {/* File */}
                            <MainMenuComp.Group title="File">
                                <MainMenuComp.Item
                                    onSelect={() =>
                                        importFileRef.current?.click()
                                    }
                                    icon={importIcon}
                                >
                                    Import
                                </MainMenuComp.Item>
                                <MainMenuComp.DefaultItems.SaveAsImage />
                                <MainMenuComp.DefaultItems.Export />
                                <MainMenuComp.DefaultItems.Help />
                            </MainMenuComp.Group>
                            <MainMenuComp.Separator />

                            {/* Appearance */}
                            <MainMenuComp.Group title="Appearance">
                                <MainMenuComp.DefaultItems.ToggleTheme />
                                <MainMenuComp.DefaultItems.ChangeCanvasBackground />
                            </MainMenuComp.Group>
                        </MainMenuComp>
                    )}

                    {/* ── WelcomeScreen ── */}
                    {WelcomeScreenComp && (
                        <WelcomeScreenComp>
                            <WelcomeScreenComp.Center>
                                <WelcomeScreenComp.Center.Logo />
                                <WelcomeScreenComp.Center.Heading>
                                    {title}
                                </WelcomeScreenComp.Center.Heading>
                                <WelcomeScreenComp.Center.Menu>
                                    <WelcomeScreenComp.Center.MenuItem
                                        onSelect={() =>
                                            importFileRef.current?.click()
                                        }
                                        icon={importIcon}
                                    >
                                        Import file
                                    </WelcomeScreenComp.Center.MenuItem>
                                    <WelcomeScreenComp.Center.MenuItemHelp />
                                </WelcomeScreenComp.Center.Menu>
                            </WelcomeScreenComp.Center>
                            <WelcomeScreenComp.Hints.ToolbarHint />
                            <WelcomeScreenComp.Hints.MenuHint />
                            <WelcomeScreenComp.Hints.HelpHint />
                        </WelcomeScreenComp>
                    )}
                </ExcalidrawComp>
            </div>
        </div>
    );
}

// ── Sync dot (unused but kept for potential future use) ──
function SyncDot({ status, isOnline }: { status: string; isOnline: boolean }) {
    const display = !isOnline ? 'offline' : status;
    const colors: Record<string, string> = {
        synced: 'bg-emerald-500',
        saving: 'bg-amber-400 animate-pulse',
        syncing: 'bg-blue-500 animate-pulse',
        offline: 'bg-gray-400',
    };
    const titles: Record<string, string> = {
        synced: 'Saved',
        saving: 'Saving…',
        syncing: 'Syncing…',
        offline: 'Offline',
    };
    return (
        <span
            title={titles[display] || 'Saved'}
            className={`h-2 w-2 rounded-full shrink-0 ${colors[display] || colors.synced}`}
        />
    );
}
