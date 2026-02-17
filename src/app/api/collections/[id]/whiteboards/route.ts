import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectionWhiteboard, whiteboard, collection } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  // Verify ownership
  const [col] = await db
    .select()
    .from(collection)
    .where(and(eq(collection.id, id), eq(collection.ownerId, session.user.id)))
    .limit(1);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db
    .select({ whiteboard })
    .from(collectionWhiteboard)
    .innerJoin(whiteboard, eq(collectionWhiteboard.whiteboardId, whiteboard.id))
    .where(eq(collectionWhiteboard.collectionId, id));

  return NextResponse.json(items.map((i) => i.whiteboard));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  const [col] = await db
    .select()
    .from(collection)
    .where(and(eq(collection.id, id), eq(collection.ownerId, session.user.id)))
    .limit(1);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { whiteboardId } = await req.json();
  await db
    .insert(collectionWhiteboard)
    .values({ collectionId: id, whiteboardId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  const [col] = await db
    .select()
    .from(collection)
    .where(and(eq(collection.id, id), eq(collection.ownerId, session.user.id)))
    .limit(1);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { whiteboardId } = await req.json();
  await db
    .delete(collectionWhiteboard)
    .where(
      and(
        eq(collectionWhiteboard.collectionId, id),
        eq(collectionWhiteboard.whiteboardId, whiteboardId)
      )
    );

  return NextResponse.json({ ok: true });
}
