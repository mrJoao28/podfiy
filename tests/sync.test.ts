import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRemoteSync } from "../src/lib/sync";
import {
  mergeAfterPull,
  mergeLibraries,
  stampLibraryChange,
} from "../src/lib/library-merge";
import { SyncCoordinator } from "../src/lib/sync-coordinator";
import { deferred, episode, makeLibrary } from "./fixtures";
import type { Library } from "../src/lib/types";

test("merge mantém progresso e sessões mais recentes e coleções editadas durante o pull", () => {
  const local = makeLibrary(),
    remote = makeLibrary();
  local.progress.ep = {
    episode,
    position: 120,
    listened: false,
    updatedAt: "2026-10-27T20:00:00Z",
  };
  remote.progress.ep = {
    ...local.progress.ep,
    position: 30,
    updatedAt: "2026-10-27T19:00:00Z",
  };
  local.favorites = [episode];
  local.collectionDates = { favorites: "2026-10-27T20:00:00Z" };
  remote.collectionDates = { favorites: "2026-10-27T19:00:00Z" };
  const s = {
    id: "session",
    date: episode.date,
    podcastId: episode.podcastId,
    title: "Podcast",
    image: "",
    seconds: 120,
  };
  local.sessions = [s];
  remote.sessions = [{ ...s, seconds: 30 }];
  const result = mergeLibraries(local, remote);
  assert.equal(result.progress.ep.position, 120);
  assert.deepEqual(result.favorites, [episode]);
  assert.equal(result.sessions[0].seconds, 120);
});

test("versões de edições consecutivas são estritamente crescentes", () => {
  const before = makeLibrary();
  before.collectionDates = { queue: new Date(Date.now() + 1000).toISOString() };
  before.progress.ep = {
    episode,
    position: 1,
    listened: false,
    updatedAt: "2026-10-27T20:00:00Z",
  };
  const next = stampLibraryChange(before, {
    ...before,
    queue: [episode],
    progress: { ep: { ...before.progress.ep, listened: true } },
  });
  assert.ok(
    Date.parse(next.collectionDates!.queue!) >
      Date.parse(before.collectionDates.queue!),
  );
  assert.ok(
    Date.parse(next.progress.ep.updatedAt) >
      Date.parse(before.progress.ep.updatedAt),
  );
});

test("edições durante o pull sobrevivem a relógio remoto adiantado", () => {
  const base = makeLibrary(),
    remote = makeLibrary();
  remote.collectionDates = { favorites: "2090-01-01T00:00:00Z" };
  remote.progress.ep = {
    episode,
    position: 40,
    listened: false,
    updatedAt: "2090-01-01T00:00:00Z",
  };
  const local = stampLibraryChange(base, {
    ...base,
    favorites: [episode],
    progress: {
      ep: { episode, position: 120, listened: true, updatedAt: episode.date },
    },
  });
  const merged = mergeAfterPull(base, local, remote);
  assert.deepEqual(merged.favorites, [episode]);
  assert.equal(merged.progress.ep.position, 120);
  assert.ok(
    Date.parse(merged.progress.ep.updatedAt) >
      Date.parse(remote.progress.ep.updatedAt),
  );
  assert.ok(
    Date.parse(merged.collectionDates!.favorites!) >
      Date.parse(remote.collectionDates.favorites!),
  );
});

test("sync combina o pull com edições atuais e envia novamente edições durante o push", async () => {
  let current = makeLibrary();
  const remote = deferred<Library>(),
    writing = deferred<void>();
  const pushed: Library[] = [];
  const sync = new SyncCoordinator({
    current: () => current,
    apply: (next) => {
      current = next;
    },
    pull: () => remote.promise,
    push: async (_user, state) => {
      pushed.push(state);
      if (pushed.length === 1) await writing.promise;
    },
  });
  sync.activate("a");
  const job = sync.run();
  current = stampLibraryChange(current, { ...current, favorites: [episode] });
  remote.resolve(makeLibrary());
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(current.favorites, [episode]);
  current = stampLibraryChange(current, { ...current, queue: [episode] });
  assert.equal(sync.run(false), job);
  writing.resolve();
  await job;
  assert.equal(pushed.length, 2);
  assert.deepEqual(pushed[1].queue, [episode]);
});

test("troca de conta invalida pull anterior e permite sync da nova conta imediatamente", async () => {
  let current = makeLibrary();
  const old = deferred<Library>();
  const pushed: string[] = [];
  const sync = new SyncCoordinator({
    current: () => current,
    apply: (next) => {
      current = next;
    },
    pull: (account) =>
      account === "a" ? old.promise : Promise.resolve(makeLibrary()),
    push: async (account) => {
      pushed.push(account);
    },
  });
  sync.activate("a");
  const job = sync.run();
  sync.activate("b");
  await sync.run();
  const stale = makeLibrary();
  stale.favorites = [episode];
  old.resolve(stale);
  await job;
  assert.deepEqual(current.favorites, []);
  assert.deepEqual(pushed, ["b"]);
});

test("erros de operações invalidadas não vazam para a nova conta", async () => {
  const old = deferred<Library>();
  const sync = new SyncCoordinator({
    current: makeLibrary,
    apply: () => {},
    pull: () => old.promise,
    push: async () => {},
  });
  sync.activate("a");
  const job = sync.run();
  sync.activate(null);
  old.reject(new Error("Erro da conta antiga"));
  await assert.doesNotReject(job);
});

test("push usa apenas RPC protegida, deduplica versões e interrompe lotes invalidados", async () => {
  const calls: { p_table: string; p_rows: unknown[] }[] = [];
  let active = true;
  const client = {
    rpc: async (name: string, args: { p_table: string; p_rows: unknown[] }) => {
      assert.equal(name, "podfiy_upsert_rows");
      calls.push(args);
      return { error: null };
    },
  } as unknown as SupabaseClient;
  const remote = createRemoteSync(client);
  const state = makeLibrary();
  await remote.pushRemote("a", state);
  assert.equal(calls.length, 5);
  await remote.pushRemote("a", state);
  assert.equal(calls.length, 5);
  state.collectionDates = { favorites: "2026-10-27T20:00:00Z" };
  await remote.pushRemote("a", state);
  assert.equal(calls.length, 6); // Same payload, different version is sent.
  const cancelling = createRemoteSync({
    rpc: async () => {
      active = false;
      return { error: null };
    },
  } as unknown as SupabaseClient);
  await cancelling.pushRemote("a", makeLibrary(), () => active);
  assert.equal(active, false);
});

test("migração ausente falha sem fallback para upsert inseguro", async () => {
  const remote = createRemoteSync({
    rpc: async () => ({ error: { code: "PGRST202" } }),
  } as unknown as SupabaseClient);
  await assert.rejects(
    remote.pushRemote("a", makeLibrary()),
    /002_sync_guards/,
  );
});
