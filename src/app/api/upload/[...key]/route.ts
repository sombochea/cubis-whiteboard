import { NextRequest, NextResponse } from "next/server";
import { getFileBuffer } from "@/lib/storage";
import { db } from "@/lib/db";
import { file } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const storageKey = key.join("/");

  const [record] = await db
    .select()
    .from(file)
    .where(eq(file.storageKey, storageKey))
    .limit(1);

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const buffer = await getFileBuffer(record.storageKey, record.storageProvider as "local" | "s3");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Length": record.size,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }
}
