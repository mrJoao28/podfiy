"use client";

import { useRef, useState, type PointerEvent } from "react";
import { formatTime } from "@/lib/stats";

/** A drag previews locally; only its release changes the audio position. */
export function ProgressRing({
  position,
  duration,
  onSeek,
}: {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const pointer = useRef<number | null>(null);
  const value = Math.min(duration, Math.max(0, preview ?? position));
  const angle = (duration ? value / duration : 0) * Math.PI * 2 - Math.PI / 2;
  const circumference = 2 * Math.PI * 154;
  function timeAt(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    return (
      (((Math.atan2(y, x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)) /
        (2 * Math.PI)) *
      duration
    );
  }
  return (
    <svg
      viewBox="0 0 320 320"
      className="progress-ring"
      role="slider"
      aria-label="Posição do episódio"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={value}
      aria-valuetext={`${formatTime(value)} de ${formatTime(duration)}`}
      aria-disabled={duration <= 0}
      tabIndex={duration > 0 ? 0 : -1}
      onKeyDown={(event) => {
        const steps: Record<string, number> = {
          ArrowRight: 5,
          ArrowUp: 5,
          ArrowLeft: -5,
          ArrowDown: -5,
          PageUp: 30,
          PageDown: -30,
        };
        let next: number;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = duration;
        else if (event.key in steps) next = position + steps[event.key];
        else return;
        event.preventDefault();
        if (duration > 0) onSeek(Math.max(0, Math.min(duration, next)));
      }}
      onPointerDown={(event) => {
        if (duration <= 0 || event.button !== 0 || !event.isPrimary) return;
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        setPreview(timeAt(event));
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) setPreview(timeAt(event));
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return;
        onSeek(timeAt(event));
        pointer.current = null;
        setPreview(null);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        pointer.current = null;
        setPreview(null);
      }}
      onLostPointerCapture={() => {
        pointer.current = null;
        setPreview(null);
      }}
    >
      <circle
        cx="160"
        cy="160"
        r="154"
        fill="none"
        stroke="var(--line)"
        strokeWidth="2"
      />
      <circle
        cx="160"
        cy="160"
        r="154"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={
          circumference * (1 - (duration ? value / duration : 0))
        }
        transform="rotate(-90 160 160)"
        strokeLinecap="round"
      />
      <circle
        cx={160 + 154 * Math.cos(angle)}
        cy={160 + 154 * Math.sin(angle)}
        r="5"
        fill="var(--accent)"
        stroke="var(--bg)"
        strokeWidth="2"
      />
    </svg>
  );
}
