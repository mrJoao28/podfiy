import { NextRequest, NextResponse } from "next/server";
import { parseFeed } from "@/lib/rss";
import { fetchFeed } from "@/lib/remote";
import { ClientRateLimiter, clientKey } from "@/lib/rate-limit";
const limiter = new ClientRateLimiter(60);
const pending = new Map<string, Promise<ReturnType<typeof parseFeed>>>();
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
  const quota = limiter.consume(clientKey(request.headers));
  if (!quota.allowed)
    return NextResponse.json(
      { error: "Muitas atualizações de feed. Aguarde e tente novamente." },
      {
        status: 429,
        headers: {
          "Retry-After": String(quota.retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 1200000) return NextResponse.json(hit.data);
  if (!pending.has(url) && pending.size >= 24)
    return NextResponse.json(
      { error: "Atualizações ocupadas. Tente novamente em instantes." },
      {
        status: 503,
        headers: { "Retry-After": "5", "Cache-Control": "no-store" },
      },
    );
  try {
    let task = pending.get(url);
    if (!task) {
      task = fetchFeed(url)
        .then((xml) => {
          const data = parseFeed(xml, url);
          if (cache.size >= 60) cache.delete(cache.keys().next().value!);
          cache.set(url, { at: Date.now(), data });
          return data;
        })
        .finally(() => pending.delete(url));
      pending.set(url, task);
    }
    const data = await task;
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
