import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { whiteboard, collaborator } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import WhiteboardEditor from "@/components/whiteboard/editor";

export default async function WhiteboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [wb] = await db
    .select()
    .from(whiteboard)
    .where(eq(whiteboard.id, id))
    .limit(1);

  if (!wb) notFound();

  const isOwner = wb.ownerId === session.user.id;
  let role: "owner" | "editor" | "viewer" | null = isOwner ? "owner" : null;

  if (!isOwner) {
    const [collab] = await db
      .select({ role: collaborator.role })
      .from(collaborator)
      .where(
        and(
          eq(collaborator.whiteboardId, id),
          eq(collaborator.userId, session.user.id)
        )
      )
      .limit(1);

    if (collab) {
      role = collab.role as "editor" | "viewer";
    } else if (wb.isPublic) {
      // Public board, no collaborator record → view-only via share page
      redirect(`/share/${id}`);
    }
  }

  // No access at all
  if (!role) notFound();

  // Viewers can't use the editor — send them to the share page if public,
  // otherwise deny access
  if (role === "viewer") {
    if (wb.isPublic) redirect(`/share/${id}`);
    notFound();
  }

  return (
    <WhiteboardEditor
      whiteboardId={wb.id}
      initialData={wb.data as any}
      initialTitle={wb.title}
      userId={session.user.id}
      userName={session.user.name}
      userEmail={session.user.email}
      userImage={session.user.image}
      isOwner={isOwner}
      isPublicInitial={wb.isPublic}
      serverUpdatedAt={wb.updatedAt.getTime()}
    />
  );
}
