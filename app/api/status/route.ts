import { NextResponse } from "next/server";
import { awardDatasetSize } from "@/lib/awards";
import { isImdbConfigured } from "@/lib/imdb";
import { isTmdbConfigured } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports which data sources are available, so the UI can degrade cleanly. */
export async function GET() {
  return NextResponse.json({
    tmdbConfigured: isTmdbConfigured(),
    imdbConfigured: isImdbConfigured(),
    awardDatasetSize: awardDatasetSize(),
  });
}
