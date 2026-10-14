import test from "node:test";
import assert from "node:assert/strict";
import { parseDuration, parseFeed } from "../src/lib/rss";
import { streak, topPodcasts, localDay } from "../src/lib/stats";
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
test("duração RSS em três formatos e valores inválidos", () => {
  assert.equal(parseDuration("90"), 90);
  assert.equal(parseDuration("01:30"), 90);
  assert.equal(parseDuration("1:02:03"), 3723);
  assert.equal(parseDuration("oops"), 0);
  assert.equal(parseDuration(""), 0);
});
test("RSS extrai enclosure, CDATA, imagem, duração e ignora itens sem áudio", () => {
  const r = parseFeed(
    '<rss xmlns:itunes="itunes"><channel><title>Teste</title><itunes:image href="https://x.com/a.jpg"/><item><guid>x</guid><title><![CDATA[Olá & mundo]]></title><description><![CDATA[<b>Texto</b>]]></description><itunes:duration>2:30</itunes:duration><enclosure url="https://x.com/a.mp3" type="audio/mpeg"/></item><item><title>Sem áudio</title></item></channel></rss>',
    "https://x.com/rss",
  );
  assert.equal(r.episodes.length, 1);
  assert.equal(r.episodes[0].duration, 150);
  assert.equal(r.episodes[0].description, "Texto");
  assert.equal(r.episodes[0].image, "https://x.com/a.jpg");
});
test("RSS rejeita entidades e canal inválido", () => {
  assert.throws(() => parseFeed("<!DOCTYPE x><rss/>", "x"));
  assert.throws(() => parseFeed("<html/>", "x"));
});
test("sequência respeita Manaus, soma sessões e permite hoje pendente", () => {
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
test("top 5 agrega, ordena e filtra intervalo", () => {
  const s = Array.from({ length: 7 }, (_, i) =>
    session("2026-10-14T12:00:00Z", 100 + i, String(i)),
  );
  s.push(session("2025-01-01T12:00:00Z", 9999, "old"));
  const top = topPodcasts(s, 7, new Date("2026-10-14T16:00:00Z"));
  assert.equal(top.length, 5);
  assert.equal(top[0].id, "6");
  assert.equal(topPodcasts(s)[0].id, "old");
});
