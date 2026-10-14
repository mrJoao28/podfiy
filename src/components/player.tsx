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
import { useLibrary } from "./provider";
import type { Episode } from "@/lib/types";
import { localDay, heardSeconds } from "@/lib/stats";
type Player = {
  episode: Episode | null;
  playing: boolean;
  position: number;
  duration: number;
  speed: number;
  sleep: number;
  play: (e: Episode) => void;
  toggle: () => void;
  seek: (n: number) => void;
  next: () => void;
  previous: () => void;
  setSpeed: (n: number) => void;
  setSleep: (n: number) => void;
  expanded: boolean;
  setExpanded: (b: boolean) => void;
};
const Context = createContext<Player | null>(null);
export const usePlayer = () => {
  const p = useContext(Context);
  if (!p) throw new Error("Player ausente");
  return p;
};
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { library, update, setMessage, ready, user } = useLibrary();
  const audio = useRef<HTMLAudioElement>(null);
  const state = useRef(library);
  state.current = library;
  const [episode, setEpisode] = useState<Episode | null>(null);
  const selected = useRef<Episode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [sleep, setSleepState] = useState(0);
  const sleepEnd = useRef(0);
  const retry = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTick = useRef<{ wall: number; media: number } | null>(null);
  const pendingSeconds = useRef(0);
  const lastSave = useRef(0);
  const previousEpisodes = useRef<Episode[]>([]);
  const listeningId = useRef("");
  const flush = useCallback(() => {
    const e = selected.current,
      a = audio.current;
    if (!e || !a) return;
    const sample = { wall: performance.now(), media: a.currentTime };
    if (!a.seeking)
      pendingSeconds.current += heardSeconds(
        lastTick.current,
        sample,
        a.playbackRate,
      );
    lastTick.current = a.paused ? null : sample;
    const seconds = pendingSeconds.current;
    pendingSeconds.current = 0;
    if (!listeningId.current) listeningId.current = crypto.randomUUID();
    const id = `${listeningId.current}:${localDay(new Date())}:${e.podcastId}`;
    update((s) => {
      const existing = s.sessions.find((session) => session.id === id);
      const sessions =
        seconds <= 0
          ? s.sessions
          : existing
            ? s.sessions.map((session) =>
                session.id === id
                  ? { ...session, seconds: session.seconds + seconds }
                  : session,
              )
            : [
                ...s.sessions,
                {
                  id,
                  date: new Date().toISOString(),
                  podcastId: e.podcastId,
                  title: e.podcastTitle,
                  image: e.image,
                  seconds,
                },
              ];
      return {
        ...s,
        progress: {
          ...s.progress,
          [e.id]: {
            episode: e,
            position: a.currentTime || 0,
            listened: s.progress[e.id]?.listened || a.ended,
            updatedAt: new Date().toISOString(),
          },
        },
        sessions,
      };
    });
  }, [update]);
  const play = useCallback(
    (e: Episode) => {
      const a = audio.current;
      if (!a) return;
      flush();
      if (selected.current && selected.current.id !== e.id)
        previousEpisodes.current.push(selected.current);
      selected.current = e;
      setEpisode(e);
      retry.current = 0;
      lastTick.current = null;
      a.src = e.audio;
      a.playbackRate = state.current.settings.speed;
      const p = state.current.progress[e.id];
      const resume = p && !p.listened ? p.position : 0;
      setPosition(resume);
      setDuration(e.duration);
      a.currentTime = resume;
      void a
        .play()
        .catch(() => setMessage("Toque em reproduzir para iniciar o áudio."));
      update((s) => ({
        ...s,
        history: [e, ...s.history.filter((x) => x.id !== e.id)].slice(0, 200),
        queue: s.queue.filter((x) => x.id !== e.id),
      }));
    },
    [flush, setMessage, update],
  );
  const next = useCallback(() => {
    flush();
    const e = state.current.queue[0];
    if (e) play(e);
    else {
      audio.current?.pause();
      setMessage("Você chegou ao fim da fila.");
    }
  }, [flush, play, setMessage]);
  const previous = useCallback(() => {
    const e = previousEpisodes.current.pop();
    if (e) play(e);
    else if (audio.current) audio.current.currentTime = 0;
  }, [play]);
  const seek = useCallback(
    (n: number) => {
      const a = audio.current;
      if (!a) return;
      lastTick.current = null;
      a.currentTime = Math.max(
        0,
        Math.min(n, Number.isFinite(a.duration) ? a.duration : n),
      );
      setPosition(a.currentTime);
      flush();
    },
    [flush],
  );
  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a || !selected.current) return;
    if (a.paused)
      void a
        .play()
        .catch(() => setMessage("Áudio indisponível. Tente novamente."));
    else a.pause();
  }, [setMessage]);
  const setSpeed = (n: number) => {
    if (audio.current) audio.current.playbackRate = n;
    lastTick.current = null;
    update((s) => ({ ...s, settings: { ...s.settings, speed: n } }));
  };
  const setSleep = (minutes: number) => {
    sleepEnd.current = minutes ? Date.now() + minutes * 60000 : 0;
    setSleepState(minutes);
  };
  useEffect(() => {
    if (!ready) return;
    selected.current = null;
    pendingSeconds.current = 0;
    lastTick.current = null;
    previousEpisodes.current = [];
    sleepEnd.current = 0;
    setSleepState(0);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    audio.current?.pause();
    setPlaying(false);
    setEpisode(null);
    setPosition(0);
    setDuration(0);
    const last = state.current.history[0];
    if (last) {
      selected.current = last;
      setEpisode(last);
      setPosition(state.current.progress[last.id]?.position ?? 0);
      setDuration(last.duration);
      if (audio.current) {
        audio.current.src = last.audio;
        audio.current.currentTime =
          state.current.progress[last.id]?.position ?? 0;
      }
    } else {
      audio.current?.removeAttribute("src");
      if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    }
  }, [ready, user?.id]);
  useEffect(() => {
    const timer = setInterval(() => {
      const a = audio.current;
      if (!a) return;
      if (sleepEnd.current && Date.now() >= sleepEnd.current) {
        a.pause();
        sleepEnd.current = 0;
        setSleepState(0);
      }
      if (!a.paused && !a.seeking && a.readyState >= 3) {
        const now = performance.now(),
          media = a.currentTime;
        pendingSeconds.current += heardSeconds(
          lastTick.current,
          { wall: now, media },
          a.playbackRate,
        );
        lastTick.current = { wall: now, media };
        if (now - lastSave.current > 10000) {
          flush();
          lastSave.current = now;
        }
      } else lastTick.current = null;
    }, 1000);
    const save = () => flush();
    document.addEventListener("visibilitychange", save);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", save);
      window.removeEventListener("pagehide", save);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [flush]);
  useEffect(() => {
    if (!episode || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: episode.title,
      artist: episode.podcastTitle,
      album: episode.podcastTitle,
      artwork: episode.image
        ? [{ src: episode.image, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
    const actions: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => {
        void audio.current
          ?.play()
          .catch(() => setMessage("Não foi possível retomar o áudio."));
      },
      pause: () => audio.current?.pause(),
      seekbackward: (d) =>
        seek((audio.current?.currentTime ?? 0) - (d.seekOffset ?? 15)),
      seekforward: (d) =>
        seek((audio.current?.currentTime ?? 0) + (d.seekOffset ?? 30)),
      seekto: (d) => {
        if (d.seekTime !== undefined) seek(d.seekTime);
      },
      previoustrack: previous,
      nexttrack: next,
    };
    for (const [action, fn] of Object.entries(actions)) {
      try {
        ms.setActionHandler(action as MediaSessionAction, fn);
      } catch {}
    }
    return () => {
      for (const action of Object.keys(actions)) {
        try {
          ms.setActionHandler(action as MediaSessionAction, null);
        } catch {}
      }
    };
  }, [episode, next, previous, seek, setMessage]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    if (duration > 0 && Number.isFinite(duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          position: Math.min(position, duration),
          playbackRate: library.settings.speed,
        });
      } catch {}
    }
  }, [playing, position, duration, library.settings.speed]);
  const handleError = () => {
    if (retry.current >= 3) {
      setMessage(
        "Não foi possível carregar o áudio após três tentativas. Toque em reproduzir para tentar novamente.",
      );
      return;
    }
    const a = audio.current;
    if (!a) return;
    const pos = a.currentTime;
    retry.current++;
    setMessage(`Reconectando o áudio… tentativa ${retry.current}/3`);
    retryTimer.current = setTimeout(
      () => {
        a.load();
        a.currentTime = pos;
        void a.play().catch(() => {});
      },
      1000 * 2 ** retry.current,
    );
  };
  return (
    <Context.Provider
      value={{
        episode,
        playing,
        position,
        duration,
        speed: library.settings.speed,
        sleep,
        play,
        toggle,
        seek,
        next,
        previous,
        setSpeed,
        setSleep,
        expanded,
        setExpanded,
      }}
    >
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          lastTick.current = {
            wall: performance.now(),
            media: audio.current?.currentTime ?? 0,
          };
        }}
        onPause={() => {
          setPlaying(false);
          flush();
          lastTick.current = null;
        }}
        onSeeking={() => {
          lastTick.current = null;
        }}
        onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const a = audio.current;
          if (!a) return;
          setDuration(
            Number.isFinite(a.duration)
              ? a.duration
              : (selected.current?.duration ?? 0),
          );
          a.playbackRate = state.current.settings.speed;
          const p = selected.current
            ? state.current.progress[selected.current.id]
            : null;
          if (p && !p.listened && a.currentTime < 1) a.currentTime = p.position;
        }}
        onEnded={() => {
          const e = selected.current;
          if (e)
            update((s) => ({
              ...s,
              progress: {
                ...s.progress,
                [e.id]: {
                  episode: e,
                  position: audio.current?.duration ?? 0,
                  listened: true,
                  updatedAt: new Date().toISOString(),
                },
              },
            }));
          next();
        }}
        onError={handleError}
      />
      {children}
    </Context.Provider>
  );
}
