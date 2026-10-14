import test from "node:test";
import assert from "node:assert/strict";
import {
  streak,
  topPodcasts,
  localDay,
  heardSeconds,
  listeningBuckets,
} from "../src/lib/stats";
import type { ListeningSession } from "../src/lib/types";
const session = (
  date: string,
  seconds = 300,
  podcastId = "a",
): ListeningSession => ({
  id: date + podcastId,
  date,
  podcastId,
  seconds,
  title: podcastId,
  image: "",
});

test("tempo ouvido ignora pausa, buffering, seek e desconta velocidade", () => {
  assert.equal(heardSeconds(null, { wall: 1000, media: 1 }, 1), 0);
  assert.equal(
    heardSeconds({ wall: 0, media: 0 }, { wall: 1000, media: 0 }, 1),
    0,
  );
  assert.equal(
    heardSeconds({ wall: 0, media: 0 }, { wall: 1000, media: 30 }, 1),
    0,
  );
  assert.equal(
    heardSeconds({ wall: 0, media: 10 }, { wall: 1000, media: 5 }, 1),
    0,
  );
  assert.equal(
    heardSeconds({ wall: 0, media: 0 }, { wall: 1000, media: 2 }, 2),
    1,
  );
});
test("horas agrupadas em semanas e meses usam o dia de Manaus", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const sessions = [
    session("2026-10-01T02:00:00Z", 60),
    session("2026-10-13T12:00:00Z", 120),
  ];
  const months = listeningBuckets(sessions, "month", now);
  assert.equal(months[11].seconds, 120);
  assert.equal(months[10].seconds, 60);
  assert.equal(listeningBuckets(sessions, "week", now)[11].seconds, 120);
});
test("sequência soma minutos no fuso Manaus e preserva ontem quando hoje está pendente", () => {
  const s = [
    session("2026-10-12T16:00:00Z", 150),
    session("2026-10-12T17:00:00Z", 150),
    session("2026-10-13T16:00:00Z"),
  ];
  assert.equal(streak(s, 300, new Date("2026-10-14T16:00:00Z")).current, 2);
  assert.equal(streak(s, 300, new Date("2026-10-16T16:00:00Z")).current, 0);
  assert.equal(streak(s).longest, 2);
  assert.equal(localDay("2026-10-14T02:00:00Z"), "2026-10-13");
});
test("meta configurável, interrupção da sequência e dia incompleto", () => {
  const s = [
    session("2026-10-10T12:00:00Z"),
    session("2026-10-12T12:00:00Z"),
    session("2026-10-13T12:00:00Z", 299),
  ];
  assert.equal(streak(s, 300, new Date("2026-10-13T18:00:00Z")).current, 1);
  assert.equal(streak(s, 60, new Date("2026-10-13T18:00:00Z")).current, 2);
  assert.equal(streak([], 300).longest, 0);
});
test("top 5 soma sessões, ordena e aplica janela temporal", () => {
  const s = Array.from({ length: 7 }, (_, i) =>
    session("2026-10-14T12:00:00Z", 100 + i, String(i)),
  );
  s.push(session("2025-01-01T12:00:00Z", 9999, "old"));
  s.push(session("2026-10-14T13:00:00Z", 1000, "6"));
  const top = topPodcasts(s, 7, new Date("2026-10-14T16:00:00Z"));
  assert.equal(top.length, 5);
  assert.equal(top[0].id, "6");
  assert.equal(top[0].seconds, 1106);
  assert.equal(topPodcasts(s)[0].id, "old");
  assert.deepEqual(topPodcasts([]), []);
});
