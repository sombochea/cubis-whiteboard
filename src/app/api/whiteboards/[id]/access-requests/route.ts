import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accessRequest, collaborator, user, whiteboard } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

// GET — owner fetches pending requests
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  const [wb] = await db
    .select({ ownerId: whiteboard.ownerId })
    .from(whiteboard)
    .where(and(eq(whiteboard.id, id), eq(whiteboard.ownerId, session.user.id)))
    .limit(1);
  if (!wb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requests = await db
    .select({
      id: accessRequest.id,
      status: accessRequest.status,
      createdAt: accessRequest.createdAt,
      userId: accessRequest.userId,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(accessRequest)
    .innerJoin(user, eq(accessRequest.userId, user.id))
    .where(and(eq(accessRequest.whiteboardId, id), eq(accessRequest.status, "pending")));

  return NextResponse.json(requests);
}

// POST — logged-in user requests edit access
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  // Check board exists and is public
  const [wb] = await db
    .select({ id: whiteboard.id, ownerId: whiteboard.ownerId })
    .from(whiteboard)
    .where(and(eq(whiteboard.id, id), eq(whiteboard.isPublic, true)))
    .limit(1);
  if (!wb) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (wb.ownerId === session.user.id)
    return NextResponse.json({ error: "You own this board" }, { status: 400 });

  // Already a collaborator?
  const [existing] = await db
    .select({ id: collaborator.id })
    .from(collaborator)
    .where(and(eq(collaborator.whiteboardId, id), eq(collaborator.userId, session.user.id)))
    .limit(1);
  if (existing) return NextResponse.json({ error: "Already has access" }, { status: 400 });

  // Already pending?
  const [existing_req] = await db
    .select({ id: accessRequest.id, status: accessRequest.status })
    .from(accessRequest)
    .where(and(eq(accessRequest.whiteboardId, id), eq(accessRequest.userId, session.user.id)))
    .limit(1);

  if (existing_req?.status === "pending") return NextResponse.json({ status: "pending" });

  // Re-request after denial — reset to pending
  if (existing_req?.status === "denied") {
    await db.update(accessRequest).set({ status: "pending" }).where(eq(accessRequest.id, existing_req.id));
    return NextResponse.json({ status: "pending" }, { status: 200 });
  }

  const [req] = await db
    .insert(accessRequest)
    .values({ whiteboardId: id, userId: session.user.id })
    .returning();

  return NextResponse.json(req, { status: 201 });
}

// PATCH — owner approves or denies
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireSession();

  const [wb] = await db
    .select({ ownerId: whiteboard.ownerId })
    .from(whiteboard)
    .where(and(eq(whiteboard.id, id), eq(whiteboard.ownerId, session.user.id)))
    .limit(1);
  if (!wb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { requestId, action } = await req.json();
  if (!["approved", "denied"].includes(action))
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const [ar] = await db
    .update(accessRequest)
    .set({ status: action })
    .where(and(eq(accessRequest.id, requestId), eq(accessRequest.whiteboardId, id)))
    .returning();
  if (!ar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If approved, add as editor collaborator
  if (action === "approved") {
    await db
      .insert(collaborator)
      .values({ whiteboardId: id, userId: ar.userId, role: "editor" })
      .onConflictDoNothing();
  }

  return NextResponse.json({ ok: true });
}
