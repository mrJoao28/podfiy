import { emptyLibrary, type Episode, type Library } from "../src/lib/types";
export const makeLibrary = (): Library => structuredClone(emptyLibrary);
export const episode: Episode = {
  id: "ep",
  podcastId: "https://example.com/rss",
  podcastTitle: "Podcast",
  title: "Episódio",
  description: "",
  feed: "https://example.com/rss",
  image: "",
  audio: "https://example.com/audio.mp3",
  date: "2026-10-27T12:00:00.000Z",
  duration: 600,
};
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
