import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveFilms } from "@/lib/films";
import { analyzeBuild } from "@/lib/scoring";
import { isTmdbConfigured, TmdbError } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BuildRequestBody {
  ids?: unknown;
}

const MAX_FILMS = 8;

/**
 * Score a Top 4 build.
 *
 * Body: `{ ids: number[] }`. Film data comes from TMDB, falling back to the
 * bundled dataset when TMDB has no credentials.
 */
export async function POST(request: NextRequest) {
  let body: BuildRequestBody;
  try {
    body = (await request.json()) as BuildRequestBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = rawIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (ids.length === 0 || ids.length > MAX_FILMS) {
    return NextResponse.json({ error: "INVALID_IDS" }, { status: 400 });
  }

  const tmdbConfigured = isTmdbConfigured();

  try {
    const films = await resolveFilms(ids);
    const result = analyzeBuild(films);
    return NextResponse.json({
      ...result,
      meta: {
        tmdbConfigured,
        demo: !tmdbConfigured,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof TmdbError) {
      const status =
        error.code === "NOT_CONFIGURED"
          ? 400
          : error.code === "NOT_FOUND"
            ? 404
            : 502;
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status }
      );
    }
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
