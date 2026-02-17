"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

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
}

export default function ShareDialog({ whiteboardId, isPublic, onTogglePublic }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [open, setOpen] = useState(false);

  const fetchCollaborators = async () => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/collaborate`);
    if (res.ok) setCollaborators(await res.json());
  };

  const addCollaborator = async () => {
    if (!email.trim()) return;
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
    await fetch(`/api/whiteboards/${whiteboardId}/collaborate`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId }),
    });
    fetchCollaborators();
    toast.success("Removed");
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
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) fetchCollaborators();
      }}
    >
      <DialogTrigger asChild>
        <button className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-[var(--border)] bg-[var(--card)] shadow-xl sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base">Share whiteboard</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Public toggle */}
          <div className="flex items-center justify-between rounded-xl bg-[var(--muted)] p-3">
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
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
                className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs font-medium text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button
                onClick={addCollaborator}
                className="h-9 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Add
              </button>
            </div>
          </div>

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
                      <span className="rounded-md bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                        {c.role}
                      </span>
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
