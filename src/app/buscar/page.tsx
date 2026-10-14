"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Rss, ArrowRight } from "lucide-react";
import { PodcastCard, Loading, Empty } from "@/components/ui";
import type { Podcast } from "@/lib/types";
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feed, setFeed] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setResults(d.podcasts);
          setError("");
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SIGA SUA CURIOSIDADE</span>
          <h1>
            Encontre sua próxima história<span className="accent">.</span>
          </h1>
          <p>Um universo de conversas a uma busca de distância.</p>
        </div>
      </div>
      <label className="search-box">
        <Search size={23} />
        <input
          autoFocus
          placeholder="Busque podcasts, assuntos ou criadores"
          aria-label="Buscar podcasts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label="Limpar busca" onClick={() => setQuery("")}>
            ×
          </button>
        )}
      </label>
      <div className="topic-chips">
        {[
          "Ciência",
          "Tecnologia",
          "História",
          "Cultura",
          "Notícias",
          "Humor",
        ].map((q) => (
          <button
            key={q}
            onClick={() => setQuery(q)}
            className={query === q ? "selected" : ""}
          >
            {q}
          </button>
        ))}
      </div>
      <section className="section">
        {loading ? (
          <Loading />
        ) : error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : results.length ? (
          <>
            <div className="section-heading">
              <h2>Resultados para “{query}”</h2>
              <span className="muted">{results.length} podcasts</span>
            </div>
            <div className="podcast-grid">
              {results.map((p) => (
                <PodcastCard key={p.id} podcast={p} />
              ))}
            </div>
          </>
        ) : (
          <Empty
            title={
              query
                ? "Nenhum podcast encontrado"
                : "O que você quer ouvir hoje?"
            }
          >
            {query
              ? "Tente outro nome ou cole o RSS abaixo."
              : "Escolha um assunto ou busque seu podcast favorito."}
          </Empty>
        )}
      </section>
      <section className="rss-box">
        <Rss size={26} />
        <div>
          <h3>Já tem um feed RSS?</h3>
          <p>Cole o endereço e abra seu podcast direto por aqui.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const url = new URL(feed);
                if (!["https:", "http:"].includes(url.protocol))
                  throw new Error();
                router.push(`/podcast?feed=${encodeURIComponent(url.href)}`);
              } catch {
                setError("Informe uma URL HTTP ou HTTPS válida.");
              }
            }}
          >
            <input
              required
              type="url"
              placeholder="https://exemplo.com/feed.xml"
              aria-label="URL do feed RSS"
              value={feed}
              onChange={(e) => setFeed(e.target.value)}
            />
            <button className="primary-button">
              Abrir feed <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
