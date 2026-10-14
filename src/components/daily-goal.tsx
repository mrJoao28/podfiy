"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Flame } from "lucide-react";
import { useLibrary } from "./provider";
import { localDay, streak } from "@/lib/stats";

export function useToday() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return now;
}

export function DailyGoal({ compact = false }: { compact?: boolean }) {
  const { library } = useLibrary();
  const now = useToday();
  const sequence = streak(library.sessions, library.settings.dailyGoal, now);
  const seconds = sequence.days[localDay(now)] ?? 0;
  const goal = library.settings.dailyGoal;
  const achieved = seconds >= goal;
  return (
    <section
      className={`daily-goal ${compact ? "daily-goal-compact panel" : "streak-card"}`}
      aria-label="Sua meta diária de escuta"
    >
      <div className="streak-card-top">
        <span className="eyebrow">UM HÁBITO QUE FAZ BEM</span>
        <Flame size={21} aria-hidden="true" />
      </div>
      <div className="streak-number">
        {sequence.current}
        <span>{sequence.current === 1 ? "dia" : "dias"} em sequência</span>
      </div>
      <h3>
        {achieved ? "Meta de hoje concluída." : "A curiosidade não para."}
      </h3>
      <p>
        {achieved
          ? "Mais uma história na sua sequência."
          : "Ouça um pouquinho hoje, no seu ritmo."}
      </p>
      <div
        className="goal-bar"
        role="progressbar"
        aria-label="Meta diária"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(goal, Math.floor(seconds))}
        aria-valuetext={`${Math.floor(seconds / 60)} de ${Math.ceil(goal / 60)} minutos`}
      >
        <span style={{ width: `${Math.min(100, (seconds / goal) * 100)}%` }} />
      </div>
      <div className="goal-caption">
        <span>Meta de hoje</span>
        <b>
          {achieved && <Check size={12} aria-hidden="true" />}
          {Math.floor(seconds / 60)}/{Math.ceil(goal / 60)} min
        </b>
      </div>
      {!compact && (
        <Link href="/estatisticas">
          Meu progresso <ArrowRight size={15} />
        </Link>
      )}
    </section>
  );
}

/** Announce a newly completed goal once, without interrupting playback. */
export function GoalMilestone() {
  const { library, ready, user } = useLibrary();
  const now = useToday();
  const day = localDay(now);
  const achieved =
    (streak(library.sessions, library.settings.dailyGoal, now).days[day] ??
      0) >= library.settings.dailyGoal;
  const key = `${user?.id ?? "local"}:${day}:${library.settings.dailyGoal}`;
  const previous = useRef<{ key: string; achieved: boolean } | null>(null);
  const [notice, setNotice] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!ready) return;
    if (previous.current?.key === key && !previous.current.achieved && achieved)
      setNotice(true);
    if (previous.current?.key !== key) setNotice(false);
    previous.current = { key, achieved };
  }, [ready, key, achieved]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!mounted) return null;
  return createPortal(
    <div
      className={`goal-milestone ${notice ? "visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      {notice && (
        <>
          <Flame size={18} aria-hidden="true" />
          <span>Meta de hoje concluída. Bom te ouvir por aqui.</span>
        </>
      )}
    </div>,
    document.querySelector("dialog[open]") ?? document.body,
  );
}
