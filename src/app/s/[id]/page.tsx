import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { whiteboard, collaborator, accessRequest } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import PublicBoard from "./public-board";

export default async function PublicWhiteboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [wb] = await db.select().from(whiteboard).where(eq(whiteboard.id, id)).limit(1);
  if (!wb || !wb.isPublic) notFound();

  const session = await getSession();
  let requestStatus: "none" | "pending" | "denied" | null = null;
  let userId: string | null = null;
  let userName: string | null = null;
  let userEmail: string | null = null;

  if (session) {
    userId = session.user.id;
    userName = session.user.name;
    userEmail = session.user.email;
    if (wb.ownerId === session.user.id) redirect(`/w/${id}`);

    const [collab] = await db
      .select({ role: collaborator.role })
      .from(collaborator)
      .where(and(eq(collaborator.whiteboardId, id), eq(collaborator.userId, session.user.id)))
      .limit(1);

    if (collab?.role === "editor" || collab?.role === "owner") redirect(`/w/${id}`);

    // Check if they already have a pending/denied request
    const [ar] = await db
      .select({ status: accessRequest.status })
      .from(accessRequest)
      .where(
        and(
          eq(accessRequest.whiteboardId, id),
          eq(accessRequest.userId, session.user.id),
        )
      )
      .limit(1);

    requestStatus = (ar?.status as "pending" | "denied") ?? "none";
  }

  return (
    <PublicBoard
      whiteboardId={wb.id}
      title={wb.title}
      data={wb.data as any}
      isLoggedIn={!!session}
      requestStatus={requestStatus}
      userId={userId}
      userName={userName}
      userEmail={userEmail}
    />
  );
}
