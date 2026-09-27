import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { searchCatalog } from "@/lib/films";
import { isSearchableQuery } from "@/lib/search-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Movie search: TMDB results merged with local award-dataset titles.
 * Query params: `q` (>= 2 chars, or a single CJK character) and `lang` (zh | en).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q") ?? "";
  const lang = searchParams.get("lang") === "en" ? "en" : "zh";

  if (!isSearchableQuery(query)) {
    return NextResponse.json({
      results: [],
      tmdbConfigured: false,
      degraded: false,
    });
  }

  try {
    const payload = await searchCatalog(query, lang);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { results: [], tmdbConfigured: true, degraded: true, error: "SEARCH_FAILED" },
      { status: 502 }
    );
  }
}
