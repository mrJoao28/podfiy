import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import {
  request as httpRequest,
  type IncomingMessage,
  type RequestOptions,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blocked.addSubnet(address, prefix, "ipv6");

export function isPublicAddress(ip: string) {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  // Excludes loopback, ULA, link-local, multicast and IPv4-mapped addresses.
  return (
    family === 6 && globalV6.check(ip, "ipv6") && !blocked.check(ip, "ipv6")
  );
}
type Resolver = (host: string) => Promise<LookupAddress[]>;
type Target = { url: URL; address: LookupAddress };
const resolveHost: Resolver = (host) => lookup(host, { all: true });

async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Tempo limite ao ler o feed."));
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export async function resolvePublicUrl(
  raw: string,
  resolve = resolveHost,
  signal = AbortSignal.timeout(15000),
): Promise<Target> {
  const url = new URL(raw);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("URL pública HTTP/HTTPS inválida.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(host);
  const ips = family
    ? [{ address: host, family }]
    : await abortable(resolve(host), signal);
  if (!ips.length || ips.some((ip) => !isPublicAddress(ip.address)))
    throw new Error("Endereço de rede privado ou reservado não permitido.");
  return { url, address: ips[0] };
}
export async function publicUrl(raw: string) {
  return (await resolvePublicUrl(raw)).url;
}

/** Keep the original URL/Host/TLS name, but connect only to the validated IP. */
export function pinnedLookup(address: LookupAddress): LookupFunction {
  return (_host, options, callback) => {
    if (options.all) callback(null, [address]);
    else callback(null, address.address, address.family);
  };
}
type Transport = (
  url: URL,
  options: RequestOptions & { autoSelectFamily?: boolean },
) => ReturnType<typeof httpRequest>;
const transport: Transport = (url, options) =>
  (url.protocol === "https:" ? httpsRequest : httpRequest)(url, options);
const MAX_BYTES = 8_000_000;

async function download(
  target: Target,
  signal: AbortSignal,
  send: Transport,
): Promise<{ body?: string; redirect?: string }> {
  return new Promise((resolve, reject) => {
    const req = send(target.url, {
      agent: false,
      autoSelectFamily: false,
      lookup: pinnedLookup(target.address),
      signal,
      headers: {
        "User-Agent": "Podfiy/1.0 RSS Reader",
        Accept: "application/rss+xml, application/xml, text/xml",
        "Accept-Encoding": "identity",
      },
    });
    req.once("error", reject);
    req.once("response", (response: IncomingMessage) => {
      const status = response.statusCode ?? 0;
      response.once("error", reject);
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy();
        if (!location) reject(new Error("Redirecionamento inválido."));
        else {
          try {
            resolve({ redirect: new URL(location, target.url).href });
          } catch {
            reject(new Error("Redirecionamento inválido."));
          }
        }
        return;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        reject(new Error(`O servidor do feed respondeu ${status}.`));
        return;
      }
      if (
        Number(response.headers["content-length"]) > MAX_BYTES ||
        (response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity")
      ) {
        response.destroy();
        reject(new Error("Feed muito grande ou compactação não suportada."));
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          response.destroy();
          reject(new Error("Feed muito grande."));
        } else chunks.push(chunk);
      });
      response.once("end", () =>
        resolve({ body: Buffer.concat(chunks).toString("utf8") }),
      );
      response.once("aborted", () =>
        reject(new Error("A conexão do feed foi interrompida.")),
      );
    });
    req.end();
  });
}

export function createFeedFetcher(resolve = resolveHost, send = transport) {
  return async (raw: string) => {
    const signal = AbortSignal.timeout(15000); // One budget including DNS, redirects and body.
    let url = raw;
    for (let i = 0; i < 5; i++) {
      const target = await resolvePublicUrl(url, resolve, signal);
      const result = await download(target, signal, send);
      if (result.redirect) {
        url = result.redirect;
        continue;
      }
      return result.body ?? "";
    }
    throw new Error("Muitos redirecionamentos.");
  };
}
export const fetchFeed = createFeedFetcher();
