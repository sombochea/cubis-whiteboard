import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whiteboard, collaborator } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq, and, or } from "drizzle-orm";

async function canAccess(whiteboardId: string, userId: string, requireEdit = false) {
  const [wb] = await db
    .select()
    .from(whiteboard)
    .where(eq(whiteboard.id, whiteboardId))
    .limit(1);

  if (!wb) return null;
  if (wb.ownerId === userId) return wb;
  if (wb.isPublic && !requireEdit) return wb;

  const [collab] = await db
    .select()
    .from(collaborator)
    .where(
      and(eq(collaborator.whiteboardId, whiteboardId), eq(collaborator.userId, userId))
    )
    .limit(1);

  if (!collab) return null;
  if (requireEdit && collab.role === "viewer") return null;
  return wb;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();
  const wb = await canAccess(id, session.user.id);
  if (!wb) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(wb);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();
  const wb = await canAccess(id, session.user.id, true);
  if (!wb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const [updated] = await db
    .update(whiteboard)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.data !== undefined && { data: body.data }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      ...(body.thumbnail !== undefined && { thumbnail: body.thumbnail }),
    })
    .where(eq(whiteboard.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
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

  await db.delete(whiteboard).where(eq(whiteboard.id, id));
  return NextResponse.json({ ok: true });
}
