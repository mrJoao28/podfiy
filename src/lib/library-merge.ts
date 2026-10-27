import type { CollectionKey, Library } from "./types";

export const collectionKeys: CollectionKey[] = [
  "subscriptions",
  "favorites",
  "queue",
  "history",
  "settings",
];

/** Merge against the latest state, including edits made while the network waited. */
export function mergeLibraries(local: Library, remote: Library): Library {
  const result: Library = {
    ...local,
    progress: { ...local.progress },
    collectionDates: { ...local.collectionDates },
  };
  for (const [id, progress] of Object.entries(remote.progress)) {
    if (
      !result.progress[id] ||
      Date.parse(progress.updatedAt) > Date.parse(result.progress[id].updatedAt)
    )
      result.progress[id] = progress;
  }
  for (const key of collectionKeys) {
    if (
      Date.parse(remote.collectionDates?.[key] ?? "") >
      (Date.parse(local.collectionDates?.[key] ?? "") || 0)
    ) {
      Object.assign(result, { [key]: remote[key] });
      result.collectionDates![key] = remote.collectionDates![key];
    }
  }
  const sessions = new Map(local.sessions.map((s) => [s.id, s]));
  for (const session of remote.sessions) {
    if (
      !sessions.has(session.id) ||
      session.seconds > sessions.get(session.id)!.seconds
    )
      sessions.set(session.id, session);
  }
  result.sessions = [...sessions.values()];
  return result;
}

/** Edits made after a pull started are newer actions even if device clocks differ. */
export function mergeAfterPull(
  base: Library,
  local: Library,
  remote: Library,
): Library {
  const result = mergeLibraries(local, remote);
  for (const key of collectionKeys) {
    if (local[key] !== base[key]) {
      Object.assign(result, { [key]: local[key] });
      result.collectionDates![key] = new Date(
        Math.max(
          Date.parse(local.collectionDates?.[key] ?? "") || 0,
          (Date.parse(remote.collectionDates?.[key] ?? "") || 0) + 1,
        ),
      ).toISOString();
    }
  }
  for (const [id, progress] of Object.entries(local.progress)) {
    if (progress !== base.progress[id]) {
      const remoteVersion =
        Date.parse(remote.progress[id]?.updatedAt ?? "") || 0;
      result.progress[id] = {
        ...progress,
        updatedAt: new Date(
          Math.max(Date.parse(progress.updatedAt), remoteVersion + 1),
        ).toISOString(),
      };
    }
  }
  return result;
}

export function stampLibraryChange(previous: Library, next: Library): Library {
  const dates = { ...next.collectionDates };
  for (const key of collectionKeys) {
    if (
      next[key] !== previous[key] &&
      next.collectionDates === previous.collectionDates
    ) {
      // Consecutive edits in the same millisecond must still have distinct versions.
      dates[key] = new Date(
        Math.max(Date.now(), (Date.parse(dates[key] ?? "") || 0) + 1),
      ).toISOString();
    }
  }
  const progress = { ...next.progress };
  for (const [id, value] of Object.entries(progress)) {
    const old = previous.progress[id];
    if (
      old &&
      old !== value &&
      Date.parse(value.updatedAt) <= Date.parse(old.updatedAt)
    )
      progress[id] = {
        ...value,
        updatedAt: new Date(Date.parse(old.updatedAt) + 1).toISOString(),
      };
  }
  return { ...next, progress, collectionDates: dates };
}
