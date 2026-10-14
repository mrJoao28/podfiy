"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Play,
  Headphones,
} from "lucide-react";
import { useLibrary } from "@/components/provider";
import { usePlayer } from "@/components/player";
import { PodcastCard, EpisodeRow, Cover, Loading } from "@/components/ui";
import { DailyGoal } from "@/components/daily-goal";
import type { Podcast, Episode } from "@/lib/types";
export default function Home() {
  const { library, ready } = useLibrary();
  const player = usePlayer();
  const [discover, setDiscover] = useState<Podcast[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [discoverError, setDiscoverError] = useState("");
  const [feedError, setFeedError] = useState("");
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [feedsLoading, setFeedsLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!ready) return;
    if (library.subscriptions.length) {
      setDiscoverLoading(false);
      setDiscoverError("");
      return;
    }
    const controller = new AbortController();
    setDiscoverLoading(true);
    setDiscoverError("");
    fetch("/api/search?q=ciência%20cultura", { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setDiscover(d.podcasts.slice(0, 6));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setDiscoverError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDiscoverLoading(false);
      });
    return () => controller.abort();
  }, [ready, library.subscriptions.length, refresh]);
  const feeds = library.subscriptions.map((p) => p.feed).join("|");
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setFeedsLoading(true);
    setFeedError("");
    Promise.allSettled(
      library.subscriptions.map((p) =>
        fetch(`/api/feed?url=${encodeURIComponent(p.feed)}`, {
          signal: controller.signal,
        }).then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          return d.episodes as Episode[];
        }),
      ),
    )
      .then((results) => {
        if (controller.signal.aborted) return;
        setEpisodes(
          results
            .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
            .sort((a, b) => b.date.localeCompare(a.date)),
        );
        if (
          results.some(
            (r) => r.status === "rejected" && r.reason?.name !== "AbortError",
          )
        )
          setFeedError(
            "Alguns feeds não puderam ser atualizados. Tente novamente mais tarde.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setFeedsLoading(false);
      });
    return () => controller.abort();
  }, [feeds, ready, refresh]);
  const continuing = Object.values(library.progress)
    .filter((p) => !p.listened && p.position > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const newEpisodes = episodes.filter((e) => !library.progress[e.id]?.listened);
  return (
    <div className="page home-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEU MOMENTO DE DAR O PLAY</span>
          <h1>
            Bom te ver por aqui<span className="accent">.</span>
          </h1>
          <p>Uma pausa no mundo. Um play no que importa.</p>
        </div>
        <span className="date-label">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>
      <div className="home-top-grid">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-tag">
              <span /> SINTONIZE COM VOCÊ
            </span>
            <h2>
              Tem um mundo inteiro
              <br />
              no seu próximo <em>play.</em>
            </h2>
            <p>
              Ideias que inspiram. Conversas que ficam.
              <br />
              Descubra sua próxima boa companhia.
            </p>
            <Link href="/buscar" className="primary-button">
              Explorar podcasts <ArrowUpRight size={18} />
            </Link>
            <div className="hero-bottom">
              <span className="tiny-wave">▂▅▃▇▅▂▆▃</span> CADA HISTÓRIA, UM NOVO
              COMEÇO
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-disc">
              <div className="disc-label">
                <Headphones size={43} />
                <span>podfiy records</span>
              </div>
              <div className="disc-hole" />
            </div>
            <span className="art-spark">✦</span>
            <span className="art-text">
              PRESS PLAY
              <br />
              FEEL SOMETHING.
            </span>
          </div>
        </section>
        {ready && <DailyGoal />}
      </div>
      {continuing.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DE ONDE VOCÊ PAROU</span>
              <h2>Continuar ouvindo</h2>
            </div>
            <Link href="/biblioteca?tab=historico">
              Ver histórico <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="continue-grid">
            {continuing.slice(0, 3).map((p) => (
              <button
                key={p.episode.id}
                className="continue-card"
                onClick={() => player.play(p.episode)}
              >
                <Cover src={p.episode.image} title="" />
                <div>
                  <span>{p.episode.podcastTitle}</span>
                  <b>{p.episode.title}</b>
                  <div className="goal-bar">
                    <span
                      style={{
                        width: `${p.episode.duration ? (p.position / p.episode.duration) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="small-play">
                  <Play size={17} fill="currentColor" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ABRA OS OUVIDOS PARA O NOVO</span>
            <h2>
              {library.subscriptions.length
                ? "Seus podcasts"
                : "Pode ser seu próximo favorito"}
            </h2>
          </div>
          <Link href={library.subscriptions.length ? "/biblioteca" : "/buscar"}>
            Ver todos <ArrowUpRight size={15} />
          </Link>
        </div>
        {!ready ? (
          <Loading />
        ) : (
          <div className="podcast-grid">
            {(library.subscriptions.length
              ? library.subscriptions.slice(0, 6)
              : discover
            ).map((p) => (
              <PodcastCard key={p.feed} podcast={p} />
            ))}
          </div>
        )}
        {ready && discoverLoading && !library.subscriptions.length && (
          <Loading />
        )}
        {discoverError && (
          <p className="error" role="alert">
            {discoverError}{" "}
            <button
              className="text-button"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Tentar novamente
            </button>
          </p>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HISTÓRIAS FRESQUINHAS</span>
            <h2>
              Novos episódios{" "}
              <span className="count-badge">{newEpisodes.length}</span>
            </h2>
          </div>
          <Link href="/biblioteca">
            Minha biblioteca <ArrowUpRight size={15} />
          </Link>
        </div>
        {feedError && (
          <p className="error" role="alert">
            {feedError}{" "}
            <button
              className="text-button"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Atualizar feeds
            </button>
          </p>
        )}
        {(!ready || feedsLoading) && <Loading />}
        {newEpisodes.slice(0, 6).map((e) => (
          <EpisodeRow key={e.id} episode={e} />
        ))}
        {ready &&
          !feedsLoading &&
          !feedError &&
          !library.subscriptions.length && (
            <Link href="/buscar" className="new-episodes-empty">
              <span className="empty-icon">
                <Sparkles size={24} />
              </span>
              <div>
                <h3>As próximas histórias começam aqui.</h3>
                <p>
                  Assine seus podcasts favoritos para receber novos episódios.
                </p>
              </div>
              <ArrowRight size={20} />
            </Link>
          )}
        {ready &&
          !feedsLoading &&
          !feedError &&
          !!library.subscriptions.length &&
          !newEpisodes.length && (
            <p className="caught-up">
              Tudo em dia. Os próximos episódios das suas assinaturas aparecem
              aqui.
            </p>
          )}
      </section>
      <div className="listening-note">
        <span>✦</span> Menos ruído. Mais boas histórias.
      </div>
    </div>
  );
}
