import test from "node:test";
import assert from "node:assert/strict";
import { ClientRateLimiter, clientKey } from "../src/lib/rate-limit";

test("cota é por cliente, expira e retorna Retry-After sem bloquear outro cliente", () => {
  const limit = new ClientRateLimiter(2, 60000);
  assert.equal(limit.consume("a", 0).allowed, true);
  assert.equal(limit.consume("a", 1000).allowed, true);
  assert.deepEqual(limit.consume("a", 1000), {
    allowed: false,
    retryAfter: 59,
  });
  assert.equal(limit.consume("b", 1000).allowed, true);
  assert.equal(limit.consume("a", 60000).allowed, true);
});
test("limitador limita memória sem expulsar cotas ativas", () => {
  const limit = new ClientRateLimiter(1, 1000, 1);
  limit.consume("a", 0);
  assert.equal(limit.consume("b", 1).allowed, false);
  assert.equal(limit.consume("a", 2).allowed, false);
  assert.equal(limit.consume("b", 1000).allowed, true);
});
test("identidade ignora cabeçalhos falsificados fora de proxy confiável", () => {
  const a = new Headers({
    "x-forwarded-for": "8.8.8.8",
    "x-vercel-forwarded-for": "1.1.1.1",
  });
  const b = new Headers({
    "x-forwarded-for": "9.9.9.9",
    "x-vercel-forwarded-for": "8.8.4.4",
  });
  assert.equal(clientKey(a, {}), clientKey(b, {}));
  assert.notEqual(clientKey(a, { VERCEL: "1" }), clientKey(b, { VERCEL: "1" }));
  assert.notEqual(
    clientKey(a, { TRUST_PROXY: "true" }),
    clientKey(b, { TRUST_PROXY: "true" }),
  );
  assert.match(clientKey(a, { VERCEL: "1" }), /^[a-f0-9]{64}$/);
});
