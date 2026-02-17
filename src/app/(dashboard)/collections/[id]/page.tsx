import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collection, collectionWhiteboard, whiteboard } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [col] = await db
    .select()
    .from(collection)
    .where(and(eq(collection.id, id), eq(collection.ownerId, session.user.id)))
    .limit(1);

  if (!col) notFound();

  const items = await db
    .select({ whiteboard })
    .from(collectionWhiteboard)
    .innerJoin(whiteboard, eq(collectionWhiteboard.whiteboardId, whiteboard.id))
    .where(eq(collectionWhiteboard.collectionId, id));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Nav */}
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
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--foreground)]">{col.name}</h1>
            {col.description && (
              <p className="text-xs text-[var(--muted-foreground)]">{col.description}</p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map(({ whiteboard: wb }) => (
            <Link key={wb.id} href={`/whiteboards/${wb.id}`}>
              <div className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary)]/5">
                <div
                  className="relative h-36 bg-[var(--muted)]"
                  style={{
                    backgroundImage: "radial-gradient(circle, var(--muted-foreground) 0.5px, transparent 0.5px)",
                    backgroundSize: "16px 16px",
                  }}
                />
                <div className="p-3.5">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{wb.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {new Date(wb.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          {items.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--foreground)]">Empty collection</p>
              <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                Drag boards here from the dashboard
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
