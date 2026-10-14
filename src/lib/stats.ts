import type { ListeningSession } from "./types";
export type AudioSample = { wall: number; media: number };
export function heardSeconds(
  previous: AudioSample | null,
  current: AudioSample,
  rate: number,
) {
  if (!previous || rate <= 0) return 0;
  const wall = (current.wall - previous.wall) / 1000;
  const media = current.media - previous.media;
  return wall > 0 && media > 0 && media <= wall * rate + 0.6
    ? Math.min(wall, media / rate)
    : 0;
}
export function listeningBuckets(
  sessions: ListeningSession[],
  period: "week" | "month",
  now = new Date(),
) {
  const today = localDay(now);
  const first = new Date(today + "T12:00:00Z");
  if (period === "week")
    first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  else first.setUTCDate(1);
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(first);
    if (period === "week")
      start.setUTCDate(start.getUTCDate() - (11 - index) * 7);
    else start.setUTCMonth(start.getUTCMonth() - (11 - index));
    const end = new Date(start);
    if (period === "week") end.setUTCDate(end.getUTCDate() + 7);
    else end.setUTCMonth(end.getUTCMonth() + 1);
    const from = start.toISOString().slice(0, 10),
      to = end.toISOString().slice(0, 10);
    return {
      label: start.toLocaleDateString("pt-BR", {
        timeZone: "UTC",
        ...(period === "week"
          ? ({ day: "2-digit", month: "2-digit" } as const)
          : ({ month: "short", year: "2-digit" } as const)),
      }),
      seconds: sessions
        .filter((session) => {
          const day = localDay(session.date);
          return day >= from && day < to;
        })
        .reduce((sum, session) => sum + session.seconds, 0),
    };
  });
}
export const localDay = (date: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
export function dayOffset(day: string, offset: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function streak(
  sessions: ListeningSession[],
  goal = 300,
  now = new Date(),
) {
  const days: Record<string, number> = {};
  for (const s of sessions) {
    const d = localDay(s.date);
    days[d] = (days[d] ?? 0) + s.seconds;
  }
  const active = Object.keys(days)
    .filter((d) => days[d] >= goal)
    .sort();
  let longest = 0,
    run = 0,
    prev = "";
  for (const day of active) {
    run = prev && dayOffset(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  let today = localDay(now);
  if (!active.includes(today)) today = dayOffset(today, -1);
  let current = 0;
  while (active.includes(today)) {
    current++;
    today = dayOffset(today, -1);
  }
  return { current, longest, days };
}
export function topPodcasts(
  sessions: ListeningSession[],
  days = 0,
  now = new Date(),
) {
  const cutoff = days ? now.getTime() - days * 86400000 : 0;
  const map = new Map<
    string,
    { id: string; title: string; image: string; seconds: number }
  >();
  for (const s of sessions) {
    if (new Date(s.date).getTime() < cutoff || s.seconds <= 0) continue;
    const p = map.get(s.podcastId) ?? {
      id: s.podcastId,
      title: s.title,
      image: s.image,
      seconds: 0,
    };
    p.seconds += s.seconds;
    map.set(p.id, p);
  }
  return [...map.values()]
    .sort((a, b) => b.seconds - a.seconds || a.title.localeCompare(b.title))
    .slice(0, 5);
}
export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
