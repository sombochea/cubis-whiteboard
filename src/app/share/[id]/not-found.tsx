import Link from "next/link";

export default function ShareNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--muted)]">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[var(--foreground)]">Board not available</h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          This whiteboard doesn't exist, isn't public, or the link may have expired.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
