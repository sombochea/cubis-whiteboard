import { NextRequest, NextResponse } from "next/server";
import { getFileBuffer } from "@/lib/storage";
import { db } from "@/lib/db";
import { file } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  const [record] = await db
    .select()
    .from(file)
    .where(eq(file.storageKey, decodedKey))
    .limit(1);

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await getFileBuffer(record.storageKey, record.storageProvider as "local" | "s3");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": record.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
