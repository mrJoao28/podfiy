"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  emptyLibrary,
  type Library,
  type CollectionKey,
  type Episode,
  type Podcast,
} from "@/lib/types";
import { readLibrary, writeLibrary } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { pullRemote, pushRemote } from "@/lib/sync";
type Store = {
  library: Library;
  ready: boolean;
  user: User | null;
  message: string;
  setMessage: (s: string) => void;
  update: (f: (s: Library) => Library) => void;
  subscribe: (p: Podcast) => void;
  favorite: (p: Podcast | Episode) => void;
  enqueue: (e: Episode) => void;
  sync: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export const useLibrary = () => {
  const c = useContext(Context);
  if (!c) throw new Error("Provider ausente");
  return c;
};
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<Library>(
    structuredClone(emptyLibrary),
  );
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const current = useRef(library);
  const account = useRef<string>("local");
  const initialized = useRef(false);
  const syncBusy = useRef(false);
  const update = useCallback((fn: (s: Library) => Library) => {
    const s = current.current;
    const next = fn(s);
    const dates = { ...next.collectionDates };
    for (const key of [
      "subscriptions",
      "favorites",
      "queue",
      "history",
      "settings",
    ] as CollectionKey[]) {
      if (next[key] !== s[key] && next.collectionDates === s.collectionDates)
        dates[key] = new Date().toISOString();
    }
    const stamped = { ...next, collectionDates: dates };
    current.current = stamped;
    setLibrary(stamped);
  }, []);
  const sync = useCallback(async () => {
    if (!supabase || account.current === "local" || syncBusy.current) return;
    syncBusy.current = true;
    try {
      const merged = await pullRemote(account.current, current.current);
      update(() => merged);
      await pushRemote(account.current, merged);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      syncBusy.current = false;
    }
  }, [update]);
  useEffect(() => {
    let alive = true;
    let generation = 0;
    async function load(next: User | null) {
      // Supabase may emit SIGNED_IN again when a tab regains focus.
      if (initialized.current && account.current === (next?.id ?? "local")) {
        setUser(next);
        return;
      }
      const ticket = ++generation;
      setReady(false);
      try {
        const key = next?.id ?? "local";
        let state = await readLibrary(key);
        if (!alive || ticket !== generation) return;
        account.current = key;
        setUser(next);
        if (next) {
          try {
            state = await pullRemote(next.id, state);
          } catch (e) {
            setMessage((e as Error).message);
          }
        }
        if (!alive || ticket !== generation) return;
        current.current = state;
        setLibrary(state);
        initialized.current = true;
        setReady(true);
      } catch {
        setMessage(
          "Não foi possível abrir o armazenamento local. Permita dados de sites neste navegador.",
        );
      }
    }
    if (supabase) {
      void supabase.auth
        .getSession()
        .then(({ data }) => load(data.session?.user ?? null))
        .catch(() => {
          setMessage(
            "Não foi possível recuperar a conta. Abrindo o modo local.",
          );
          void load(null);
        });
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT")
          setTimeout(() => void load(session?.user ?? null), 0);
      });
      return () => {
        alive = false;
        data.subscription.unsubscribe();
      };
    }
    void load(null);
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !initialized.current) return;
    const id = setTimeout(() => {
      void writeLibrary(library, account.current).catch(() =>
        setMessage("Falha ao salvar neste dispositivo."),
      );
    }, 300);
    return () => clearTimeout(id);
  }, [library, ready]);
  useEffect(() => {
    if (!ready || !user) return;
    const t = setTimeout(() => {
      if (syncBusy.current) return;
      syncBusy.current = true;
      void pushRemote(user.id, current.current)
        .catch((e) => setMessage(e.message))
        .finally(() => {
          syncBusy.current = false;
        });
    }, 3000);
    return () => clearTimeout(t);
  }, [library, user, ready]);
  useEffect(() => {
    const save = () => {
      if (initialized.current)
        void writeLibrary(current.current, account.current);
    };
    const online = () => void sync();
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", save);
    return () => {
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", save);
    };
  }, [sync]);
  const subscribe = (p: Podcast) =>
    update((s) => ({
      ...s,
      subscriptions: s.subscriptions.some((x) => x.feed === p.feed)
        ? s.subscriptions.filter((x) => x.feed !== p.feed)
        : [...s.subscriptions, p],
    }));
  const favorite = (p: Podcast | Episode) =>
    update((s) => {
      const matches = (x: Podcast | Episode) =>
        "audio" in p ? x.id === p.id : !("audio" in x) && x.feed === p.feed;
      return {
        ...s,
        favorites: s.favorites.some(matches)
          ? s.favorites.filter((x) => !matches(x))
          : [...s.favorites, p],
      };
    });
  const enqueue = (e: Episode) => {
    update((s) => ({
      ...s,
      queue: s.queue.some((x) => x.id === e.id) ? s.queue : [...s.queue, e],
    }));
    setMessage("Episódio adicionado à fila.");
  };
  return (
    <Context.Provider
      value={{
        library,
        ready,
        user,
        message,
        setMessage,
        update,
        subscribe,
        favorite,
        enqueue,
        sync,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status" onClick={() => setMessage("")}>
          {message}
          <button aria-label="Fechar aviso" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
