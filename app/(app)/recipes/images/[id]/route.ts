import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { SERVER_CONFIG } from "@/config/env-config-server";

export const runtime = "nodejs";

const RECIPES_DISK_DIR = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes");
const VALID_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Validate filename format to prevent path traversal
  if (!id || !VALID_FILENAME_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (id.includes("/") || id.includes("\\") || id.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(RECIPES_DISK_DIR, id);

  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(RECIPES_DISK_DIR);
  const relative = path.relative(resolvedDir, resolvedPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".avif"
            ? "image/avif"
            : "image/jpeg";

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
