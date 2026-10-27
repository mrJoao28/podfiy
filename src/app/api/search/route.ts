import { NextRequest, NextResponse } from "next/server";
import { ClientRateLimiter, clientKey } from "@/lib/rate-limit";
export const runtime = "nodejs";
const limiter = new ClientRateLimiter(18);
const cache = new Map<string, { at: number; data: unknown }>();
export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("q")?.trim().slice(0, 150);
  if (!term) return NextResponse.json({ podcasts: [] });
  const quota = limiter.consume(clientKey(request.headers));
  if (!quota.allowed)
    return NextResponse.json(
      { error: "Muitas buscas neste dispositivo. Aguarde e tente novamente." },
      {
        status: 429,
        headers: {
          "Retry-After": String(quota.retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  const key = term.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 1800000) return NextResponse.json(hit.data);
  try {
    const url = new URL("https://itunes.apple.com/search");
    url.search = new URLSearchParams({
      media: "podcast",
      entity: "podcast",
      term,
      country: "BR",
      limit: "25",
    }).toString();
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok)
      return NextResponse.json(
        {
          error: [403, 429].includes(r.status)
            ? "O catálogo limitou as buscas. Aguarde um minuto e tente novamente."
            : "Catálogo indisponível.",
        },
        { status: [403, 429].includes(r.status) ? 429 : 502 },
      );
    const data = await r.json();
    const podcasts = (data.results ?? [])
      .filter((p: Record<string, unknown>) => p.feedUrl)
      .map((p: Record<string, unknown>) => ({
        id: String(p.collectionId),
        title: p.collectionName,
        author: p.artistName,
        image: p.artworkUrl600,
        feed: p.feedUrl,
      }));
    const result = { podcasts };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), data: result });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível buscar. Verifique a conexão." },
      { status: 502 },
    );
  }
}
