import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whiteboard, collaborator, collectionWhiteboard, collection } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq, and, ilike } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const search = req.nextUrl.searchParams.get("q") || "";

  const owned = db
    .select()
    .from(whiteboard)
    .where(
      and(
        eq(whiteboard.ownerId, session.user.id),
        search ? ilike(whiteboard.title, `%${search}%`) : undefined
      )
    );

  const shared = db
    .select({ whiteboard })
    .from(collaborator)
    .innerJoin(whiteboard, eq(collaborator.whiteboardId, whiteboard.id))
    .where(
      and(
        eq(collaborator.userId, session.user.id),
        search ? ilike(whiteboard.title, `%${search}%`) : undefined
      )
    );

  // Collection tags for all boards the user can see
  const colTags = db
    .select({
      whiteboardId: collectionWhiteboard.whiteboardId,
      colName: collection.name,
      colColor: collection.color,
    })
    .from(collectionWhiteboard)
    .innerJoin(collection, eq(collectionWhiteboard.collectionId, collection.id))
    .where(eq(collection.ownerId, session.user.id));

  const [ownedResults, sharedResults, tagResults] = await Promise.all([owned, shared, colTags]);

  // Build a map: whiteboardId -> [{name, color}]
  const tagMap = new Map<string, { name: string; color: string }[]>();
  for (const t of tagResults) {
    if (!tagMap.has(t.whiteboardId)) tagMap.set(t.whiteboardId, []);
    tagMap.get(t.whiteboardId)!.push({ name: t.colName, color: t.colColor });
  }

  const all = [
    ...ownedResults.map((w) => ({ ...w, role: "owner" as const, collections: tagMap.get(w.id) || [] })),
    ...sharedResults.map((r) => ({ ...r.whiteboard, role: "collaborator" as const, collections: tagMap.get(r.whiteboard.id) || [] })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const body = await req.json();

  const [created] = await db
    .insert(whiteboard)
    .values({
      title: body.title || "Untitled",
      data: body.data || { elements: [], appState: {} },
      ownerId: session.user.id,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
