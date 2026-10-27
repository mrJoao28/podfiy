import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as search } from "../src/app/api/search/route";
import { GET as feed } from "../src/app/api/feed/route";

test("APIs aplicam 429 por cliente e não compartilham cota de busca ou feed", async () => {
  const previousVercel = process.env.VERCEL;
  const previousFetch = globalThis.fetch;
  process.env.VERCEL = "1";
  globalThis.fetch = async () => Response.json({ results: [] });
  const request = (route: string, ip: string) =>
    new NextRequest(`https://podfiy.test/api/${route}`, {
      headers: { "x-vercel-forwarded-for": ip },
    });
  try {
    for (let i = 0; i < 18; i++)
      assert.equal(
        (await search(request("search?q=quota", "8.8.8.8"))).status,
        200,
      );
    const blocked = await search(request("search?q=quota", "8.8.8.8"));
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
    assert.equal(
      (await search(request("search?q=quota", "1.1.1.1"))).status,
      200,
    );
    for (let i = 0; i < 60; i++)
      assert.equal(
        (await feed(request("feed?url=http://127.0.0.1/rss", "8.8.8.8")))
          .status,
        422,
      );
    const feedBlocked = await feed(
      request("feed?url=http://127.0.0.1/rss", "8.8.8.8"),
    );
    assert.equal(feedBlocked.status, 429);
    assert.ok(Number(feedBlocked.headers.get("Retry-After")) > 0);
    assert.equal(
      (await feed(request("feed?url=http://127.0.0.1/rss", "1.1.1.1"))).status,
      422,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
});
