import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collection, collectionWhiteboard, whiteboard } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import CollectionView from "@/components/dashboard/collection-view";

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
    <CollectionView
      collection={{ id: col.id, name: col.name, color: col.color, description: col.description }}
      whiteboards={items.map(({ whiteboard: wb }) => ({
        id: wb.id,
        title: wb.title,
        thumbnail: wb.thumbnail,
        updatedAt: wb.updatedAt.toISOString(),
      }))}
    />
  );
}
