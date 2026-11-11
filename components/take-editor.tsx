'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, LoaderCircle, Play, Scissors, Undo2, VolumeX } from 'lucide-react';

import { buildTakeBlob, findSilences, snapToKeyframe, takeDuration, type Take } from '@/lib/lesson-take';

/**
 * Edits a recorded lesson: a timeline with the sound wave, the slide changes and the spots marked as
 * mistakes; select a part (drag on the timeline) and delete it. Quiet moments are found automatically.
 */

const HEIGHT = 104;

const clock = (seconds: number) => {
  const total = Math.max(0, seconds);
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, '0')}`;
};
const precise = (seconds: number) => `${clock(seconds)}.${String(Math.floor((seconds % 1) * 10))}`;

export function TakeEditor({
  take,
  canUndo,
  onCut,
  onCutMany,
  onUndo,
}: {
  take: Take;
  canUndo: boolean;
  onCut: (start: number, end: number) => void;
  onCutMany: (ranges: { start: number; end: number }[]) => void;
  onUndo: () => void;
}) {
  const duration = useMemo(() => takeDuration(take), [take]);
  const silences = useMemo(() => findSilences(take), [take]);
  const mistakes = useMemo(() => take.events.filter((event) => event.kind === 'mistake'), [take]);

  const [url, setUrl] = useState('');
  const [building, setBuilding] = useState(true);
  const [width, setWidth] = useState(800);
  const [time, setTime] = useState(0);
  const [selection, setSelection] = useState<{ a: number; b: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const urlRef = useRef('');
  const resumeAt = useRef(0);
  const stopAt = useRef<number | null>(null);
  const drag = useRef<{ type: 'a' | 'b' | 'new'; anchor: number; startX: number; moved: boolean } | null>(null);

  /* the video to watch: made again after every cut */
  useEffect(() => {
    let cancelled = false;
    setBuilding(true);
    buildTakeBlob(take)
      .then((blob) => {
        if (cancelled) return;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setUrl(urlRef.current);
        setBuilding(false);
      })
      .catch(() => !cancelled && setBuilding(false));
    return () => {
      cancelled = true;
    };
  }, [take]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  /* the width of the timeline */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setWidth(Math.max(300, Math.round(box.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  /* the playhead follows the video */
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const video = videoRef.current;
      if (video) {
        setTime((previous) => (Math.abs(previous - video.currentTime) > 0.015 ? video.currentTime : previous));
        if (stopAt.current !== null && video.currentTime >= stopAt.current) {
          video.pause();
          stopAt.current = null;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  /* the sound wave, the parts shown on the screen, the slide changes, the quiet moments */
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || duration <= 0) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = HEIGHT * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.fillStyle = '#0f0b18';
    context.fillRect(0, 0, width, HEIGHT);

    const x = (seconds: number) => (seconds / duration) * width;

    // the parts where the screen was shown
    const modes = take.events.filter((event) => event.kind === 'mode');
    modes.forEach((event, index) => {
      if (event.value !== 'screen') return;
      const end = modes[index + 1]?.t ?? duration;
      context.fillStyle = 'rgba(52,212,198,0.16)';
      context.fillRect(x(event.t), 0, Math.max(2, x(end) - x(event.t)), HEIGHT);
    });

    // quiet moments
    silences.forEach((span) => {
      context.fillStyle = 'rgba(239,68,68,0.2)';
      context.fillRect(x(span.start), 0, Math.max(2, x(span.end) - x(span.start)), HEIGHT);
    });

    // the sound wave
    const sorted = [...take.levels].sort((p, q) => p - q);
    const loud = Math.max(0.02, (sorted[Math.floor(sorted.length * 0.95)] || 0) * 1.25);
    const mid = HEIGHT / 2 + 4;
    context.fillStyle = '#a78bfa';
    for (let px = 0; px < width; px += 2) {
      const from = Math.floor(((px / width) * duration) / take.levelStep);
      const to = Math.max(from + 1, Math.ceil((((px + 2) / width) * duration) / take.levelStep));
      let peak = 0;
      for (let i = from; i < to && i < take.levels.length; i += 1) peak = Math.max(peak, take.levels[i]);
      const h = Math.max(1.5, Math.min(1, peak / loud) * (HEIGHT - 34));
      context.fillRect(px, mid - h / 2, 1.5, h);
    }

    // the slide changes, with the slide number
    context.font = '600 10px system-ui, sans-serif';
    let lastLabel = -100;
    take.events.forEach((event) => {
      if (event.kind !== 'slide') return;
      const px = x(event.t);
      context.fillStyle = 'rgba(255,255,255,0.3)';
      context.fillRect(px, 0, 1, HEIGHT);
      if (px - lastLabel >= 18) {
        context.fillStyle = '#34d4c6';
        context.fillText(String(event.value), px + 3, 11);
        lastLabel = px;
      }
    });

    // the spots marked as mistakes
    take.events.forEach((event) => {
      if (event.kind !== 'mistake') return;
      const px = x(event.t);
      context.fillStyle = '#ef4444';
      context.fillRect(px - 1, 0, 2, HEIGHT);
      context.beginPath();
      context.moveTo(px - 6, 0);
      context.lineTo(px + 6, 0);
      context.lineTo(px, 10);
      context.fill();
    });
  }, [take, duration, silences, width]);

  /* ---- playing and cutting ---- */
  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, Math.min(duration, seconds));
  };

  const cut = (start: number, end: number) => {
    resumeAt.current = Math.max(0, start);
    setSelection(null);
    onCut(start, end);
  };

  const cutSelection = () => {
    if (selection && selection.b - selection.a >= 0.1) cut(selection.a, selection.b);
  };

  const playSelection = () => {
    const video = videoRef.current;
    if (!video || !selection) return;
    video.currentTime = selection.a;
    stopAt.current = selection.b;
    void video.play();
  };

  const showSpan = (start: number, end: number) => {
    setSelection({ a: start, b: snapToKeyframe(take, end) });
    seek(Math.max(0, start - 0.6));
  };

  // keys: I and O mark the start and the end, Delete removes, Ctrl+Z goes back
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (canUndo) onUndo();
      } else if (event.key === 'i' || event.key === 'I') {
        setSelection((current) => ({ a: time, b: Math.max(current?.b ?? time + 1, time + 0.2) }));
      } else if (event.key === 'o' || event.key === 'O') {
        setSelection((current) => ({ a: Math.min(current?.a ?? Math.max(0, time - 1), time - 0.2), b: snapToKeyframe(take, time) }));
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        cutSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---- the timeline: click to go there, drag to select, drag the ends to change ---- */
  const timeAt = (clientX: number) => {
    const box = boxRef.current;
    if (!box) return 0;
    const rect = box.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
  };

  const down = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    if (!box || duration <= 0) return;
    box.setPointerCapture(event.pointerId);
    const rect = box.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const t = timeAt(event.clientX);

    if (selection) {
      const aX = (selection.a / duration) * rect.width;
      const bX = (selection.b / duration) * rect.width;
      if (Math.abs(px - aX) <= 9) drag.current = { type: 'a', anchor: t, startX: px, moved: true };
      else if (Math.abs(px - bX) <= 9) drag.current = { type: 'b', anchor: t, startX: px, moved: true };
    }
    drag.current ??= { type: 'new', anchor: t, startX: px, moved: false };
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const box = boxRef.current;
    if (!state || !box) return;
    const t = timeAt(event.clientX);
    const px = event.clientX - box.getBoundingClientRect().left;

    if (state.type === 'a') {
      setSelection((current) => current && { a: Math.min(t, current.b - 0.1), b: current.b });
    } else if (state.type === 'b') {
      setSelection((current) => current && { a: current.a, b: Math.max(snapToKeyframe(take, t), current.a + 0.1) });
    } else if (Math.abs(px - state.startX) > 3) {
      state.moved = true;
      setSelection({ a: Math.min(state.anchor, t), b: snapToKeyframe(take, Math.max(state.anchor, t)) });
    }
  };

  const up = () => {
    const state = drag.current;
    drag.current = null;
    if (state?.type === 'new' && !state.moved) {
      setSelection(null);
      seek(state.anchor);
    }
  };

  // the ruler under the timeline
  const rulerStep = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((step) => (step / Math.max(duration, 1)) * width >= 70) ?? 600;
  const ticks = Array.from({ length: Math.floor(duration / rulerStep) + 1 }, (_, index) => index * rulerStep);

  const button = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-40';
  const silentTotal = silences.reduce((sum, span) => sum + (span.end - span.start), 0);
  const selected = selection && selection.b - selection.a >= 0.1;

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <video
          ref={videoRef}
          src={url || undefined}
          controls
          onLoadedMetadata={() => seek(resumeAt.current)}
          className="block aspect-video w-full bg-black"
        />
        {building ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 text-sm font-bold text-white">
            <LoaderCircle className="size-5 animate-spin" /> Applying your edit...
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-[#171322] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#b58dfb]">Cut out the parts you do not want</p>
          <p className="text-xs font-bold text-[#c4bdd8]">
            {clock(time)} / {clock(duration)}
          </p>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#c4bdd8]">
          Click the line to go there. <strong className="text-white">Drag on the line</strong> to select a part, then delete it.
        </p>

        {/* the timeline */}
        <div
          ref={boxRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="relative mt-3 w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-white/10"
          style={{ height: HEIGHT }}
        >
          <canvas ref={canvasRef} style={{ width: '100%', height: HEIGHT }} className="absolute inset-0" />

          {selection ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 border-x-2 border-[#34d4c6] bg-[#34d4c6]/25"
              style={{ left: `${(selection.a / duration) * 100}%`, width: `${((selection.b - selection.a) / duration) * 100}%` }}
            >
              <span className="absolute -left-[5px] top-1/2 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded bg-[#34d4c6]" />
              <span className="absolute -right-[5px] top-1/2 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded bg-[#34d4c6]" />
            </div>
          ) : null}

          <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow" style={{ left: `${duration > 0 ? (time / duration) * 100 : 0}%` }} />
        </div>

        <div className="relative mt-1 h-4 text-[10px] text-[#8e879f]">
          {ticks.map((tick) => (
            <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${(tick / Math.max(duration, 1)) * 100}%` }}>
              {clock(tick)}
            </span>
          ))}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#8e879f]">
          <span><span className="mr-1 inline-block size-2 rounded-sm bg-[#a78bfa]" />your voice</span>
          <span><span className="mr-1 inline-block size-2 rounded-sm bg-[#34d4c6]/40" />your screen was shown</span>
          <span><span className="mr-1 inline-block size-2 rounded-sm bg-[#ef4444]/40" />quiet</span>
          <span><span className="mr-1 text-[#34d4c6]">1 2 3</span>slide changes</span>
        </p>

        {/* what to do with the selection */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={cutSelection} disabled={!selected} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef4444] px-4 text-sm font-black text-white transition hover:bg-[#dc2626] disabled:opacity-40">
            <Scissors className="size-4" />
            {selected ? `Delete ${precise(selection.a)} to ${precise(selection.b)} (${(selection.b - selection.a).toFixed(1)} s)` : 'Delete the selected part'}
          </button>
          <button type="button" onClick={playSelection} disabled={!selected} className={button}>
            <Play className="size-3.5" /> Watch it first
          </button>
          <button type="button" onClick={onUndo} disabled={!canUndo} className={button}>
            <Undo2 className="size-3.5" /> Undo
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSelection({ a: time, b: Math.max(selection?.b ?? time + 1, time + 0.2) })} className={button}>
            Start here
          </button>
          <button type="button" onClick={() => setSelection({ a: Math.min(selection?.a ?? Math.max(0, time - 1), time - 0.2), b: snapToKeyframe(take, time) })} className={button}>
            End here
          </button>
          <button type="button" onClick={() => cut(0, time)} disabled={time < 0.3} className={button}>
            Delete everything before here
          </button>
          <button type="button" onClick={() => cut(time, duration)} disabled={duration - time < 0.3} className={button}>
            Delete everything after here
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#8e879f]">
          Keys: <strong>I</strong> start, <strong>O</strong> end, <strong>Delete</strong> remove, <strong>Ctrl+Z</strong> undo. A cut starts exactly where you
          choose and ends within half a second.
        </p>

        {/* finding the parts */}
        {silences.length > 0 || mistakes.length > 0 ? (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
            {mistakes.length > 0 ? (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-black text-white">
                  <Flag className="size-3.5 text-[#ef4444]" /> You marked {mistakes.length} mistake{mistakes.length === 1 ? '' : 's'} while recording
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mistakes.map((mistake, index) => (
                    <button
                      key={`${mistake.t}-${index}`}
                      type="button"
                      onClick={() => {
                        seek(Math.max(0, mistake.t - 5));
                        setSelection({ a: Math.max(0, mistake.t - 5), b: snapToKeyframe(take, mistake.t + 0.5) });
                      }}
                      className={button}
                      title="Selects the 5 seconds before the mark, ready to watch and delete"
                    >
                      {clock(mistake.t)}: select the 5 s before
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {silences.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-black text-white">
                    <VolumeX className="size-3.5 text-[#ef4444]" /> {silences.length} quiet moment{silences.length === 1 ? '' : 's'} found ({silentTotal.toFixed(0)} s in total)
                  </p>
                  <button type="button" onClick={() => onCutMany(silences)} className={button}>
                    Delete all quiet moments
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {silences.map((span, index) => (
                    <span key={`${span.start}-${index}`} className="inline-flex items-center overflow-hidden rounded-lg border border-white/15 text-xs font-bold">
                      <button type="button" onClick={() => showSpan(span.start, span.end)} className="bg-white/5 px-3 py-2 hover:bg-white/10">
                        {clock(span.start)} · {(span.end - span.start).toFixed(1)} s
                      </button>
                      <button type="button" onClick={() => cut(span.start, span.end)} className="border-l border-white/15 bg-[#ef4444]/20 px-2.5 py-2 text-[#ffb4b4] hover:bg-[#ef4444]/35" aria-label="Delete this quiet moment">
                        <Scissors className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
