import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/redis";

const trackSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(300)
    .regex(/^\//, "path must be relative"),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`track:${ip}`, 60, 60))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = trackSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Ignore admin/internal paths; analytics is for the public site.
  if (result.data.path.startsWith("/admin") || result.data.path.startsWith("/api")) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.pageView.create({ data: { path: result.data.path } });
  } catch {
    // Analytics writes must never break the page.
  }
  return NextResponse.json({ ok: true });
}
