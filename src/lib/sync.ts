import { supabase } from "./supabase";
import type { CollectionKey, Library, ListeningSession } from "./types";

const tables = [
  "podcasts_assinados",
  "episodios_progresso",
  "favoritos",
  "fila",
  "historico",
  "sessoes_escuta",
  "configuracoes",
] as const;
type RemoteRow = { id: string; payload: unknown; updated_at: string };
const collections: Partial<Record<number, CollectionKey>> = {
  0: "subscriptions",
  2: "favorites",
  3: "queue",
  4: "history",
  6: "settings",
};
// Avoid retransmitting the full history on each progress checkpoint.
const sent = new Map<string, string>();

async function readTable(table: (typeof tables)[number], userId: string) {
  const all: RemoteRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase!
      .from(table)
      .select("id,payload,updated_at")
      .eq("user_id", userId)
      .order("id")
      .range(start, start + 999);
    if (error)
      throw new Error(
        "Sincronização indisponível. Execute a migração SQL e confira as políticas RLS.",
      );
    const rows = (data ?? []) as RemoteRow[];
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

export async function pullRemote(
  userId: string,
  local: Library,
): Promise<Library> {
  if (!supabase) return local;
  const rows = await Promise.all(
    tables.map((table) => readTable(table, userId)),
  );
  const result: Library = {
    ...local,
    progress: { ...local.progress },
    collectionDates: { ...local.collectionDates },
  };
  for (const row of rows[1]) {
    const progress = row.payload as Library["progress"][string];
    if (
      !result.progress[row.id] ||
      progress.updatedAt > result.progress[row.id].updatedAt
    ) {
      result.progress[row.id] = progress;
    }
  }
  for (const [index, key] of Object.entries(collections) as [
    string,
    CollectionKey,
  ][]) {
    const row = rows[Number(index)].find((value) => value.id === "snapshot");
    if (
      row &&
      Date.parse(row.updated_at) >
        (Date.parse(local.collectionDates?.[key] ?? "") || 0)
    ) {
      Object.assign(result, { [key]: row.payload });
      result.collectionDates![key] = row.updated_at;
    }
  }
  const sessions = new Map(
    local.sessions.map((session) => [session.id, session]),
  );
  for (const row of rows[5]) {
    const session = row.payload as ListeningSession;
    if (
      !sessions.has(session.id) ||
      session.seconds > sessions.get(session.id)!.seconds
    )
      sessions.set(session.id, session);
  }
  result.sessions = [...sessions.values()];
  return result;
}

export async function pushRemote(userId: string, state: Library) {
  if (!supabase) return;
  const payloads: unknown[][] = [
    [state.subscriptions],
    Object.values(state.progress),
    [state.favorites],
    [state.queue],
    [state.history],
    state.sessions,
    [state.settings],
  ];
  for (let index = 0; index < tables.length; index++) {
    const key = collections[index];
    const rows = payloads[index]
      .map((payload) => {
        const id =
          index === 1
            ? (payload as Library["progress"][string]).episode.id
            : index === 5
              ? (payload as ListeningSession).id
              : "snapshot";
        const updated_at = key
          ? (state.collectionDates?.[key] ?? new Date(0).toISOString())
          : index === 1
            ? (payload as Library["progress"][string]).updatedAt
            : new Date().toISOString();
        return { user_id: userId, id, payload, updated_at };
      })
      .filter(
        (row) =>
          sent.get(`${userId}:${tables[index]}:${row.id}`) !==
          JSON.stringify(row.payload),
      );
    for (let offset = 0; offset < rows.length; offset += 200) {
      const batch = rows.slice(offset, offset + 200);
      const { error } = await supabase
        .from(tables[index])
        .upsert(batch, { onConflict: "user_id,id" });
      if (error)
        throw new Error(
          "Falha ao sincronizar. Seus dados continuam salvos neste dispositivo.",
        );
      for (const row of batch)
        sent.set(
          `${userId}:${tables[index]}:${row.id}`,
          JSON.stringify(row.payload),
        );
    }
  }
}
