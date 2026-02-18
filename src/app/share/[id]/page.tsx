import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { whiteboard } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import PublicBoard from "./public-board";

export default async function PublicWhiteboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [wb] = await db.select().from(whiteboard).where(eq(whiteboard.id, id)).limit(1);
  if (!wb || !wb.isPublic) notFound();

  return (
    <PublicBoard
      title={wb.title}
      data={wb.data as any}
    />
  );
}
