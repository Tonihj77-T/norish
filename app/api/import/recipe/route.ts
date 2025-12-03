import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";
import { importRecipeFromUrl } from "@/server/trpc/routers/recipes/import";
import { getHouseholdForUser } from "@/server/db";
import { isUrl } from "@/lib/helpers";
import { parserLogger as log } from "@/server/logger";

/**
 * POST /api/import/recipe
 *
 * Import a recipe from a URL. Supports both cookie auth and API key auth.
 * Designed for iOS Shortcuts and other programmatic access.
 *
 * Request body: { url: string }
 * Headers: x-api-key (optional, for API key auth)
 *
 * Response: { recipeId: string } on success
 */
export async function POST(req: Request) {
  try {
    // Build headers for auth (supports both cookie and API key)
    const headers = new Headers();
    const apiKeyHeader = req.headers.get("x-api-key");

    if (apiKeyHeader) headers.set("x-api-key", apiKeyHeader);

    // Authenticate
    const session = await auth.api.getSession({ headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'url' in request body" },
        { status: 400 }
      );
    }

    if (!isUrl(url)) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    log.info({ userId: session.user.id, url }, "Recipe import requested via API");

    // Build context and import
    const household = await getHouseholdForUser(session.user.id);
    const householdKey = household?.id ?? `user:${session.user.id}`;
    const recipeId = crypto.randomUUID();

    importRecipeFromUrl({ userId: session.user.id, householdKey }, recipeId, url);

    return NextResponse.json({ recipeId }, { status: 202 });
  } catch (err) {
    log.error({ err }, "POST /api/import/recipe failed");

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
