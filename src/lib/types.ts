export type Podcast = {
  id: string;
  title: string;
  author: string;
  image: string;
  feed: string;
  description?: string;
};
export type Episode = {
  id: string;
  podcastId: string;
  podcastTitle: string;
  title: string;
  description: string;
  date: string;
  duration: number;
  image: string;
  audio: string;
  feed: string;
};
export type Progress = {
  episode: Episode;
  position: number;
  listened: boolean;
  updatedAt: string;
};
export type ListeningSession = {
  id: string;
  date: string;
  podcastId: string;
  title: string;
  image: string;
  seconds: number;
};
export type CollectionKey =
  "subscriptions" | "favorites" | "queue" | "history" | "settings";
export type Library = {
  subscriptions: Podcast[];
  progress: Record<string, Progress>;
  favorites: (Podcast | Episode)[];
  queue: Episode[];
  history: Episode[];
  sessions: ListeningSession[];
  settings: { dailyGoal: number; speed: number };
  collectionDates?: Partial<Record<CollectionKey, string>>;
};
export const emptyLibrary: Library = {
  subscriptions: [],
  progress: {},
  favorites: [],
  queue: [],
  history: [],
  sessions: [],
  settings: { dailyGoal: 300, speed: 1 },
};
