import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collection } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();
  const body = await req.json();

  const [updated] = await db
    .update(collection)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
    })
    .where(and(eq(collection.id, id), eq(collection.ownerId, session.user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  await db
    .delete(collection)
    .where(and(eq(collection.id, id), eq(collection.ownerId, session.user.id)));

  return NextResponse.json({ ok: true });
}
