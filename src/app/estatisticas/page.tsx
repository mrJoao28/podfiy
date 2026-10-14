"use client";
import { useState } from "react";
import { Flame, Clock3, Headphones, Trophy } from "lucide-react";
import { useLibrary } from "@/components/provider";
import { Cover, Empty, Loading } from "@/components/ui";
import { DailyGoal, useToday } from "@/components/daily-goal";
import {
  dayOffset,
  localDay,
  streak,
  topPodcasts,
  listeningBuckets,
} from "@/lib/stats";
export default function Stats() {
  const { library, ready } = useLibrary();
  const [filter, setFilter] = useState(30);
  const [group, setGroup] = useState<"week" | "month">("week");
  const now = useToday();
  const seq = streak(library.sessions, library.settings.dailyGoal, now);
  const cutoff = filter ? now.getTime() - filter * 86400000 : 0;
  const sessions = library.sessions.filter(
    (s) => new Date(s.date).getTime() >= cutoff,
  );
  const total = sessions.reduce((sum, s) => sum + s.seconds, 0);
  const week = library.sessions
    .filter((s) => new Date(s.date).getTime() >= now.getTime() - 7 * 86400000)
    .reduce((sum, s) => sum + s.seconds, 0);
  const month = library.sessions
    .filter((s) => new Date(s.date).getTime() >= now.getTime() - 30 * 86400000)
    .reduce((sum, s) => sum + s.seconds, 0);
  const top = topPodcasts(library.sessions, filter, now);
  const heat = Array.from({ length: 112 }, (_, i) =>
    dayOffset(localDay(now), i - 111),
  );
  const bars = listeningBuckets(sessions, group, now);
  const max = Math.max(1, ...bars.map((b) => b.seconds));
  if (!ready) return <Loading />;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA MINUTO CONTA UMA HISTÓRIA</span>
          <h1>
            Seu ritmo de escuta<span className="accent">.</span>
          </h1>
          <p>Pequenos momentos, grandes descobertas.</p>
        </div>
        <div className="period-filter">
          {[
            [7, "7 dias"],
            [30, "30 dias"],
            [365, "Ano"],
            [0, "Tudo"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={filter === v ? "selected" : ""}
              aria-pressed={filter === v}
              onClick={() => setFilter(Number(v))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="stats-cards">
        {[
          {
            icon: Clock3,
            value: (total / 3600).toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            }),
            label: "horas no período",
          },
          {
            icon: Headphones,
            value: (week / 3600).toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            }),
            label: "horas nos últimos 7 dias",
          },
          {
            icon: Clock3,
            value: (month / 3600).toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            }),
            label: "horas nos últimos 30 dias",
          },
          {
            icon: Flame,
            value: seq.current,
            label: seq.current === 1 ? "dia em sequência" : "dias em sequência",
          },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <s.icon size={23} />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <DailyGoal compact />
      <section className="panel section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CONSISTÊNCIA É CONEXÃO</span>
            <h2>Sua curiosidade, dia após dia</h2>
          </div>
          <span className="record">
            <Trophy size={16} /> Recorde: {seq.longest}{" "}
            {seq.longest === 1 ? "dia" : "dias"}
          </span>
        </div>
        <div
          className="heatmap"
          aria-label="Dias de escuta nos últimos quatro meses"
        >
          {heat.map((day) => {
            const seconds = seq.days[day] ?? 0;
            return (
              <div
                key={day}
                title={`${day}: ${Math.floor(seconds / 60)} min`}
                role="img"
                aria-label={`${day}: ${Math.floor(seconds / 60)} minutos${seconds >= library.settings.dailyGoal ? ", meta concluída" : ""}`}
                className={
                  seconds >= library.settings.dailyGoal
                    ? "heat-active"
                    : seconds > 0
                      ? "heat-partial"
                      : ""
                }
              />
            );
          })}
        </div>
        <div className="heatmap-legend">
          <span>Últimos quatro meses · America/Manaus</span>
          <span>
            Menos <i />
            <i className="heat-partial" />
            <i className="heat-active" /> Mais
          </span>
        </div>
      </section>
      <div className="stats-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TEMPO BEM ACOMPANHADO</span>
              <h2>Horas de escuta</h2>
            </div>
            <select
              aria-label="Agrupar tempo de escuta"
              value={group}
              onChange={(e) => setGroup(e.target.value as "week" | "month")}
            >
              <option value="week">Por semana</option>
              <option value="month">Por mês</option>
            </select>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={`Horas de escuta por ${group === "week" ? "semana" : "mês"}. ${bars.map((b) => `${b.label}: ${(b.seconds / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} horas`).join("; ")}`}
          >
            {bars.map((b, i) => (
              <div
                key={i}
                title={`${b.label}: ${(b.seconds / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} horas`}
              >
                <span>
                  {(b.seconds / 3600).toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}
                  h
                </span>
                <div
                  style={{
                    height: `${Math.max(2, (b.seconds / max) * 160)}px`,
                  }}
                />
                <small>{b.label}</small>
              </div>
            ))}
          </div>
          <p className="muted chart-note">
            {group === "week"
              ? "Últimas 12 semanas (início na segunda-feira), dentro do filtro selecionado."
              : "Últimos 12 meses, dentro do filtro selecionado."}
          </p>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SUAS MELHORES COMPANHIAS</span>
              <h2>Top 5 podcasts</h2>
            </div>
            <span>↗</span>
          </div>
          {top.length ? (
            top.map((p, i) => (
              <div key={p.id} className="top-podcast">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <Cover src={p.image} title="" />
                <div>
                  <b>{p.title}</b>
                  <div className="goal-bar">
                    <span
                      style={{
                        width: `${(p.seconds / top[0].seconds) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <small>
                  {(p.seconds / 3600).toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  h
                </small>
              </div>
            ))
          ) : (
            <Empty title="Seus podcasts mais ouvidos aparecem aqui">
              Dê o play para começar a conhecer seu ritmo.
            </Empty>
          )}
        </section>
      </div>
      <p className="muted stats-footnote">
        Apenas o tempo efetivamente ouvido entra na conta. Pausas e saltos no
        áudio não somam minutos.
      </p>
    </div>
  );
}
