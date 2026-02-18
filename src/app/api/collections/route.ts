import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collection } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await requireSession();
  const collections = await db
    .select()
    .from(collection)
    .where(eq(collection.ownerId, session.user.id))
    .orderBy(collection.createdAt);
  return NextResponse.json(collections);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const { name, description, color } = await req.json();

  const [created] = await db
    .insert(collection)
    .values({ name, description, color: color || "#808080", ownerId: session.user.id })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
