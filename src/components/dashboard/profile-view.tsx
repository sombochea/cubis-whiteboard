"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { toast } from "sonner";
import Link from "next/link";
import { gravatarUrl } from "@/lib/gravatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

  const avatarSrc = user.image || gravatarUrl(user.email, 160);

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
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-6">
          <Link href="/w" className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <span className="text-[15px] font-semibold text-[var(--foreground)]">Profile</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          {/* Avatar section */}
          <div className="flex flex-col items-center py-8 border-b border-[var(--border)]">
            <img
              src={avatarSrc}
              alt={user.name}
              className="h-20 w-20 rounded-full object-cover border-2 border-[var(--border)]"
            />
            <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{user.name}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{user.email}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Fields */}
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--muted-foreground)]">Display name</label>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="h-9 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || name === user.name}
                  className="h-9 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--muted-foreground)]">Email</label>
              <input
                value={user.email}
                disabled
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 text-sm text-[var(--muted-foreground)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--muted-foreground)]">Profile picture</label>
              <p className="text-xs text-[var(--muted-foreground)]">
                Your avatar is loaded from <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">Gravatar</a> using your email address.
              </p>
            </div>
          </div>

          {/* Danger zone */}
          <div className="border-t border-[var(--border)] p-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="h-9 rounded-lg border border-[var(--destructive)]/30 px-4 text-sm font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10">
                  Sign out
                </button>
              </AlertDialogTrigger>
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
        </div>
      </main>
    </div>
  );
}
