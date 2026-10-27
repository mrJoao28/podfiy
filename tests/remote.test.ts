import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ClientRequest, IncomingMessage } from "node:http";
import {
  createFeedFetcher,
  isPublicAddress,
  pinnedLookup,
  resolvePublicUrl,
} from "../src/lib/remote";

type Transport = NonNullable<Parameters<typeof createFeedFetcher>[1]>;
type Reply = {
  status?: number;
  location?: string;
  body?: string;
  length?: string;
  encoding?: string;
};
function fakeTransport(
  replies: Reply[],
  inspect?: (url: URL, options: Parameters<Transport>[1]) => void,
): Transport {
  return (url, options) => {
    inspect?.(url, options);
    const req = new EventEmitter() as ClientRequest;
    req.end = (() => {
      queueMicrotask(() => {
        const reply = replies.shift() ?? {};
        const body = new PassThrough();
        const response = body as unknown as IncomingMessage;
        response.statusCode = reply.status ?? 200;
        response.headers = {
          location: reply.location,
          "content-length": reply.length,
          "content-encoding": reply.encoding,
        };
        req.emit("response", response);
        if (!response.destroyed) body.end(reply.body ?? "<rss/>");
      });
      return req;
    }) as ClientRequest["end"];
    return req;
  };
}
const publicDns = async () => [{ address: "8.8.8.8", family: 4 }];

test("RSS rejeita IPs privados, reservados, mapeados, credenciais e portas arbitrárias", async () => {
  for (const address of [
    "127.0.0.1",
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "192.0.2.1",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002:7f00:1::",
    "3fff::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  for (const raw of [
    "file:///etc/passwd",
    "http://user:pass@example.com/rss",
    "https://example.com:8080/rss",
    "http://2130706433",
    "http://[::ffff:127.0.0.1]/",
  ])
    await assert.rejects(resolvePublicUrl(raw, publicDns));
  await assert.rejects(
    resolvePublicUrl("https://example.com", async () => [
      ...(await publicDns()),
      { address: "10.0.0.1", family: 4 },
    ]),
  );
});

test("conexão fixa o IP aprovado sem uma segunda consulta DNS e mantém Host/TLS original", async () => {
  let resolutions = 0;
  const fetch = createFeedFetcher(
    async () => {
      resolutions++;
      return resolutions === 1
        ? await publicDns()
        : [{ address: "127.0.0.1", family: 4 }];
    },
    fakeTransport([{ body: "<rss>ok</rss>" }], (url, options) => {
      assert.equal(url.hostname, "podcast.example.com");
      assert.equal(options.agent, false);
      options.lookup!(url.hostname, {}, (error, ip, family) => {
        assert.equal(error, null);
        assert.equal(ip, "8.8.8.8");
        assert.equal(family, 4);
      });
    }),
  );
  assert.equal(
    await fetch("https://podcast.example.com/feed"),
    "<rss>ok</rss>",
  );
  assert.equal(resolutions, 1);
  pinnedLookup({ address: "8.8.8.8", family: 4 })(
    "host",
    { all: true },
    (_error, values) => {
      assert.deepEqual(values, [{ address: "8.8.8.8", family: 4 }]);
    },
  );
});

test("RSS revalida redirecionamentos e impede redirecionamento para rede interna", async () => {
  let connections = 0;
  const fetch = createFeedFetcher(
    publicDns,
    fakeTransport(
      [{ status: 302, location: "http://169.254.169.254/latest" }],
      () => {
        connections++;
      },
    ),
  );
  await assert.rejects(
    fetch("https://example.com/rss"),
    /privado ou reservado/,
  );
  assert.equal(connections, 1);
  const invalid = createFeedFetcher(
    publicDns,
    fakeTransport([{ status: 302, location: "http://[invalid" }]),
  );
  await assert.rejects(
    invalid("https://example.com/rss"),
    /Redirecionamento inválido/,
  );
});

test("RSS limita bytes do cabeçalho e do corpo e limita cadeia de redirects", async () => {
  await assert.rejects(
    createFeedFetcher(
      publicDns,
      fakeTransport([{ length: "8000001" }]),
    )("https://example.com"),
    /grande/,
  );
  await assert.rejects(
    createFeedFetcher(
      publicDns,
      fakeTransport([{ body: "x".repeat(8_000_001) }]),
    )("https://example.com"),
    /grande/,
  );
  const replies = Array.from({ length: 5 }, () => ({
    status: 302,
    location: "/again",
  }));
  await assert.rejects(
    createFeedFetcher(publicDns, fakeTransport(replies))("https://example.com"),
    /Muitos redirecionamentos/,
  );
  await assert.rejects(
    resolvePublicUrl("https://example.com", publicDns, AbortSignal.abort()),
  );
});
