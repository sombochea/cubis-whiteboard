import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collection, collectionWhiteboard, whiteboard } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/whiteboards" className="text-sm text-muted-foreground hover:underline">
            ← Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-1">{col.name}</h1>
          {col.description && (
            <p className="text-muted-foreground">{col.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map(({ whiteboard: wb }) => (
          <Link key={wb.id} href={`/whiteboards/${wb.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm truncate">{wb.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-24 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                  Preview
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <span className="text-xs text-muted-foreground">
                  {new Date(wb.updatedAt).toLocaleDateString()}
                </span>
              </CardFooter>
            </Card>
          </Link>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No whiteboards in this collection. Drag and drop from the dashboard!
          </div>
        )}
      </div>
    </div>
  );
}
