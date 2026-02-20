"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

interface Collaborator {
  id: string;
  role: string;
  userId: string;
  userName: string;
  userEmail: string;
}

interface ShareDialogProps {
  whiteboardId: string;
  isPublic: boolean;
  onTogglePublic: (isPublic: boolean) => void;
  ownerEmail?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface AccessRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
}

export default function ShareDialog({ whiteboardId, isPublic, onTogglePublic, ownerEmail, open: openProp, onOpenChange }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [open, setOpen] = useState(false);

  const isControlled = openProp !== undefined;
  const dialogOpen = isControlled ? openProp : open;
  const setDialogOpen = isControlled ? (onOpenChange ?? setOpen) : setOpen;
  const socketRef = useRef<Socket | null>(null);

  // When controlled and opened externally, fetch data
  useEffect(() => {
    if (isControlled && openProp) { fetchCollaborators(); fetchRequests(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, openProp]);

  const isSelf = !!ownerEmail && email.trim().toLowerCase() === ownerEmail.toLowerCase();
  const isDuplicate = collaborators.some((c) => c.userEmail.toLowerCase() === email.trim().toLowerCase());
  const addDisabled = !email.trim() || isSelf || isDuplicate;

  // Socket for realtime access request notifications
  useEffect(() => {
    fetchRequests(); // Load on mount for badge
    const s = io({ path: "/api/socketio", transports: ["polling", "websocket"] });
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("watch-board", { boardId: whiteboardId });
    });

    s.on("access-request", () => {
      fetchRequests();
      toast.info("New access request received");
    });

    return () => { s.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteboardId]);

  const fetchCollaborators = async () => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/collaborate`);
    if (res.ok) setCollaborators(await res.json());
  };

  const fetchRequests = async () => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/access-requests`);
    if (res.ok) setRequests(await res.json());
  };

  const handleRequest = async (requestId: string, action: "approved" | "denied", targetUserId?: string) => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/access-requests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    if (res.ok) {
      toast.success(action === "approved" ? "Access granted" : "Request denied");
      // Notify requester in realtime
      socketRef.current?.emit("access-response", { boardId: whiteboardId, userId: targetUserId, action });
      fetchRequests();
      if (action === "approved") fetchCollaborators();
    }
  };

  const addCollaborator = async () => {
    if (addDisabled) return;
    const res = await fetch(`/api/whiteboards/${whiteboardId}/collaborate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (res.ok) {
      setEmail("");
      fetchCollaborators();
      toast.success("Collaborator added");
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to add");
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/collaborate`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId }),
    });
    if (res.ok) {
      const { userId } = await res.json();
      socketRef.current?.emit("access-revoked", { boardId: whiteboardId, userId });
      fetchCollaborators();
      toast.success("Removed");
    }
  };

  const changeRole = async (collaboratorId: string, targetUserId: string, newRole: string) => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/collaborate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId, role: newRole }),
    });
    if (res.ok) {
      socketRef.current?.emit("access-changed", { boardId: whiteboardId, userId: targetUserId, role: newRole });
      fetchCollaborators();
      toast.success(`Role changed to ${newRole}`);
    }
  };

  const togglePublic = async () => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !isPublic }),
    });
    if (res.ok) onTogglePublic(!isPublic);
  };

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(v) => {
        setDialogOpen(v);
        if (v) { fetchCollaborators(); fetchRequests(); }
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <button className="relative flex h-8 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]">
            {requests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--card)]">
                {requests.length}
              </span>
            )}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="rounded-2xl border-[var(--border)] bg-[var(--card)] shadow-xl sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base">Share whiteboard</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Public toggle */}
          <div className="rounded-xl bg-[var(--muted)] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Public access</p>
                <p className="text-xs text-[var(--muted-foreground)]">Anyone with the link can view</p>
              </div>
              <button
                onClick={togglePublic}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  isPublic ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    isPublic ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            {isPublic && (
              <div className="flex gap-1.5">
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/s/${whiteboardId}`}
                  className="h-8 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs text-[var(--muted-foreground)] select-all"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/s/${whiteboardId}`);
                    toast.success("Link copied");
                  }}
                  className="h-8 shrink-0 rounded-lg border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          {/* Add collaborator */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--foreground)]">Invite people</label>
            <div className="flex gap-2">
              <input
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
                className="h-9 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
              <Select value={role} onValueChange={(v) => setRole(v as "viewer" | "editor")}>
                <SelectTrigger className="h-9 w-[90px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={addCollaborator}
                disabled={addDisabled}
                title={isSelf ? "You can't invite yourself" : isDuplicate ? "Already has access" : undefined}
                className="h-9 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {isSelf && (
              <p className="text-[11px] text-[var(--muted-foreground)]">You can't invite yourself to your own board.</p>
            )}
            {isDuplicate && !isSelf && (
              <p className="text-[11px] text-[var(--muted-foreground)]">This person already has access.</p>
            )}
          </div>

          {/* Access requests */}
          {requests.length > 0 && (
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-[var(--foreground)]">Access requests</label>
              <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/50 divide-y divide-amber-200">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-700">
                        {r.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{r.userName}</p>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">{r.userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRequest(r.id, "approved", r.userId)}
                        className="h-7 rounded-lg bg-emerald-500 px-2.5 text-[11px] font-semibold text-white transition-all hover:bg-emerald-600 active:scale-[0.98]"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRequest(r.id, "denied", r.userId)}
                        className="h-7 rounded-lg border border-[var(--border)] px-2.5 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collaborator list */}
          {collaborators.length > 0 && (
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-[var(--foreground)]">People with access</label>
              <div className="space-y-1 rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {collaborators.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-[11px] font-semibold text-[var(--secondary-foreground)]">
                        {c.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{c.userName}</p>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">{c.userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={c.role} onValueChange={(v) => changeRole(c.id, c.userId, v)}>
                        <SelectTrigger className="h-6 w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => removeCollaborator(c.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
