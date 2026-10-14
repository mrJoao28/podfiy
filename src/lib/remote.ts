import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
const privateIp = (ip: string) => {
  if (ip.includes(":")) return !/^2|^3/.test(ip);
  const a = ip.split(".").map(Number);
  return (
    a[0] === 0 ||
    a[0] === 10 ||
    a[0] === 127 ||
    a[0] >= 224 ||
    (a[0] === 169 && a[1] === 254) ||
    (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && a[1] === 168) ||
    (a[0] === 100 && a[1] >= 64 && a[1] <= 127)
  );
};
export async function publicUrl(raw: string) {
  const url = new URL(raw);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("URL pública HTTP/HTTPS inválida.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true });
  if (!ips.length || ips.some((i) => privateIp(i.address)))
    throw new Error("Endereço de rede privado não permitido.");
  return url;
}
export async function fetchFeed(raw: string) {
  let url = await publicUrl(raw);
  for (let i = 0; i < 5; i++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Podfiy/1.0 RSS Reader",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento inválido.");
      url = await publicUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok)
      throw new Error(`O servidor do feed respondeu ${response.status}.`);
    if (Number(response.headers.get("content-length")) > 8e6)
      throw new Error("Feed muito grande.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Feed vazio.");
    let size = 0;
    const decoder = new TextDecoder();
    let body = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8e6) throw new Error("Feed muito grande.");
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      await reader.cancel();
    }
    return body;
  }
  throw new Error("Muitos redirecionamentos.");
}
