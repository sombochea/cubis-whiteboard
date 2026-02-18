import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--muted)]">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[var(--foreground)]">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          The page you're looking for doesn't exist or has been removed.
        </p>
        <Link
          href="/whiteboards"
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
