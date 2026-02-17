import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

interface StorageResult {
  key: string;
  provider: "local" | "s3";
}

const getS3Client = () =>
  new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<StorageResult> {
  const key = `${nanoid()}/${filename}`;
  const provider = (process.env.STORAGE_PROVIDER || "local") as "local" | "s3";

  if (provider === "s3") {
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
  } else {
    const dir = path.join(process.env.LOCAL_UPLOAD_DIR || "./uploads", path.dirname(key));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(process.env.LOCAL_UPLOAD_DIR || "./uploads", key), buffer);
  }

  return { key, provider };
}

export async function getFileUrl(key: string, provider: "local" | "s3"): Promise<string> {
  if (provider === "s3") {
    const s3 = getS3Client();
    return getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
      { expiresIn: 3600 }
    );
  }
  return `/api/upload/${encodeURIComponent(key)}`;
}

export async function getFileBuffer(key: string, provider: "local" | "s3"): Promise<Buffer> {
  if (provider === "s3") {
    const s3 = getS3Client();
    const res = await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key })
    );
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return readFile(path.join(process.env.LOCAL_UPLOAD_DIR || "./uploads", key));
}

export async function deleteFile(key: string, provider: "local" | "s3") {
  if (provider === "s3") {
    const s3 = getS3Client();
    await s3.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key })
    );
  } else {
    await unlink(path.join(process.env.LOCAL_UPLOAD_DIR || "./uploads", key)).catch(() => {});
  }
}
