import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { library } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await requireSession();
  const [row] = await db.select().from(library).where(eq(library.userId, session.user.id)).limit(1);
  return NextResponse.json(row?.items ?? []);
}

export async function PUT(req: Request) {
  const session = await requireSession();
  const { items } = await req.json();
  await db
    .insert(library)
    .values({ userId: session.user.id, items: items ?? [] })
    .onConflictDoUpdate({ target: library.userId, set: { items: items ?? [], updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
