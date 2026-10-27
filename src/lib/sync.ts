import { supabase } from "./supabase";
import type { CollectionKey, Library } from "./types";
import { mergeLibraries } from "./library-merge";

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
type Client = NonNullable<typeof supabase>;

export function createRemoteSync(client: Client | null) {
  // Cache version as well as content: removing and re-adding an item is a new edit.
  const sent = new Map<string, string>();

  async function readTable(table: (typeof tables)[number], userId: string) {
    const all: RemoteRow[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await client!
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

  async function pullRemote(userId: string, local: Library): Promise<Library> {
    if (!client) return local;
    const rows = await Promise.all(
      tables.map((table) => readTable(table, userId)),
    );
    const remote: Library = {
      ...local,
      progress: {},
      sessions: [],
      collectionDates: {},
    };
    for (const row of rows[1])
      remote.progress[row.id] = row.payload as Library["progress"][string];
    for (const [index, key] of Object.entries(collections) as [
      string,
      CollectionKey,
    ][]) {
      const row = rows[Number(index)].find((value) => value.id === "snapshot");
      if (row) {
        Object.assign(remote, { [key]: row.payload });
        remote.collectionDates![key] = row.updated_at;
      }
    }
    remote.sessions = rows[5].map(
      (row) => row.payload as Library["sessions"][number],
    );
    return mergeLibraries(local, remote);
  }

  async function pushRemote(
    userId: string,
    state: Library,
    active = () => true,
  ) {
    if (!client || !active()) return;
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
                ? (payload as Library["sessions"][number]).id
                : "snapshot";
          const updated_at = key
            ? (state.collectionDates?.[key] ?? new Date(0).toISOString())
            : index === 1
              ? (payload as Library["progress"][string]).updatedAt
              : (payload as Library["sessions"][number]).date;
          return { user_id: userId, id, payload, updated_at };
        })
        .filter(
          (row) =>
            sent.get(`${userId}:${tables[index]}:${row.id}`) !==
            JSON.stringify([row.payload, row.updated_at]),
        );
      for (let offset = 0; offset < rows.length; offset += 200) {
        const batch = rows.slice(offset, offset + 200);
        if (!active()) return;
        // No unsafe fallback: the RPC requires the atomic guard migration.
        const { error } = await client.rpc("podfiy_upsert_rows", {
          p_table: tables[index],
          p_rows: batch,
        });
        if (error) {
          const missingMigration = ["PGRST202", "42883"].includes(error.code);
          throw new Error(
            missingMigration
              ? "Atualize o Supabase com a migração 002_sync_guards.sql para sincronizar com segurança. Seus dados continuam neste dispositivo."
              : "Falha ao sincronizar. Seus dados continuam salvos neste dispositivo.",
          );
        }
        for (const row of batch)
          sent.set(
            `${userId}:${tables[index]}:${row.id}`,
            JSON.stringify([row.payload, row.updated_at]),
          );
      }
    }
  }

  return { pullRemote, pushRemote };
}

export const { pullRemote, pushRemote } = createRemoteSync(supabase);
