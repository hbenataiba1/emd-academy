'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Award } from 'lucide-react';

const AUTO_CONTINUE_MS = 8000;
const COLORS = ['#7c3aed', '#b58dfb', '#34d4c6', '#f6b44b', '#ffffff', '#ff6b81'];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  round: boolean;
  life: number;
};

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const width = () => window.innerWidth;
    const height = () => window.innerHeight;
    const particles: Particle[] = [];

    const spawn = (x: number, y: number, vx: number, vy: number): Particle => ({
      x,
      y,
      vx,
      vy,
      size: 6 + Math.random() * 7,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.3,
      life: 1,
    });

    // Two cannons from the bottom corners.
    const burst = () => {
      for (let i = 0; i < 80; i += 1) {
        const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.9;
        const speed = 13 + Math.random() * 11;
        particles.push(spawn(width() * 0.05, height() + 10, Math.cos(angle) * speed + 3, Math.sin(angle) * speed));
        particles.push(spawn(width() * 0.95, height() + 10, Math.cos(angle) * speed - 3, Math.sin(angle) * speed));
      }
    };

    burst();
    const second = window.setTimeout(burst, 700);

    let frame = 0;
    let raf = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      context.clearRect(0, 0, width(), height());
      frame += 1;

      // A gentle rain of confetti for the first few seconds.
      if (now - startedAt < 3500 && frame % 3 === 0) {
        particles.push(spawn(Math.random() * width(), -12, (Math.random() - 0.5) * 2, 2 + Math.random() * 2.5));
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.vy += 0.28;
        p.vx *= 0.992;
        p.vy *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        if (p.y > height() + 40) p.life -= 0.08;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        context.save();
        context.globalAlpha = Math.max(p.life, 0);
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.fillStyle = p.color;
        if (p.round) {
          context.beginPath();
          context.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        context.restore();
      }

      if (particles.length > 0 || now - startedAt < 3500) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    raf = window.requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(second);
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
}

function useCountUp(target: number, durationMs = 1300, delayMs = 500) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    let raf = 0;
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - start) / durationMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) raf = window.requestAnimationFrame(step);
      };
      raf = window.requestAnimationFrame(step);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
    };
  }, [target, durationMs, delayMs]);

  return value;
}

/**
 * Full-screen celebration shown when a learner passes the exam, before the
 * certificate is revealed. It continues by itself after a few seconds.
 */
export function ExamCelebration({
  score,
  courseTitle,
  onContinue,
}: {
  score: number;
  courseTitle: string;
  onContinue: () => void;
}) {
  const shownScore = useCountUp(score);
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;

  useEffect(() => {
    const timer = window.setTimeout(() => continueRef.current(), AUTO_CONTINUE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Exam passed"
      className="celebrate-backdrop fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,#2a1457_0%,#120b25_55%,#07040f_100%)] px-4"
    >
      <div className="celebrate-glow pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7c3aed]/30 blur-3xl" />
      <Confetti />

      <div className="relative z-10 flex max-w-xl flex-col items-center text-center">
        <div className="celebrate-pop relative flex size-32 items-center justify-center">
          <span className="celebrate-pulse absolute inset-0 rounded-full border-2 border-[#34d4c6]/60" />
          <span className="celebrate-pulse celebrate-pulse-late absolute inset-0 rounded-full border-2 border-[#b58dfb]/50" />
          <svg viewBox="0 0 120 120" className="relative size-32" aria-hidden="true">
            <defs>
              <linearGradient id="celebrate-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d4c6" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="52" fill="#171322" stroke="url(#celebrate-ring)" strokeWidth="5" className="celebrate-ring" />
            <path
              d="M38 62 L54 77 L84 45"
              fill="none"
              stroke="#ffffff"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="celebrate-check"
            />
          </svg>
        </div>

        <p className="celebrate-rise mt-8 text-xs font-black uppercase tracking-[0.3em] text-[#34d4c6]" style={{ animationDelay: '0.5s' }}>
          Exam passed
        </p>
        <h2 className="celebrate-rise mt-3 bg-gradient-to-r from-white via-[#d8c6ff] to-[#34d4c6] bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl" style={{ animationDelay: '0.65s' }}>
          Congratulations!
        </h2>
        <p className="celebrate-rise mt-4 max-w-md text-base leading-7 text-[#cfc7e4]" style={{ animationDelay: '0.85s' }}>
          You earned your certificate for <span className="font-bold text-white">{courseTitle}</span>.
        </p>

        <div className="celebrate-rise mt-7 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 backdrop-blur" style={{ animationDelay: '1s' }}>
          <Award className="size-6 text-[#f6b44b]" aria-hidden="true" />
          <span className="text-sm font-semibold text-[#cfc7e4]">Your score</span>
          <span className="text-3xl font-black tabular-nums text-white">{shownScore}%</span>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="celebrate-rise group relative mt-9 inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#7c3aed] px-8 text-sm font-black text-white shadow-lg shadow-[#7c3aed]/40 transition hover:bg-[#6d31dc]"
          style={{ animationDelay: '1.5s' }}
        >
          <span className="relative z-10">View my certificate</span>
          <ArrowRight className="relative z-10 size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
          <span
            className="celebrate-countdown absolute inset-x-0 bottom-0 h-1 origin-left bg-white/40"
            style={{ animationDuration: `${AUTO_CONTINUE_MS}ms`, animationDelay: '1.5s' }}
          />
        </button>
      </div>
    </div>
  );
}
