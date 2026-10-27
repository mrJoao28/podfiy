import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migrações: gravação atômica preserva versões, sessões e isolamento RLS", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth to public;
      insert into auth.users values ('${a}'),('${b}');
    `);
    for (const file of [
      "001_initial.sql",
      "002_sync_guards.sql",
      "002_sync_guards.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    const row = (payload: unknown, updated_at: string, user_id = a) => ({
      user_id,
      id: "ep",
      payload,
      updated_at,
    });
    const put = (table: string, value: unknown) =>
      db.query("select public.podfiy_upsert_rows($1,$2::jsonb)", [
        table,
        JSON.stringify([value]),
      ]);
    const newer = "2026-10-27T20:00:00Z",
      older = "2026-10-27T19:00:00Z";
    await put("episodios_progresso", row({ position: 120 }, newer));
    await put("episodios_progresso", row({ position: 30 }, older));
    await put("episodios_progresso", row({ position: 40 }, newer)); // Equal version also cannot replace.
    let result = await db.query<{ payload: { position: number } }>(
      "select payload from public.episodios_progresso",
    );
    assert.equal(result.rows[0].payload.position, 120);
    await db.query(
      `insert into public.episodios_progresso(user_id,id,payload,updated_at)
      values ($1,'ep','{"position":10}',$2) on conflict(user_id,id) do update
      set payload=excluded.payload,updated_at=excluded.updated_at`,
      [a, older],
    );
    result = await db.query("select payload from public.episodios_progresso");
    assert.equal(result.rows[0].payload.position, 120); // Older clients are guarded too.
    await put(
      "episodios_progresso",
      row({ position: 150 }, "2026-10-27T21:00:00Z"),
    );
    result = await db.query("select payload from public.episodios_progresso");
    assert.equal(result.rows[0].payload.position, 150);

    await put("favoritos", row(["new"], newer));
    await put("favoritos", row(["old"], older));
    assert.deepEqual(
      (
        await db.query<{ payload: string[] }>(
          "select payload from public.favoritos",
        )
      ).rows[0].payload,
      ["new"],
    );
    await put("sessoes_escuta", row({ seconds: 120 }, newer));
    await put("sessoes_escuta", row({ seconds: 30 }, "2026-10-27T21:00:00Z"));
    await put("sessoes_escuta", row({ seconds: 130 }, older));
    assert.equal(
      (
        await db.query<{ payload: { seconds: number } }>(
          "select payload from public.sessoes_escuta",
        )
      ).rows[0].payload.seconds,
      130,
    );

    await assert.rejects(
      put("favoritos", row([], newer, b)),
      /Account mismatch/,
    );
    await assert.rejects(
      put("auth.users", row([], newer)),
      /Invalid sync table/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal(
      (await db.query("select * from public.episodios_progresso")).rows.length,
      0,
    );
    await put("episodios_progresso", row({ position: 5 }, older, b));
    assert.equal(
      (await db.query("select * from public.episodios_progresso")).rows.length,
      1,
    );
    await db.exec("set role anon;");
    await assert.rejects(put("favoritos", row([], newer)), /permission denied/);
  } finally {
    await db.close();
  }
});
