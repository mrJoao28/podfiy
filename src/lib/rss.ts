import { XMLParser } from "fast-xml-parser";
import type { Episode, Podcast } from "./types";
export function parseDuration(value: unknown): number {
  const parts = String(value ?? "")
    .trim()
    .split(":");
  if (!parts.every((p) => /^\d+(\.\d+)?$/.test(p))) return 0;
  if (parts.length > 3) return 0;
  return Math.floor(parts.reduce((n, p) => n * 60 + Number(p), 0));
}
export function plain(value: unknown): string {
  const s =
    typeof value === "object" && value
      ? String((value as Record<string, unknown>)["#text"] ?? "")
      : String(value ?? "");
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
export function parseFeed(
  xml: string,
  feed: string,
): { podcast: Podcast; episodes: Episode[] } {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("Feed contém declaração XML não permitida.");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false,
  }).parse(xml);
  const channel = parsed.rss?.channel;
  if (!channel) throw new Error("RSS inválido: canal não encontrado.");
  const image = channel["itunes:image"]?.["@_href"] ?? channel.image?.url ?? "";
  const podcast: Podcast = {
    id: feed,
    feed,
    title: plain(channel.title),
    author: plain(channel["itunes:author"] ?? channel.author),
    image,
    description: plain(channel.description),
  };
  const items = channel.item
    ? Array.isArray(channel.item)
      ? channel.item
      : [channel.item]
    : [];
  const episodes: Episode[] = items.flatMap((item: Record<string, any>) => {
    const enclosures = Array.isArray(item.enclosure)
      ? item.enclosure
      : [item.enclosure];
    const audio = enclosures.find(
      (e: Record<string, string> | undefined) =>
        e?.["@_url"] && (!e["@_type"] || e["@_type"].startsWith("audio/")),
    )?.["@_url"];
    if (!audio || !/^https?:\/\//i.test(audio)) return [];
    const date = new Date(item.pubDate);
    return [
      {
        id: `${feed}#${plain(item.guid) || audio}`,
        podcastId: feed,
        podcastTitle: podcast.title,
        feed,
        title: plain(item.title) || "Sem título",
        description: plain(item["content:encoded"] ?? item.description),
        date: Number.isNaN(date.getTime()) ? "" : date.toISOString(),
        duration: parseDuration(item["itunes:duration"]),
        image: item["itunes:image"]?.["@_href"] ?? image,
        audio,
      },
    ];
  });
  return {
    podcast,
    episodes: episodes.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
