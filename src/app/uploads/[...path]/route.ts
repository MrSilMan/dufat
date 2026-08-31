import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  LEGACY_UPLOAD_DIR,
  UPLOAD_CONTENT_TYPE_BY_EXTENSION,
  UPLOAD_DIR,
  resolveUploadPath,
} from "@/lib/uploads";

/**
 * Serves admin-uploaded media from disk (see src/lib/uploads.ts for why these
 * files cannot live in public/). Filenames carry a timestamp + random suffix,
 * so a given URL never changes content and can be cached immutably.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path: string[] }> };

async function readUpload(segments: string[]): Promise<{ file: Buffer; type: string } | null> {
  for (const directory of [UPLOAD_DIR, LEGACY_UPLOAD_DIR]) {
    const target = resolveUploadPath(directory, segments);
    if (!target) return null;
    const info = await stat(target).catch(() => null);
    if (!info?.isFile()) continue;
    return {
      file: await readFile(target),
      type: UPLOAD_CONTENT_TYPE_BY_EXTENSION[path.extname(target).toLowerCase()],
    };
  }
  return null;
}

export async function GET(_request: Request, { params }: Params) {
  const { path: segments } = await params;
  const upload = await readUpload(segments);
  if (!upload) {
    return NextResponse.json({ ok: false, message: "Ficheiro não encontrado" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(upload.file), {
    headers: {
      "Content-Type": upload.type,
      "Content-Length": String(upload.file.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      // SVGs are user-supplied: never let one execute in the site's origin.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
