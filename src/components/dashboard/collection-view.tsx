"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";

const TAG_COLORS = [
  { name: "Red", value: "#FF6961" },
  { name: "Orange", value: "#FFB347" },
  { name: "Yellow", value: "#FDFD96" },
  { name: "Green", value: "#77DD77" },
  { name: "Blue", value: "#84B6F4" },
  { name: "Purple", value: "#B39EB5" },
  { name: "Gray", value: "#CFCFC4" },
];

interface Props {
  collection: { id: string; name: string; color: string; description?: string | null };
  whiteboards: { id: string; title: string; thumbnail?: string | null; updatedAt: string }[];
}

export default function CollectionView({ collection: col, whiteboards }: Props) {
  const [name, setName] = useState(col.name);
  const [color, setColor] = useState(col.color);
  const [editing, setEditing] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveName = async () => {
    setEditing(false);
    if (!name.trim() || name === col.name) { setName(col.name); return; }
    const res = await fetch(`/api/collections/${col.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) toast.success("Collection renamed");
    else { setName(col.name); toast.error("Failed to rename"); }
  };

  const saveColor = async (c: string) => {
    setColor(c);
    setColorOpen(false);
    await fetch(`/api/collections/${col.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: c }),
    });
  };

  const startEditing = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
          <Link
            href="/whiteboards"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>

          {/* Color dot */}
          <div className="relative">
            <button
              onClick={() => setColorOpen(!colorOpen)}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            />
            {colorOpen && (
              <div className="absolute top-8 left-0 z-50 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-lg">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => saveColor(c.value)}
                    className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-125"
                    style={{ backgroundColor: c.value, borderColor: color === c.value ? "var(--foreground)" : "transparent" }}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>

          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") { setName(col.name); setEditing(false); }
              }}
              className="h-8 w-56 rounded-lg border border-[var(--primary)]/30 bg-transparent px-2 text-[15px] font-semibold text-[var(--foreground)] outline-none ring-2 ring-[var(--primary)]/20"
              autoFocus
            />
          ) : (
            <button
              onClick={startEditing}
              className="group flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--muted)]"
            >
              <h1 className="text-[15px] font-semibold text-[var(--foreground)]">{name}</h1>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {whiteboards.map((wb) => (
            <Link key={wb.id} href={`/whiteboards/${wb.id}`}>
              <div className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary)]/5">
                <div className="relative h-36 bg-[var(--muted)] overflow-hidden">
                  {wb.thumbnail ? (
                    <img src={wb.thumbnail} alt="" className="h-full w-full object-contain bg-white" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle, var(--muted-foreground) 0.5px, transparent 0.5px)", backgroundSize: "16px 16px" }} />
                  )}
                </div>
                <div className="p-3.5">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{wb.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {new Date(wb.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          {whiteboards.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--foreground)]">Empty collection</p>
              <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">Drag boards here from the dashboard</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
