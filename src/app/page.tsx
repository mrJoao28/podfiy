"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Flame,
  Sparkles,
  Play,
  Headphones,
} from "lucide-react";
import { useLibrary } from "@/components/provider";
import { usePlayer } from "@/components/player";
import { PodcastCard, EpisodeRow, Cover, Loading } from "@/components/ui";
import { streak, localDay } from "@/lib/stats";
import type { Podcast, Episode } from "@/lib/types";
export default function Home() {
  const { library, ready } = useLibrary();
  const player = usePlayer();
  const [discover, setDiscover] = useState<Podcast[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = streak(library.sessions, library.settings.dailyGoal);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/search?q=ciência%20cultura", { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setDiscover(d.podcasts.slice(0, 6));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  const feeds = library.subscriptions.map((p) => p.feed).join("|");
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
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
          setError(
            "Alguns feeds não puderam ser atualizados. Tente novamente mais tarde.",
          );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [feeds, ready]);
  const continuing = Object.values(library.progress)
    .filter((p) => !p.listened && p.position > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const progress = Math.min(
    100,
    ((sequence.days[localDay(new Date())] ?? 0) / library.settings.dailyGoal) *
      100,
  );
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
        <section className="streak-card">
          <div className="streak-card-top">
            <span className="eyebrow">UM HÁBITO QUE FAZ BEM</span>
            <Flame size={21} />
          </div>
          <div className="streak-number">
            {sequence.current}
            <span>{sequence.current === 1 ? "dia" : "dias"}</span>
          </div>
          <h3>A curiosidade não para.</h3>
          <p>
            Ouça um pouquinho hoje e<br />
            mantenha sua sequência viva.
          </p>
          <div className="goal-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="goal-caption">
            <span>Meta de hoje</span>
            <b>
              {Math.floor((sequence.days[localDay(new Date())] ?? 0) / 60)}/
              {Math.ceil(library.settings.dailyGoal / 60)} min
            </b>
          </div>
          <Link href="/estatisticas">
            Meu progresso <ArrowRight size={15} />
          </Link>
        </section>
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
        {loading && !discover.length && <Loading />}
        {error && (
          <p className="error" role="alert">
            {error} <Link href="/buscar">Abrir busca</Link>
          </p>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HISTÓRIAS FRESQUINHAS</span>
            <h2>
              Novos episódios{" "}
              <span className="count-badge">
                {
                  episodes.filter((e) => !library.progress[e.id]?.listened)
                    .length
                }
              </span>
            </h2>
          </div>
          <Link href="/biblioteca">
            Minha biblioteca <ArrowUpRight size={15} />
          </Link>
        </div>
        {episodes
          .filter((e) => !library.progress[e.id]?.listened)
          .slice(0, 6)
          .map((e) => (
            <EpisodeRow key={e.id} episode={e} />
          ))}
        {!episodes.length && (
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
      </section>
      <div className="listening-note">
        <span>✦</span> Menos ruído. Mais boas histórias.
      </div>
    </div>
  );
}
