import { NextRequest, NextResponse } from "next/server";
import { parseFeed } from "@/lib/rss";
import { fetchFeed } from "@/lib/remote";
export const runtime = "nodejs";
const cache = new Map<
  string,
  { at: number; data: ReturnType<typeof parseFeed> }
>();
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || url.length > 2048)
    return NextResponse.json(
      { error: "Informe uma URL de feed válida." },
      { status: 400 },
    );
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 1200000) return NextResponse.json(hit.data);
  try {
    const data = parseFeed(await fetchFeed(url), url);
    if (cache.size >= 60) cache.delete(cache.keys().next().value!);
    cache.set(url, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Não foi possível ler o feed.",
      },
      { status: 422 },
    );
  }
}
