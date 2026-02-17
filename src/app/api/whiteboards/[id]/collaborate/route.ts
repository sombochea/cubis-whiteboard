import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collaborator, user, whiteboard } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await requireSession();

  const collabs = await db
    .select({
      id: collaborator.id,
      role: collaborator.role,
      userId: collaborator.userId,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(collaborator)
    .innerJoin(user, eq(collaborator.userId, user.id))
    .where(eq(collaborator.whiteboardId, id));

  return NextResponse.json(collabs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  // Only owner can add collaborators
  const [wb] = await db
    .select()
    .from(whiteboard)
    .where(and(eq(whiteboard.id, id), eq(whiteboard.ownerId, session.user.id)))
    .limit(1);
  if (!wb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, role = "viewer" } = await req.json();
  const [target] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [collab] = await db
    .insert(collaborator)
    .values({ whiteboardId: id, userId: target.id, role })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json(collab, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  const [wb] = await db
    .select()
    .from(whiteboard)
    .where(and(eq(whiteboard.id, id), eq(whiteboard.ownerId, session.user.id)))
    .limit(1);
  if (!wb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { collaboratorId } = await req.json();
  await db.delete(collaborator).where(eq(collaborator.id, collaboratorId));
  return NextResponse.json({ ok: true });
}
