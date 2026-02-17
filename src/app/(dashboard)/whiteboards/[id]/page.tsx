import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { whiteboard, collaborator } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import WhiteboardEditor from "@/components/whiteboard/editor";

export default async function WhiteboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  // Check access
  const [wb] = await db
    .select()
    .from(whiteboard)
    .where(eq(whiteboard.id, id))
    .limit(1);

  if (!wb) notFound();

  const isOwner = wb.ownerId === session.user.id;

  if (!isOwner && !wb.isPublic) {
    const [collab] = await db
      .select()
      .from(collaborator)
      .where(
        and(
          eq(collaborator.whiteboardId, id),
          eq(collaborator.userId, session.user.id)
        )
      )
      .limit(1);
    if (!collab) notFound();
  }

  return (
    <WhiteboardEditor
      whiteboardId={wb.id}
      initialData={wb.data as any}
      initialTitle={wb.title}
      userId={session.user.id}
      userName={session.user.name}
      userImage={session.user.image}
      isOwner={isOwner}
      serverUpdatedAt={wb.updatedAt.getTime()}
    />
  );
}
