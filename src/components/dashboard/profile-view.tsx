"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { toast } from "sonner";
import Link from "next/link";

interface ProfileUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  createdAt: string;
}

export default function ProfileView({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || name === user.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) toast.success("Profile updated");
      else toast.error("Failed to update");
    } catch { toast.error("Network error"); }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-6">
          <Link href="/whiteboards" className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </Link>
          <span className="text-[15px] font-semibold text-[var(--foreground)]">Profile</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        {/* Avatar + info */}
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-2xl font-bold text-white">
            {user.image ? (
              <img src={user.image} alt={user.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--foreground)]">{user.name}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{user.email}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Edit name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">Display name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name === user.name}
              className="h-10 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">Email</label>
          <input
            value={user.email}
            disabled
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 text-sm text-[var(--muted-foreground)]"
          />
        </div>

        <div className="border-t border-[var(--border)] pt-6">
          <button
            onClick={handleSignOut}
            className="h-10 rounded-xl border border-[var(--destructive)]/30 px-5 text-sm font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
