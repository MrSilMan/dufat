import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { UPLOAD_DIR, UPLOAD_EXTENSION_BY_TYPE, UPLOAD_URL_PREFIX } from "@/lib/uploads";

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

  const extension = UPLOAD_EXTENSION_BY_TYPE[file.type];
  if (!extension) {
    return NextResponse.json({ ok: false, message: "Tipo de ficheiro não suportado" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "Ficheiro demasiado grande (máx. 8 MB)" }, { status: 413 });
  }

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    // A read-only or missing upload directory used to surface as a silently
    // broken image; fail the request instead so the admin sees it.
    logger.error("admin_asset_upload_failed", {
      dir: UPLOAD_DIR,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, message: "Não foi possível guardar o ficheiro no servidor" },
      { status: 500 },
    );
  }

  const url = `${UPLOAD_URL_PREFIX}/${name}`;
  logger.info("admin_asset_uploaded", { url, size: file.size, by: session.email });
  return NextResponse.json({ ok: true, url });
}
