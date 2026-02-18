"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { signOut } from "@/lib/auth/client";
import { gravatarUrl } from "@/lib/gravatar";

// macOS / Google Drive–style tag colors
const TAG_COLORS = [
  { name: "Red", value: "#FF6961" },
  { name: "Orange", value: "#FFB347" },
  { name: "Yellow", value: "#FDFD96" },
  { name: "Green", value: "#77DD77" },
  { name: "Blue", value: "#84B6F4" },
  { name: "Purple", value: "#B39EB5" },
  { name: "Gray", value: "#CFCFC4" },
];

interface Whiteboard {
  id: string;
  title: string;
  thumbnail?: string | null;
  updatedAt: string;
  isPublic: boolean;
  role: "owner" | "collaborator";
  collections: { name: string; color: string }[];
}

interface Collection {
  id: string;
  name: string;
  color: string;
}

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
  userImage?: string | null;
}

export default function DashboardView({ userId, userName, userEmail, userImage }: Props) {
  const router = useRouter();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [draggedWb, setDraggedWb] = useState<string | null>(null);
  const [creatingCol, setCreatingCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(TAG_COLORS[4].value);
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const avatarSrc = userImage || gravatarUrl(userEmail, 64);

  const fetchData = useCallback(async (q = "") => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const [wbRes, colRes] = await Promise.all([
        fetch(`/api/whiteboards?q=${encodeURIComponent(q)}`, { signal: ac.signal }),
        fetch("/api/collections", { signal: ac.signal }),
      ]);
      if (wbRes.ok) setWhiteboards(await wbRes.json());
      if (colRes.ok) setCollections(await colRes.json());
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const t = setTimeout(() => fetchData(search), 200);
    return () => clearTimeout(t);
  }, [search, fetchData]);

  const createWhiteboard = async () => {
    const res = await fetch("/api/whiteboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    if (res.ok) {
      const wb = await res.json();
      startTransition(() => router.push(`/whiteboards/${wb.id}`));
    }
  };

  const deleteWhiteboard = async (id: string) => {
    await fetch(`/api/whiteboards/${id}`, { method: "DELETE" });
    setWhiteboards((prev) => prev.filter((w) => w.id !== id));
    setDeleteTarget(null);
    toast.success("Deleted");
  };

  const createCollection = async () => {
    if (!newColName.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newColName, color: newColColor }),
    });
    if (res.ok) {
      const col = await res.json();
      setCollections((prev) => [...prev, col]);
      setNewColName("");
      setNewColColor(TAG_COLORS[4].value);
      setCreatingCol(false);
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
    fetchData(search);
    toast.success("Added to collection");
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
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
      {/* ── Nav ── */}
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

          <div className="hidden sm:block relative w-full max-w-sm mx-6">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search boards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--muted)]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white overflow-hidden">
                  <img src={avatarSrc} alt={userName} className="h-full w-full rounded-full object-cover" />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-[13px] font-medium leading-tight text-[var(--foreground)]">{userName}</p>
                  <p className="text-[11px] leading-tight text-[var(--muted-foreground)]">{userEmail}</p>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden md:block"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-[var(--border)] bg-[var(--card)] shadow-lg">
              <DropdownMenuItem asChild className="rounded-lg text-[13px]"><Link href="/profile">Profile</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSignOutOpen(true)} className="rounded-lg text-[13px] text-[var(--destructive)] focus:text-[var(--destructive)]">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Mobile search */}
        <div className="sm:hidden relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input placeholder="Search boards…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
        </div>

        {/* ── Collections — compact inline ── */}
        {(collections.length > 0 || !loading) && (
          <section>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Collections</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {collections.map((col) => (
                <button
                  key={col.id}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)] transition-all hover:bg-[var(--secondary)]"
                  style={{ borderStyle: draggedWb ? "dashed" : "solid", borderColor: draggedWb ? col.color : undefined }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(col.id)}
                  onClick={() => router.push(`/collections/${col.id}`)}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  {col.name}
                </button>
              ))}

              {/* Inline new collection */}
              {creatingCol ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/40 bg-[var(--card)] px-2 py-0.5">
                  <ColorPicker value={newColColor} onChange={setNewColColor} />
                  <input
                    autoFocus
                    placeholder="Name"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createCollection();
                      if (e.key === "Escape") { setCreatingCol(false); setNewColName(""); }
                    }}
                    onBlur={() => { if (!newColName.trim()) { setCreatingCol(false); setNewColName(""); } }}
                    className="h-6 w-24 bg-transparent text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setCreatingCol(true)}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── Board grid ── */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {search ? "Results" : "All boards"}
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                  <div className="h-36 bg-[var(--muted)] animate-pulse" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-4 w-24 rounded bg-[var(--muted)] animate-pulse" />
                    <div className="h-3 w-16 rounded bg-[var(--muted)] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* New board placeholder */}
              <button
                onClick={createWhiteboard}
                disabled={isPending}
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-transparent py-16 transition-all hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/[0.03] active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] transition-transform group-hover:scale-110">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
                  {isPending ? "Creating…" : "New board"}
                </span>
              </button>

              {whiteboards.map((wb) => (
                <div
                  key={wb.id}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary)]/5"
                  draggable
                  onDragStart={() => setDraggedWb(wb.id)}
                  onDragEnd={() => setDraggedWb(null)}
                  onClick={() => startTransition(() => router.push(`/whiteboards/${wb.id}`))}
                >
                  {/* Thumbnail or dot grid */}
                  <div className="relative h-36 bg-[var(--muted)] overflow-hidden">
                    {wb.thumbnail ? (
                      <img src={wb.thumbnail} alt="" className="h-full w-full object-contain bg-white" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle, var(--muted-foreground) 0.5px, transparent 0.5px)", backgroundSize: "16px 16px" }} />
                    )}
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {wb.role === "collaborator" && (
                        <span className="rounded-md bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--secondary-foreground)]">Shared</span>
                      )}
                      {wb.isPublic && (
                        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">Public</span>
                      )}
                    </div>
                    {/* Collection color tags */}
                    {wb.collections.length > 0 && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        {wb.collections.map((c, i) => (
                          <span key={i} className="h-3 w-3 rounded-full border border-white/60 shadow-sm" style={{ backgroundColor: c.color }} title={c.name} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{wb.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs text-[var(--muted-foreground)]">{timeAgo(wb.updatedAt)}</span>
                        {wb.collections.length > 0 && (
                          <span className="text-[10px] text-[var(--muted-foreground)]">
                            {wb.collections.map((c) => c.name).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {wb.role === "owner" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(wb.id); }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] group-hover:opacity-100"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {whiteboards.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{search ? "No boards match your search" : "No boards yet"}</p>
                  <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">{search ? "Try a different search term" : "Click \"New board\" to get started"}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete board?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this whiteboard and all its data. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteWhiteboard(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sign out confirm */}
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You'll need to sign in again to access your boards.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Compact color picker (macOS-style dot row) ──
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] transition-transform hover:scale-110"
        style={{ backgroundColor: value }}
      />
      {open && (
        <div className="absolute top-7 left-0 z-50 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-lg">
          {TAG_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(c.value); setOpen(false); }}
              className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-125"
              style={{ backgroundColor: c.value, borderColor: value === c.value ? "var(--foreground)" : "transparent" }}
              title={c.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
