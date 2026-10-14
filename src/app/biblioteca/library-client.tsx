"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2, Plus } from "lucide-react";
import { useLibrary } from "@/components/provider";
import { PodcastCard, EpisodeRow, Empty, Loading } from "@/components/ui";
import type { Episode, Podcast } from "@/lib/types";
const tabs = [
  ["assinaturas", "Assinaturas"],
  ["fila", "Fila"],
  ["historico", "Histórico"],
  ["favoritos", "Favoritos"],
];
export function LibraryPage() {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("tab");
  const tab = tabs.some(([key]) => key === requested)
    ? requested
    : "assinaturas";
  const { library, ready, update } = useLibrary();
  function move(index: number, delta: number) {
    update((s) => {
      const queue = [...s.queue];
      const other = index + delta;
      if (other < 0 || other >= queue.length) return s;
      [queue[index], queue[other]] = [queue[other], queue[index]];
      return { ...s, queue };
    });
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TUDO QUE CONVERSA COM VOCÊ</span>
          <h1>
            Sua biblioteca<span className="accent">.</span>
          </h1>
          <p>As histórias que você quer ter por perto.</p>
        </div>
        <Link href="/buscar" className="secondary-button">
          <Plus size={17} /> Descobrir podcasts
        </Link>
      </div>
      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "selected" : ""}
            aria-pressed={tab === key}
            onClick={() =>
              router.replace(`/biblioteca?tab=${key}`, { scroll: false })
            }
          >
            {label}
            <span>
              {key === "assinaturas"
                ? library.subscriptions.length
                : key === "fila"
                  ? library.queue.length
                  : key === "historico"
                    ? library.history.length
                    : library.favorites.length}
            </span>
          </button>
        ))}
      </div>
      {!ready ? (
        <Loading />
      ) : tab === "assinaturas" ? (
        library.subscriptions.length ? (
          <div className="podcast-grid">
            {library.subscriptions.map((p) => (
              <PodcastCard key={p.feed} podcast={p} />
            ))}
          </div>
        ) : (
          <Empty title="Sua coleção começa com um play">
            <Link href="/buscar">
              Encontre podcasts e assine seus favoritos.
            </Link>
          </Empty>
        )
      ) : tab === "fila" ? (
        library.queue.length ? (
          <div>
            {library.queue.map((e, i) => (
              <div key={e.id} className="queue-row">
                <EpisodeRow episode={e} index={i} />
                <div className="queue-actions">
                  <button
                    aria-label={`Mover ${e.title} para cima`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label={`Mover ${e.title} para baixo`}
                    disabled={i === library.queue.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    aria-label="Remover da fila"
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        queue: s.queue.filter((x) => x.id !== e.id),
                      }))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Uma fila cheia de possibilidades">
            Use o menu de um episódio para adicionar à fila.
          </Empty>
        )
      ) : tab === "historico" ? (
        library.history.length ? (
          library.history.map((e) => <EpisodeRow key={e.id} episode={e} />)
        ) : (
          <Empty title="Seu histórico começa aqui">
            Os episódios que você ouvir aparecem neste espaço.
          </Empty>
        )
      ) : library.favorites.length ? (
        <>
          <div className="podcast-grid">
            {library.favorites
              .filter((p): p is Podcast => !("audio" in p))
              .map((p) => (
                <PodcastCard key={p.id} podcast={p} />
              ))}
          </div>
          <div className="section">
            {library.favorites
              .filter((p): p is Episode => "audio" in p)
              .map((e) => (
                <EpisodeRow key={e.id} episode={e} />
              ))}
          </div>
        </>
      ) : (
        <Empty title="Guarde o que fica com você">
          Toque no coração de um podcast ou episódio para favoritar.
        </Empty>
      )}
    </div>
  );
}
