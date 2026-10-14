"use client";
import Link from "next/link";
import {
  Heart,
  Play,
  Plus,
  Check,
  MoreHorizontal,
  Headphones,
  Pause,
} from "lucide-react";
import { useLibrary } from "./provider";
import { usePlayer } from "./player";
import { formatTime } from "@/lib/stats";
import type { Episode, Podcast } from "@/lib/types";
export function Cover({
  src,
  title,
  className = "",
}: {
  src: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={`cover ${className}`}>
      {src ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <Headphones size={32} />
      )}
    </div>
  );
}
export function PodcastCard({ podcast }: { podcast: Podcast }) {
  const { library, subscribe, favorite } = useLibrary();
  const subscribed = library.subscriptions.some((p) => p.feed === podcast.feed);
  return (
    <article className="podcast-card">
      <Link href={`/podcast?feed=${encodeURIComponent(podcast.feed)}`}>
        <Cover src={podcast.image} title={podcast.title} />
        <h3>{podcast.title}</h3>
        <p>{podcast.author}</p>
      </Link>
      <div className="card-actions">
        <button
          className={subscribed ? "subscribed" : ""}
          onClick={() => subscribe(podcast)}
        >
          {subscribed ? <Check size={14} /> : <Plus size={14} />}{" "}
          {subscribed ? "Na biblioteca" : "Assinar"}
        </button>
        <button
          aria-label="Favoritar podcast"
          className={
            library.favorites.some(
              (p) => !("audio" in p) && p.feed === podcast.feed,
            )
              ? "accent"
              : ""
          }
          onClick={() => favorite(podcast)}
        >
          <Heart size={16} />
        </button>
      </div>
    </article>
  );
}
export function EpisodeRow({
  episode,
  index,
}: {
  episode: Episode;
  index?: number;
}) {
  const { library, update, favorite, enqueue } = useLibrary();
  const player = usePlayer();
  const current = player.episode?.id === episode.id;
  const listened = library.progress[episode.id]?.listened;
  return (
    <article
      className={`episode-row ${current ? "current" : ""} ${listened ? "listened" : ""}`}
    >
      <button
        className="episode-art"
        aria-label={`Ouvir ${episode.title}`}
        onClick={() => (current ? player.toggle() : player.play(episode))}
      >
        {index !== undefined ? (
          <span className="row-number">
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : (
          <Cover src={episode.image} title="" />
        )}
        <span className="art-play">
          {current && player.playing ? <Pause size={18} /> : <Play size={18} />}
        </span>
      </button>
      <div className="episode-info">
        <span className="eyebrow">
          {episode.date
            ? new Date(episode.date).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })
            : "EPISÓDIO"}
        </span>
        <button
          className="episode-title"
          onClick={() => (current ? player.toggle() : player.play(episode))}
        >
          {episode.title}
        </button>
        <p>
          {episode.podcastTitle}{" "}
          <span>
            ·{" "}
            {episode.duration
              ? formatTime(episode.duration)
              : "Duração indisponível"}
          </span>
        </p>
      </div>
      <button
        className={`icon-button favorite-button ${library.favorites.some((p) => p.id === episode.id) ? "accent" : ""}`}
        title="Favoritar"
        aria-label="Favoritar episódio"
        onClick={() => favorite(episode)}
      >
        <Heart size={18} />
      </button>
      <details className="dropdown">
        <summary className="icon-button" aria-label="Opções do episódio">
          <MoreHorizontal size={20} />
        </summary>
        <div className="dropdown-menu">
          <button onClick={() => enqueue(episode)}>Adicionar à fila</button>
          <button
            onClick={() =>
              update((s) => ({
                ...s,
                progress: {
                  ...s.progress,
                  [episode.id]: {
                    episode,
                    position: s.progress[episode.id]?.position ?? 0,
                    listened: !listened,
                    updatedAt: new Date().toISOString(),
                  },
                },
              }))
            }
          >
            {listened ? "Marcar como não ouvido" : "Marcar como ouvido"}
          </button>
          <Link href={`/podcast?feed=${encodeURIComponent(episode.feed)}`}>
            Ir ao podcast
          </Link>
        </div>
      </details>
    </article>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Headphones size={36} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span /> Preparando suas histórias…
    </div>
  );
}
