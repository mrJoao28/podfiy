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
  type Episode,
  type Podcast,
} from "@/lib/types";
import { readLibrary, writeLibrary } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { pullRemote, pushRemote } from "@/lib/sync";
import { stampLibraryChange } from "@/lib/library-merge";
import { SyncCoordinator } from "@/lib/sync-coordinator";
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
  const generation = useRef(0);
  const coordinator = useRef<SyncCoordinator | null>(null);
  if (!coordinator.current) {
    coordinator.current = new SyncCoordinator({
      current: () => current.current,
      apply: (next) => {
        current.current = next;
        setLibrary(next);
      },
      pull: pullRemote,
      push: pushRemote,
    });
  }
  const update = useCallback((fn: (s: Library) => Library) => {
    if (!initialized.current) return;
    const stamped = stampLibraryChange(current.current, fn(current.current));
    current.current = stamped;
    setLibrary(stamped);
  }, []);
  const runSync = useCallback(async (pull: boolean) => {
    if (!supabase || !initialized.current) return;
    const ticket = generation.current;
    try {
      await coordinator.current!.run(pull);
    } catch (e) {
      if (ticket === generation.current) setMessage((e as Error).message);
    }
  }, []);
  const sync = useCallback(() => runSync(true), [runSync]);
  useEffect(() => {
    let alive = true;
    let loadingKey: string | null = null;
    async function load(next: User | null) {
      const key = next?.id ?? "local";
      if (loadingKey === key) return;
      if (initialized.current && account.current === key) {
        setUser(next);
        return;
      }
      const ticket = ++generation.current;
      loadingKey = key;
      const previous = initialized.current
        ? { key: account.current, state: current.current }
        : null;
      initialized.current = false;
      coordinator.current!.activate(null);
      setReady(false);
      try {
        // Capture the old account's key before any asynchronous work.
        if (previous) await writeLibrary(previous.state, previous.key);
        let state = await readLibrary(key);
        if (!alive || ticket !== generation.current) return;
        if (next) {
          try {
            state = await pullRemote(next.id, state);
          } catch (e) {
            if (alive && ticket === generation.current)
              setMessage((e as Error).message);
          }
        }
        if (!alive || ticket !== generation.current) return;
        account.current = key;
        current.current = state;
        setLibrary(state);
        setUser(next);
        initialized.current = true;
        coordinator.current!.activate(key);
        setReady(true);
      } catch {
        if (alive && ticket === generation.current)
          setMessage(
            "Não foi possível abrir o armazenamento local. Permita dados de sites neste navegador.",
          );
      } finally {
        if (ticket === generation.current) loadingKey = null;
      }
    }
    if (supabase) {
      const initialGeneration = generation.current;
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (alive && generation.current === initialGeneration)
            void load(data.session?.user ?? null);
        })
        .catch(() => {
          if (alive && generation.current === initialGeneration)
            void load(null);
        });
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT")
          setTimeout(() => {
            if (alive) void load(session?.user ?? null);
          }, 0);
      });
      return () => {
        alive = false;
        generation.current++;
        coordinator.current!.activate(null);
        initialized.current = false;
        data.subscription.unsubscribe();
      };
    }
    void load(null);
    return () => {
      alive = false;
      generation.current++;
      coordinator.current!.activate(null);
      initialized.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !initialized.current) return;
    const key = account.current;
    const ticket = generation.current;
    const id = setTimeout(() => {
      if (ticket !== generation.current || !initialized.current) return;
      void writeLibrary(library, key).catch(() => {
        if (ticket === generation.current)
          setMessage("Falha ao salvar neste dispositivo.");
      });
    }, 300);
    return () => clearTimeout(id);
  }, [library, ready]);
  useEffect(() => {
    if (!ready || !user) return;
    const ticket = generation.current;
    const t = setTimeout(() => {
      if (ticket === generation.current) void runSync(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [library, user, ready, runSync]);
  useEffect(() => {
    const save = () => {
      if (!initialized.current) return;
      const ticket = generation.current;
      void writeLibrary(current.current, account.current).catch(() => {
        if (ticket === generation.current)
          setMessage("Falha ao salvar neste dispositivo.");
      });
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
