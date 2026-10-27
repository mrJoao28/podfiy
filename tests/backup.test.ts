import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BACKUP_BYTES,
  parseBackup,
  serializeBackup,
  mergeBackup,
} from "../src/lib/backup";
import { episode, makeLibrary } from "./fixtures";

test("backup novo e JSON antigo são restauráveis e descartam campos desconhecidos", () => {
  const state = makeLibrary();
  state.queue = [episode];
  state.progress.ep = {
    episode,
    position: 20,
    listened: false,
    updatedAt: episode.date,
  };
  assert.deepEqual(parseBackup(serializeBackup(state)).queue, [episode]);
  assert.deepEqual(parseBackup(JSON.stringify(state)).progress, state.progress);
  assert.equal(
    "unexpected" in parseBackup(JSON.stringify({ ...state, unexpected: 123 })),
    false,
  );
});
test("importação preserva itens locais, elimina duplicatas e mantém progresso mais recente", () => {
  const local = makeLibrary(),
    backup = makeLibrary();
  local.queue = [episode];
  backup.queue = [episode, { ...episode, id: "ep2" }];
  local.favorites = [episode];
  local.progress.ep = {
    episode,
    position: 120,
    listened: false,
    updatedAt: "2026-10-27T20:00:00Z",
  };
  backup.progress.ep = {
    ...local.progress.ep,
    position: 30,
    updatedAt: "2026-10-27T19:00:00Z",
  };
  backup.settings.speed = 1.5;
  const result = mergeBackup(local, backup);
  assert.deepEqual(
    result.queue.map((e) => e.id),
    ["ep", "ep2"],
  );
  assert.deepEqual(result.favorites, [episode]);
  assert.equal(result.progress.ep.position, 120);
  assert.equal(result.settings.speed, 1.5);
  assert.equal(result.collectionDates, local.collectionDates);
});
test("backup inválido, versão futura, números inválidos e arquivos grandes são rejeitados", () => {
  for (const raw of [
    "no JSON",
    "null",
    "[]",
    "{}",
    '{"format":"podfiy-library","version":2}',
  ])
    assert.throws(() => parseBackup(raw));
  const state = makeLibrary();
  state.settings.speed = -1;
  assert.throws(() => parseBackup(JSON.stringify(state)));
  state.settings.speed = 1;
  state.queue = [{ ...episode, audio: "javascript:alert(1)" }];
  assert.throws(() => parseBackup(JSON.stringify(state)));
  assert.throws(() => parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)), /10 MB/);
});
