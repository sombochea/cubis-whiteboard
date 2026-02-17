"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ShareDialog from "./share-dialog";
import { toast } from "sonner";
import Link from "next/link";
import "@excalidraw/excalidraw/index.css";

interface WhiteboardEditorProps {
  whiteboardId: string;
  initialData?: { elements?: unknown[]; appState?: Record<string, unknown> };
  initialTitle?: string;
  userId: string;
  userName: string;
  userImage?: string | null;
  isOwner?: boolean;
}

export default function WhiteboardEditor({
  whiteboardId,
  initialData,
  initialTitle = "Untitled",
  userId,
  userName,
  userImage,
  isOwner = false,
}: WhiteboardEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Excalidraw, setExcalidraw] = useState<any>(null);
  const [title, setTitle] = useState(initialTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [roomUsers, setRoomUsers] = useState<
    { userId: string; name: string; color: string }[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawRef = useRef<any>(null);
  const isRemoteUpdate = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    import("@excalidraw/excalidraw").then((mod) => {
      setExcalidraw(() => mod.Excalidraw);
    });
  }, []);

  const saveToServer = useCallback(
    (elements: unknown[], appState: unknown) => {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          await fetch(`/api/whiteboards/${whiteboardId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: { elements, appState } }),
          });
        } catch {
          toast.error("Failed to save");
        }
      }, 1000);
    },
    [whiteboardId]
  );

  const { emitDrawingUpdate, emitCursorMove } = useRealtime({
    roomId: whiteboardId,
    userId,
    userName,
    onDrawingUpdate: ({ elements }) => {
      if (excalidrawRef.current) {
        isRemoteUpdate.current = true;
        excalidrawRef.current.updateScene({ elements });
        isRemoteUpdate.current = false;
      }
    },
    onRoomUsers: setRoomUsers,
  });

  const handleChange = useCallback(
    (elements: unknown[], appState: unknown) => {
      if (isRemoteUpdate.current) return;
      emitDrawingUpdate(elements, appState);
      saveToServer(elements, appState);
    },
    [emitDrawingUpdate, saveToServer]
  );

  const handlePointerUpdate = useCallback(
    ({ pointer }: { pointer: { x: number; y: number } }) => {
      emitCursorMove(pointer);
    },
    [emitCursorMove]
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

  if (!Excalidraw) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="animate-pulse text-neutral-400 text-sm">Loading editor...</div>
      </div>
    );
  }

  // Combine current user + room users for avatar display
  const allUsers = [
    { userId, name: userName, color: "#6366f1", image: userImage, isSelf: true },
    ...roomUsers
      .filter((u) => u.userId !== userId)
      .map((u) => ({ ...u, image: null, isSelf: false })),
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* ── Full-bleed Excalidraw canvas ── */}
      <div className="absolute inset-0">
        <Excalidraw
          ref={excalidrawRef}
          initialData={{
            elements: (initialData?.elements as any) || [],
            appState: {
              ...(initialData?.appState || {}),
              collaborators: new Map(),
            },
          }}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          UIOptions={{
            canvasActions: { loadScene: false },
          }}
        />
      </div>

      {/* ── Floating overlay layer (pointer-events pass through) ── */}
      <div className="absolute inset-0 pointer-events-none z-[10]">
        {/* ── Top bar: breadcrumb left, avatars right ── */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          {/* ── Breadcrumb / Title pill ── */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg bg-white/90 backdrop-blur-md border border-neutral-200/60 shadow-sm px-1 py-1">
            <Link
              href="/whiteboards"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Home
            </Link>

            <div className="w-px h-4 bg-neutral-200" />

            {isEditingTitle ? (
              <Input
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
                className="h-7 w-48 border-0 bg-transparent px-2.5 text-xs font-semibold text-neutral-900 shadow-none focus-visible:ring-1 focus-visible:ring-neutral-300"
                autoFocus
              />
            ) : (
              <button
                onClick={startEditingTitle}
                className="px-2.5 py-1 rounded-md text-xs font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors truncate max-w-[200px]"
              >
                {title}
              </button>
            )}
          </div>

          {/* ── Avatars + Share (top-right) ── */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Avatar stack */}
            <TooltipProvider>
              <div className="flex items-center -space-x-2">
                {allUsers.map((u, i) => (
                  <Tooltip key={u.userId}>
                    <TooltipTrigger asChild>
                      <div
                        className="relative rounded-full ring-2 ring-white transition-transform hover:scale-110 hover:z-10"
                        style={{ zIndex: allUsers.length - i }}
                      >
                        <Avatar className="h-8 w-8">
                          {u.image && <AvatarImage src={u.image} alt={u.name} />}
                          <AvatarFallback
                            className="text-[11px] font-semibold text-white"
                            style={{ backgroundColor: u.color }}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online indicator */}
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                          style={{ backgroundColor: "#22c55e" }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {u.isSelf ? `${u.name} (you)` : u.name}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>

            {/* Online count badge (when > 1) */}
            {allUsers.length > 1 && (
              <span className="text-[11px] font-medium text-neutral-500 tabular-nums">
                {allUsers.length}
              </span>
            )}

            {/* Separator */}
            <div className="w-px h-6 bg-neutral-200" />

            {/* Share button */}
            {isOwner && (
              <ShareDialog
                whiteboardId={whiteboardId}
                isPublic={isPublic}
                onTogglePublic={setIsPublic}
              />
            )}

            {/* User menu */}
            <Link
              href="/whiteboards"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 backdrop-blur-md border border-neutral-200/60 shadow-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
