import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Não autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Ficheiro em falta" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ ok: false, message: "Tipo de ficheiro não suportado" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "Ficheiro demasiado grande (máx. 8 MB)" }, { status: 413 });
  }

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, name), Buffer.from(await file.arrayBuffer()));

  const url = `/uploads/${name}`;
  logger.info("admin_asset_uploaded", { url, size: file.size, by: session.email });
  return NextResponse.json({ ok: true, url });
}
