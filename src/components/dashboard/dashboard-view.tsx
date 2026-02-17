"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Whiteboard {
  id: string;
  title: string;
  updatedAt: string;
  isPublic: boolean;
  role: "owner" | "collaborator";
}

interface Collection {
  id: string;
  name: string;
  description?: string;
}

export default function DashboardView({ userId }: { userId: string }) {
  const router = useRouter();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [draggedWb, setDraggedWb] = useState<string | null>(null);

  const fetchWhiteboards = useCallback(async () => {
    const res = await fetch(`/api/whiteboards?q=${encodeURIComponent(search)}`);
    if (res.ok) setWhiteboards(await res.json());
  }, [search]);

  const fetchCollections = useCallback(async () => {
    const res = await fetch("/api/collections");
    if (res.ok) setCollections(await res.json());
  }, []);

  useEffect(() => {
    fetchWhiteboards();
    fetchCollections();
  }, [fetchWhiteboards, fetchCollections]);

  useEffect(() => {
    const t = setTimeout(fetchWhiteboards, 300);
    return () => clearTimeout(t);
  }, [search]);

  const createWhiteboard = async () => {
    const res = await fetch("/api/whiteboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    if (res.ok) {
      const wb = await res.json();
      router.push(`/whiteboards/${wb.id}`);
    }
  };

  const deleteWhiteboard = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/whiteboards/${id}`, { method: "DELETE" });
    toast.success("Deleted");
    fetchWhiteboards();
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCollectionName }),
    });
    if (res.ok) {
      setNewCollectionName("");
      setCollectionDialogOpen(false);
      fetchCollections();
      toast.success("Collection created");
    }
  };

  const handleDrop = async (collectionId: string) => {
    if (!draggedWb) return;
    await fetch(`/api/collections/${collectionId}/whiteboards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whiteboardId: draggedWb }),
    });
    setDraggedWb(null);
    toast.success("Added to collection");
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-[var(--foreground)]">Cubis</span>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
              <DialogTrigger asChild>
                <button className="h-8 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]">
                  New collection
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl border-[var(--border)] bg-[var(--card)] shadow-xl sm:max-w-[380px]">
                <DialogHeader>
                  <DialogTitle className="text-base">Create collection</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-1">
                  <input
                    placeholder="Collection name"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createCollection()}
                    className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    autoFocus
                  />
                  <button
                    onClick={createCollection}
                    className="h-9 w-full rounded-xl bg-[var(--primary)] text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    Create
                  </button>
                </div>
              </DialogContent>
            </Dialog>

            <button
              onClick={createWhiteboard}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New board
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* ── Search ── */}
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search boards…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
          />
        </div>

        {/* ── Collections ── */}
        {collections.length > 0 && (
          <section>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Collections
            </h2>
            <div className="flex flex-wrap gap-2">
              {collections.map((col) => (
                <button
                  key={col.id}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-[13px] font-medium text-[var(--foreground)] transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--secondary)]"
                  style={{
                    borderStyle: draggedWb ? "dashed" : undefined,
                    borderColor: draggedWb ? "var(--primary)" : undefined,
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(col.id)}
                  onClick={() => router.push(`/collections/${col.id}`)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--primary)]">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  {col.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Board grid ── */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            All boards
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {whiteboards.map((wb) => (
              <div
                key={wb.id}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary)]/5"
                draggable
                onDragStart={() => setDraggedWb(wb.id)}
                onDragEnd={() => setDraggedWb(null)}
                onClick={() => router.push(`/whiteboards/${wb.id}`)}
              >
                {/* Preview area */}
                <div className="relative h-36 bg-[var(--muted)] p-4">
                  {/* Decorative grid dots */}
                  <div
                    className="absolute inset-0 opacity-[0.15]"
                    style={{
                      backgroundImage: "radial-gradient(circle, var(--muted-foreground) 0.5px, transparent 0.5px)",
                      backgroundSize: "16px 16px",
                    }}
                  />
                  {/* Badges */}
                  <div className="relative flex gap-1.5">
                    {wb.role === "collaborator" && (
                      <span className="rounded-md bg-[var(--secondary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--secondary-foreground)]">
                        Shared
                      </span>
                    )}
                    {wb.isPublic && (
                      <span className="rounded-md bg-[var(--chart-3)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--chart-3)]">
                        Public
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-center justify-between p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {wb.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {timeAgo(wb.updatedAt)}
                    </p>
                  </div>

                  {wb.role === "owner" && (
                    <button
                      onClick={(e) => deleteWhiteboard(wb.id, e)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] group-hover:opacity-100"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Empty state */}
            {whiteboards.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="M2 2l7.586 7.586" />
                    <circle cx="11" cy="11" r="2" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--foreground)]">No boards yet</p>
                <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                  Create your first whiteboard to get started
                </p>
                <button
                  onClick={createWhiteboard}
                  className="mt-4 h-9 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  Create board
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
