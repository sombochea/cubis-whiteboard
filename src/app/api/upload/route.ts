import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadFile, getFileUrl } from "@/lib/storage";
import { db } from "@/lib/db";
import { file } from "@/lib/db/schema";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const uploaded = formData.get("file") as File | null;
  const whiteboardId = formData.get("whiteboardId") as string | null;

  if (!uploaded) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (uploaded.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await uploaded.arrayBuffer());
  const result = await uploadFile(buffer, uploaded.name, uploaded.type);
  const url = await getFileUrl(result.key, result.provider);

  const [record] = await db
    .insert(file)
    .values({
      filename: uploaded.name,
      mimeType: uploaded.type,
      size: String(uploaded.size),
      storageKey: result.key,
      storageProvider: result.provider,
      uploadedBy: session.user.id,
      whiteboardId,
    })
    .returning();

  return NextResponse.json({ ...record, url }, { status: 201 });
}
