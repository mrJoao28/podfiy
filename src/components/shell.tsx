"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  Search,
  Library,
  ChartNoAxesCombined,
  Settings2,
  Headphones,
  Flame,
  ArrowUpRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Heart,
  ChevronDown,
  MoreHorizontal,
  Volume2,
  Timer,
  ListMusic,
} from "lucide-react";
import { useLibrary } from "./provider";
import { usePlayer } from "./player";
import { Cover, EpisodeRow } from "./ui";
import { formatTime, streak } from "@/lib/stats";
const tabs = [
  { href: "/", label: "Início", icon: Home },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/estatisticas", label: "Estatísticas", icon: ChartNoAxesCombined },
  { href: "/config", label: "Config", icon: Settings2 },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { library, user } = useLibrary();
  const player = usePlayer();
  const sequence = streak(library.sessions, library.settings.dailyGoal);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Headphones size={25} />
          </span>
          podfiy<span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-label">SEU UNIVERSO SONORO</div>
        <nav>
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={path === t.href ? "active" : ""}
            >
              <t.icon size={20} />
              {t.label === "Config" ? "Configurações" : t.label}
              {path === t.href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-library">
          <div className="sidebar-label">
            SUA BIBLIOTECA <span>{library.subscriptions.length}</span>
          </div>
          {library.subscriptions.slice(0, 4).map((p) => (
            <Link
              href={`/podcast?feed=${encodeURIComponent(p.feed)}`}
              key={p.feed}
            >
              <Cover src={p.image} title="" />
              <span>{p.title}</span>
            </Link>
          ))}
          {!library.subscriptions.length && (
            <p>
              Suas próximas descobertas
              <br />
              moram aqui.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="streak-small">
            <Flame size={21} />
            <div>
              <b>
                {sequence.current} {sequence.current === 1 ? "dia" : "dias"} em
                sequência
              </b>
              <span>Um pouco, todos os dias.</span>
            </div>
          </div>
          <Link href="/config" className="profile">
            <div className="avatar">
              {user?.email?.slice(0, 1).toUpperCase() ?? "J"}
            </div>
            <div>
              <b>Meu espaço</b>
              <span>{user ? "Conta sincronizada" : "Neste dispositivo"}</span>
            </div>
            <Settings2 size={16} />
          </Link>
        </div>
      </aside>
      <main className={`main ${player.episode ? "has-player" : ""}`}>
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            podfiy<span>.</span>
          </Link>
          <span className="topbar-caption">
            UM BOM DIA COMEÇA COM UMA BOA HISTÓRIA.
          </span>
          <div>
            <span className="personal-badge">
              <span /> Seu espaço pessoal
            </span>
            <Link href="/config" className="avatar" aria-label="Minha conta">
              {user?.email?.slice(0, 1).toUpperCase() ?? "J"}
            </Link>
          </div>
        </header>
        {children}
        <footer className="page-footer">
          <Headphones size={14} />
          <span>Feito para ouvir no seu ritmo.</span>
          <span>podfiy © {new Date().getFullYear()}</span>
        </footer>
      </main>
      <nav className="mobile-nav">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={path === t.href ? "active" : ""}
          >
            <t.icon size={21} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
      {player.episode && <MiniPlayer />}
      {player.expanded && player.episode && <NowPlaying />}
    </>
  );
}
function MiniPlayer() {
  const p = usePlayer();
  const { library, favorite } = useLibrary();
  const e = p.episode!;
  return (
    <section className="mini-player" aria-label="Player">
      <input
        className="mini-progress"
        aria-label="Posição do áudio"
        type="range"
        min={0}
        max={p.duration || 1}
        value={Math.min(p.position, p.duration || 1)}
        onChange={(e) => p.seek(Number(e.target.value))}
        style={
          {
            "--progress": `${p.duration ? (p.position / p.duration) * 100 : 0}%`,
          } as React.CSSProperties
        }
      />
      <button className="mini-track" onClick={() => p.setExpanded(true)}>
        <Cover src={e.image} title="" />
        <div>
          <b>{e.title}</b>
          <span>{e.podcastTitle}</span>
        </div>
      </button>
      <button
        className={`icon-button mini-heart ${library.favorites.some((x) => x.id === e.id) ? "accent" : ""}`}
        aria-label="Favoritar"
        onClick={() => favorite(e)}
      >
        <Heart size={19} />
      </button>
      <div className="mini-center">
        <div className="mini-controls">
          <button
            className="icon-button desktop-only"
            aria-label="Voltar 15 segundos"
            onClick={() => p.seek(p.position - 15)}
          >
            <RotateCcw size={17} />
          </button>
          <button
            className="icon-button desktop-only"
            aria-label="Anterior"
            onClick={p.previous}
          >
            <SkipBack size={19} />
          </button>
          <button
            className="play-button"
            aria-label={p.playing ? "Pausar" : "Reproduzir"}
            onClick={p.toggle}
          >
            {p.playing ? (
              <Pause size={21} fill="currentColor" />
            ) : (
              <Play size={21} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button desktop-only"
            aria-label="Próximo"
            onClick={p.next}
          >
            <SkipForward size={19} />
          </button>
          <button
            className="icon-button desktop-only"
            aria-label="Avançar 30 segundos"
            onClick={() => p.seek(p.position + 30)}
          >
            <RotateCw size={17} />
          </button>
        </div>
        <div className="mini-times desktop-only">
          {formatTime(p.position)} <span> / </span> {formatTime(p.duration)}
        </div>
      </div>
      <div className="mini-right desktop-only">
        <button
          onClick={() => p.setExpanded(true)}
          className="icon-button"
          aria-label="Abrir tocando agora"
        >
          <ListMusic size={19} />
        </button>
        <Volume2 size={18} />
        <button
          className="speed-control"
          onClick={() => p.setSpeed(p.speed >= 2 ? 0.75 : p.speed + 0.25)}
        >
          {p.speed}×
        </button>
        <button
          className="icon-button"
          aria-label="Expandir player"
          onClick={() => p.setExpanded(true)}
        >
          <ArrowUpRight size={20} />
        </button>
      </div>
    </section>
  );
}
function NowPlaying() {
  const p = usePlayer();
  const { library, favorite, enqueue, setMessage } = useLibrary();
  const [description, setDescription] = useState(false);
  const e = p.episode!;
  const percent = p.duration ? Math.min(1, p.position / p.duration) : 0;
  function ringSeek(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const angle =
      (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    p.seek((angle / (Math.PI * 2)) * p.duration);
  }
  return (
    <div
      className="now-playing"
      role="dialog"
      aria-modal="true"
      aria-label="Tocando agora"
      onKeyDown={(event) => {
        if (event.key === "Escape") p.setExpanded(false);
      }}
    >
      <div className="now-inner">
        <header>
          <button
            className="icon-button"
            aria-label="Voltar"
            onClick={() => p.setExpanded(false)}
          >
            <ChevronDown />
          </button>
          <span>TOCANDO AGORA</span>
          <details className="dropdown">
            <summary className="icon-button" aria-label="Menu do player">
              <MoreHorizontal />
            </summary>
            <div className="dropdown-menu">
              <button onClick={() => enqueue(e)}>Adicionar à fila</button>
              <button onClick={() => favorite(e)}>Favoritar</button>
              <button
                onClick={async () => {
                  try {
                    const url = `${location.origin}/podcast?feed=${encodeURIComponent(e.feed)}`;
                    if (navigator.share)
                      await navigator.share({ title: e.title, url });
                    else {
                      await navigator.clipboard.writeText(url);
                      setMessage("Link copiado.");
                    }
                  } catch {
                    setMessage("Não foi possível compartilhar.");
                  }
                }}
              >
                Compartilhar
              </button>
              <button onClick={() => setDescription(!description)}>
                Ver descrição
              </button>
              <Link
                onClick={() => p.setExpanded(false)}
                href={`/podcast?feed=${encodeURIComponent(e.feed)}`}
              >
                Ir ao podcast
              </Link>
            </div>
          </details>
        </header>
        <div className="vinyl-area">
          <span className="ring-time elapsed">{formatTime(p.position)}</span>
          <div className="vinyl-wrap">
            <svg
              viewBox="0 0 320 320"
              className="progress-ring"
              role="slider"
              aria-label="Progresso do episódio"
              aria-valuemin={0}
              aria-valuemax={p.duration}
              aria-valuenow={p.position}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") p.seek(p.position + 15);
                if (event.key === "ArrowLeft") p.seek(p.position - 15);
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                ringSeek(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons === 1) ringSeek(event);
              }}
            >
              <circle
                cx="160"
                cy="160"
                r="154"
                fill="none"
                stroke="#292b35"
                strokeWidth="2"
              />
              <circle
                cx="160"
                cy="160"
                r="154"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeDasharray={968}
                strokeDashoffset={968 * (1 - percent)}
                transform="rotate(-90 160 160)"
                strokeLinecap="round"
              />
            </svg>
            <div className={`vinyl ${p.playing ? "spinning" : ""}`}>
              <img
                src={e.image || "/icons/icon-512.png"}
                alt={e.podcastTitle}
              />
              <div className="vinyl-grooves" />
              <span className="vinyl-hole" />
            </div>
          </div>
          <span className="ring-time remaining">
            −{formatTime(p.duration - p.position)}
          </span>
        </div>
        <div className="now-title">
          <span className="eyebrow">NO SEU RITMO</span>
          <h1>{e.title}</h1>
          <Link
            href={`/podcast?feed=${encodeURIComponent(e.feed)}`}
            onClick={() => p.setExpanded(false)}
          >
            {e.podcastTitle}
          </Link>
        </div>
        <div className="now-controls">
          <button
            aria-label="Voltar 15 segundos"
            onClick={() => p.seek(p.position - 15)}
            className="skip-seconds"
          >
            <RotateCcw />
            <small>15</small>
          </button>
          <button
            className="icon-button"
            aria-label="Anterior"
            onClick={p.previous}
          >
            <SkipBack size={26} fill="currentColor" />
          </button>
          <button
            className="play-button large"
            aria-label={p.playing ? "Pausar" : "Reproduzir"}
            onClick={p.toggle}
          >
            {p.playing ? (
              <Pause size={34} fill="currentColor" />
            ) : (
              <Play size={34} fill="currentColor" />
            )}
          </button>
          <button className="icon-button" aria-label="Próximo" onClick={p.next}>
            <SkipForward size={26} fill="currentColor" />
          </button>
          <button
            aria-label="Avançar 30 segundos"
            onClick={() => p.seek(p.position + 30)}
            className="skip-seconds"
          >
            <RotateCw />
            <small>30</small>
          </button>
        </div>
        <div className="now-extras">
          <label>
            <select
              aria-label="Velocidade de reprodução"
              value={p.speed}
              onChange={(e) => p.setSpeed(Number(e.target.value))}
            >
              {[0.75, 1, 1.25, 1.5, 1.75, 2].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
            <span>Velocidade</span>
          </label>
          <label>
            <div>
              <Timer size={18} />
              <select
                aria-label="Timer de sono"
                value={p.sleep}
                onChange={(e) => p.setSleep(Number(e.target.value))}
              >
                <option value={0}>Desligado</option>
                {[5, 15, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </div>
            <span>Timer de sono</span>
          </label>
          <button
            className={
              library.favorites.some((x) => x.id === e.id) ? "accent" : ""
            }
            onClick={() => favorite(e)}
          >
            <Heart size={21} />
            <span>Favoritar</span>
          </button>
        </div>
        {description && (
          <div className="description">
            <h3>Sobre o episódio</h3>
            <p>{e.description || "Este episódio não tem descrição."}</p>
          </div>
        )}
        <div className="up-next">
          <div className="section-heading">
            <h2>A seguir</h2>
            <Link
              href="/biblioteca?tab=fila"
              onClick={() => p.setExpanded(false)}
            >
              Ver fila <ArrowUpRight size={14} />
            </Link>
          </div>
          {library.queue.length ? (
            library.queue
              .slice(0, 3)
              .map((q) => <EpisodeRow key={q.id} episode={q} />)
          ) : (
            <p className="muted">
              Adicione episódios à fila e deixe as histórias continuarem.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
