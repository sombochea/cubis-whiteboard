import Link from "next/link";

export default function WhiteboardNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--muted)]">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[var(--foreground)]">Access denied</h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          This whiteboard doesn't exist or you don't have permission to view it. Ask the owner to share it with you.
        </p>
        <Link
          href="/w"
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
