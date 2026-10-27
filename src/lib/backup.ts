import { collectionKeys, mergeLibraries } from "./library-merge";
import type {
  CollectionKey,
  Episode,
  Library,
  ListeningSession,
  Podcast,
  Progress,
} from "./types";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const invalid = () =>
  new Error("Backup inválido. Escolha um arquivo exportado pelo Podfiy.");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 16384): string {
  if (typeof value !== "string" || value.length > max) throw invalid();
  return value;
}
function id(value: unknown): string {
  const result = text(value);
  if (!result || ["__proto__", "constructor", "prototype"].includes(result))
    throw invalid();
  return result;
}
function number(value: unknown, min = 0, max = 1e12): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw invalid();
  return value;
}
function date(value: unknown, empty = false) {
  const result = text(value, 100);
  if (empty && result === "") return result;
  if (!Number.isFinite(Date.parse(result))) throw invalid();
  return new Date(result).toISOString();
}
function url(value: unknown, empty = false) {
  const result = text(value);
  if (empty && result === "") return result;
  try {
    const parsed = new URL(result);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw invalid();
  } catch {
    throw invalid();
  }
  return result;
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 20000) throw invalid();
  return value.map(parse);
}
function podcast(value: unknown): Podcast {
  const item = object(value);
  return {
    id: id(item.id),
    feed: url(item.feed),
    title: text(item.title),
    author: text(item.author),
    image: url(item.image, true),
    ...(item.description === undefined
      ? {}
      : { description: text(item.description, 200000) }),
  };
}
function episode(value: unknown): Episode {
  const item = object(value);
  return {
    id: id(item.id),
    podcastId: id(item.podcastId),
    podcastTitle: text(item.podcastTitle),
    feed: url(item.feed),
    title: text(item.title),
    description: text(item.description, 200000),
    date: date(item.date, true),
    duration: number(item.duration),
    image: url(item.image, true),
    audio: url(item.audio),
  };
}
function session(value: unknown): ListeningSession {
  const item = object(value);
  return {
    id: id(item.id),
    date: date(item.date),
    podcastId: id(item.podcastId),
    title: text(item.title),
    image: url(item.image, true),
    seconds: number(item.seconds),
  };
}

export function parseBackup(raw: string): Library {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error("O backup deve ter até 10 MB.");
  let value: Record<string, unknown>;
  try {
    value = object(JSON.parse(raw));
  } catch {
    throw invalid();
  }
  if ("format" in value) {
    if (value.format !== "podfiy-library" || value.version !== 1)
      throw new Error("Versão de backup não suportada.");
    value = object(value.library);
  }
  const settings = object(value.settings);
  const entries = Object.entries(object(value.progress));
  if (entries.length > 20000) throw invalid();
  const progress = Object.fromEntries(
    entries.map(([key, value]) => {
      const item = object(value);
      const e = episode(item.episode);
      if (id(key) !== e.id || typeof item.listened !== "boolean")
        throw invalid();
      return [
        key,
        {
          episode: e,
          listened: item.listened,
          position: number(item.position),
          updatedAt: date(item.updatedAt),
        } satisfies Progress,
      ];
    }),
  );
  const dates: Partial<Record<CollectionKey, string>> = {};
  if (value.collectionDates !== undefined) {
    const source = object(value.collectionDates);
    for (const key of collectionKeys)
      if (source[key] !== undefined) dates[key] = date(source[key]);
  }
  return {
    subscriptions: list(value.subscriptions, podcast),
    favorites: list(value.favorites, (item) =>
      "audio" in object(item) ? episode(item) : podcast(item),
    ),
    queue: list(value.queue, episode),
    history: list(value.history, episode),
    sessions: list(value.sessions, session),
    progress,
    collectionDates: dates,
    settings: {
      dailyGoal: number(settings.dailyGoal, 60, 86400),
      speed: number(settings.speed, 0.25, 4),
    },
  };
}

const unique = <T>(items: T[], key: (item: T) => string) => [
  ...new Map(items.map((item) => [key(item), item])).values(),
];
export function mergeBackup(local: Library, backup: Library): Library {
  const merged = mergeLibraries(local, backup);
  return {
    ...merged,
    subscriptions: unique(
      [...backup.subscriptions, ...local.subscriptions],
      (p) => p.feed,
    ),
    favorites: unique([...backup.favorites, ...local.favorites], (p) =>
      "audio" in p ? `episode:${p.id}` : `podcast:${p.feed}`,
    ),
    queue: unique([...local.queue, ...backup.queue], (e) => e.id),
    history: unique([...local.history, ...backup.history], (e) => e.id).slice(
      0,
      200,
    ),
    settings: backup.settings,
    // Import is an explicit new local edit, stamped by the provider.
    collectionDates: local.collectionDates,
  };
}
export function serializeBackup(library: Library): string {
  return JSON.stringify(
    { format: "podfiy-library", version: 1, library },
    null,
    2,
  );
}
