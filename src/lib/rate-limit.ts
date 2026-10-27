import { createHash } from "node:crypto";
import { isIP } from "node:net";

/** Trust forwarding headers only from a deployment-controlled proxy. */
export function clientKey(
  headers: Headers,
  environment: { VERCEL?: string; TRUST_PROXY?: string } = {
    VERCEL: process.env.VERCEL,
    TRUST_PROXY: process.env.TRUST_PROXY,
  },
) {
  const header =
    environment.VERCEL === "1"
      ? headers.get("x-vercel-forwarded-for")
      : environment.TRUST_PROXY === "true"
        ? headers.get("x-forwarded-for")
        : null;
  const address = header?.split(",")[0]?.trim();
  return createHash("sha256")
    .update(address && isIP(address) ? address : "direct-local-client")
    .digest("hex");
}

export class ClientRateLimiter {
  private buckets = new Map<string, { count: number; reset: number }>();
  constructor(
    private limit: number,
    private windowMs = 60_000,
    private maxClients = 5000,
  ) {}
  consume(
    key: string,
    now = Date.now(),
  ): { allowed: boolean; retryAfter: number } {
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.reset) {
      if (!bucket && this.buckets.size >= this.maxClients) {
        for (const [id, value] of this.buckets)
          if (now >= value.reset) this.buckets.delete(id);
        // Do not evict active clients: eviction would let a caller reset a quota.
        if (this.buckets.size >= this.maxClients)
          return {
            allowed: false,
            retryAfter: Math.ceil(this.windowMs / 1000),
          };
      }
      bucket = { count: 0, reset: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    const retryAfter = Math.max(1, Math.ceil((bucket.reset - now) / 1000));
    if (bucket.count >= this.limit) return { allowed: false, retryAfter };
    bucket.count++;
    return { allowed: true, retryAfter: 0 };
  }
}
