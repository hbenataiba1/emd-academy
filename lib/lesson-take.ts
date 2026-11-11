// A recorded lesson ("a take") kept as encoded pieces, so parts can be cut out instantly and exactly,
// without re-encoding the video. The recorder (lesson-recorder.ts) makes a take, the editor cuts it,
// and buildTakeBlob() writes the final video file.

const US = 1_000_000;

export type Chunk = { ts: number; key: boolean; data: Uint8Array; dur: number };
export type TakeEvent = { t: number; kind: 'slide' | 'mode' | 'mistake'; value: string | number };

export type Take = {
  video: Chunk[];
  audio: Chunk[];
  /** How loud it is, one number per `levelStep` seconds (used for the sound wave and to find silences). */
  levels: number[];
  levelStep: number;
  /** Slide changes, switches between slides and screen, and the spots the instructor marked as mistakes. */
  events: TakeEvent[];
  width: number;
  height: number;
  videoCodec: string;
  videoMeta?: EncodedVideoChunkMetadata;
  audioMeta?: EncodedAudioChunkMetadata;
  sampleRate: number;
  channels: number;
};

export function takeDuration(take: Take) {
  const last = <T extends Chunk>(list: T[]) => (list.length ? list[list.length - 1].ts + list[list.length - 1].dur : 0);
  return Math.max(last(take.video), last(take.audio)) / US;
}

export function takeBytes(take: Take) {
  let total = 0;
  take.video.forEach((chunk) => (total += chunk.data.byteLength));
  take.audio.forEach((chunk) => (total += chunk.data.byteLength));
  return total;
}

/**
 * Where a cut may end. A video can only start playing at a "key picture", so the end of a cut moves
 * forward to the next one (at most half a second later). The start of a cut is exact.
 */
export function snapToKeyframe(take: Take, seconds: number) {
  const us = seconds * US;
  const key = take.video.find((chunk) => chunk.key && chunk.ts >= us - 1);
  return key ? key.ts / US : takeDuration(take);
}

/** Removes the part between `a` and `b` (seconds). Returns a new take; the old one is not changed. */
export function cutRange(take: Take, a: number, b: number): Take {
  const total = takeDuration(take);
  const start = Math.max(0, Math.min(a, total));
  const end = Math.min(total, snapToKeyframe(take, Math.max(b, start)));
  if (end - start < 0.02) return take;

  const startUs = Math.round(start * US);
  const endUs = Math.round(end * US);
  const shift = endUs - startUs;
  const keep = (chunk: Chunk) => chunk.ts < startUs || chunk.ts >= endUs;
  const move = (chunk: Chunk): Chunk => (chunk.ts >= endUs ? { ...chunk, ts: chunk.ts - shift } : chunk);

  const gap = end - start;
  const events: TakeEvent[] = [];
  take.events.forEach((event) => {
    if (event.t < start) events.push(event);
    else if (event.t >= end) events.push({ ...event, t: event.t - gap });
  });
  // what was on the stage at the end of the cut stays known after it
  (['mode', 'slide'] as const).forEach((kind) => {
    const inside = take.events.filter((event) => event.kind === kind && event.t >= start && event.t < end);
    if (inside.length > 0) events.push({ t: start, kind, value: inside[inside.length - 1].value });
  });
  events.sort((x, y) => x.t - y.t);

  const first = Math.floor(start / take.levelStep);
  const last = Math.ceil(end / take.levelStep);

  return {
    ...take,
    video: take.video.filter(keep).map(move),
    audio: take.audio.filter(keep).map(move),
    levels: [...take.levels.slice(0, first), ...take.levels.slice(last)],
    events,
  };
}

/** Removes several parts at once (from the last to the first, so the times stay right). */
export function cutRanges(take: Take, ranges: { start: number; end: number }[]) {
  return [...ranges]
    .sort((x, y) => y.start - x.start)
    .reduce((current, range) => cutRange(current, range.start, range.end), take);
}

/** Quiet moments (no talking) longer than `minSeconds`, with a short pause kept on each side. */
export function findSilences(take: Take, { minSeconds = 1.5, keep = 0.25 } = {}) {
  const { levels, levelStep } = take;
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((x, y) => x - y);
  const loud = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const threshold = Math.max(0.006, loud * 0.08);

  const spans: { start: number; end: number }[] = [];
  let from = -1;
  for (let i = 0; i <= levels.length; i += 1) {
    const quiet = i < levels.length && levels[i] < threshold;
    if (quiet && from < 0) from = i;
    if (!quiet && from >= 0) {
      const start = from * levelStep;
      const end = i * levelStep;
      if (end - start >= minSeconds && end - start - keep * 2 >= 0.5) spans.push({ start: start + keep, end: end - keep });
      from = -1;
    }
  }
  return spans;
}

/* ---- writing the video file (WebM) ---- */
type MuxerLib = {
  Muxer: new (options: Record<string, unknown>) => {
    addVideoChunkRaw(data: Uint8Array, type: 'key' | 'delta', timestamp: number, meta?: unknown): void;
    addAudioChunkRaw(data: Uint8Array, type: 'key' | 'delta', timestamp: number, meta?: unknown): void;
    finalize(): void;
  };
  ArrayBufferTarget: new () => { buffer: ArrayBuffer };
};

let muxerPromise: Promise<MuxerLib> | null = null;
function loadMuxer() {
  muxerPromise ??= new Promise<MuxerLib>((resolve, reject) => {
    const holder = window as unknown as { WebMMuxer?: MuxerLib };
    if (holder.WebMMuxer) return resolve(holder.WebMMuxer);
    const script = document.createElement('script');
    script.src = '/academy/vendor/webm-muxer.js';
    script.onload = () => (holder.WebMMuxer ? resolve(holder.WebMMuxer) : reject(new Error('The video writer could not be loaded.')));
    script.onerror = () => {
      muxerPromise = null;
      reject(new Error('The video writer could not be loaded.'));
    };
    document.head.appendChild(script);
  });
  return muxerPromise;
}

export async function buildTakeBlob(take: Take): Promise<Blob> {
  const lib = await loadMuxer();
  const target = new lib.ArrayBufferTarget();
  const muxer = new lib.Muxer({
    target,
    video: { codec: take.videoCodec, width: take.width, height: take.height, frameRate: 30 },
    audio: take.audio.length > 0 ? { codec: 'A_OPUS', numberOfChannels: take.channels, sampleRate: take.sampleRate } : undefined,
    firstTimestampBehavior: 'offset',
  });

  // video and sound pieces go in by time, one after the other
  let v = 0;
  let a = 0;
  while (v < take.video.length || a < take.audio.length) {
    const videoNext = a >= take.audio.length || (v < take.video.length && take.video[v].ts <= take.audio[a].ts);
    if (videoNext) {
      const chunk = take.video[v];
      muxer.addVideoChunkRaw(chunk.data, chunk.key ? 'key' : 'delta', chunk.ts, v === 0 ? take.videoMeta : undefined);
      v += 1;
    } else {
      const chunk = take.audio[a];
      muxer.addAudioChunkRaw(chunk.data, 'key', chunk.ts, a === 0 ? take.audioMeta : undefined);
      a += 1;
    }
  }

  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/webm' });
}
