import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whiteboard } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import { collaborator } from "@/lib/db/schema";

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

  const [ownedResults, sharedResults] = await Promise.all([owned, shared]);

  const all = [
    ...ownedResults.map((w) => ({ ...w, role: "owner" as const })),
    ...sharedResults.map((r) => ({ ...r.whiteboard, role: "collaborator" as const })),
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
