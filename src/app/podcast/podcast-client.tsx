"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Check, Heart, Play } from "lucide-react";
import { Cover, EpisodeRow, Loading, Empty } from "@/components/ui";
import { useLibrary } from "@/components/provider";
import { usePlayer } from "@/components/player";
import type { Podcast, Episode } from "@/lib/types";
export function PodcastPage() {
  const feed = useSearchParams().get("feed");
  const [data, setData] = useState<{
    podcast: Podcast;
    episodes: Episode[];
  } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const { library, subscribe, favorite } = useLibrary();
  const player = usePlayer();
  useEffect(() => {
    setData(null);
    setError("");
    if (!feed) {
      setError("URL do feed não informada.");
      return;
    }
    const c = new AbortController();
    fetch(`/api/feed?url=${encodeURIComponent(feed)}`, { signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [feed]);
  if (error)
    return (
      <div className="page">
        <Link href="/buscar" className="back-link">
          <ArrowLeft size={16} /> Voltar à busca
        </Link>
        <div className="error" role="alert">
          {error}
        </div>
      </div>
    );
  if (!data) return <Loading />;
  const p = data.podcast;
  const subscribed = library.subscriptions.some((x) => x.feed === p.feed);
  return (
    <div className="page podcast-page">
      <div
        className="podcast-backdrop"
        style={{ backgroundImage: `url(${JSON.stringify(p.image)})` }}
      />
      <Link href="/biblioteca" className="back-link">
        <ArrowLeft size={16} /> Sua biblioteca
      </Link>
      <div className="podcast-layout">
        <aside className="podcast-details">
          <Cover src={p.image} title={p.title} />
          <span className="eyebrow">PODCAST</span>
          <h1>{p.title}</h1>
          <p className="podcast-author">{p.author}</p>
          <div className="podcast-buttons">
            <button className="primary-button" onClick={() => subscribe(p)}>
              {subscribed ? <Check size={17} /> : <Plus size={17} />}{" "}
              {subscribed ? "Assinado" : "Assinar podcast"}
            </button>
            <button
              className={`icon-button outlined ${library.favorites.some((x) => !("audio" in x) && x.feed === p.feed) ? "accent" : ""}`}
              onClick={() => favorite(p)}
              aria-label="Favoritar podcast"
            >
              <Heart size={19} />
            </button>
          </div>
          <p className="podcast-description">{p.description}</p>
          <span className="muted">
            {data.episodes.length} episódios no feed
          </span>
        </aside>
        <section className="podcast-episodes">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DÊ O PLAY NA CURIOSIDADE</span>
              <h2>Todos os episódios</h2>
            </div>
            <button
              className="play-button"
              disabled={!data.episodes.length}
              aria-label="Ouvir episódio mais recente"
              onClick={() => player.play(data.episodes[0])}
            >
              <Play size={20} fill="currentColor" />
            </button>
          </div>
          <input
            className="filter-input"
            placeholder="Filtrar episódios…"
            aria-label="Filtrar episódios"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {data.episodes
            .filter((e) =>
              e.title
                .toLocaleLowerCase("pt-BR")
                .includes(filter.toLocaleLowerCase("pt-BR")),
            )
            .map((e, i) => (
              <EpisodeRow key={e.id} episode={e} index={i} />
            ))}
          {!data.episodes.length && (
            <Empty title="Nenhum episódio de áudio">
              Este feed ainda não publicou arquivos de áudio.
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}
