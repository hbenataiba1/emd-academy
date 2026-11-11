// Records the studio picture (a canvas) and the sound with the browser's video and audio encoders and keeps
// the encoded pieces, so the recording can be edited afterwards (see lesson-take.ts).
// A "key picture" is made every half second: that is what allows cutting parts out without re-encoding.

import type { Chunk, Take, TakeEvent } from '@/lib/lesson-take';

const KEY_EVERY_FRAMES = 15; // 0.5 s at 30 pictures per second
const FRAME_US = 33_333;
const LEVEL_STEP = 0.05; // seconds per loudness number
const SAMPLE_RATE = 48_000;
const BLOCK = 960; // 20 ms of sound

// Receives the sound in small blocks and sends them to the recorder.
const WORKLET = `
class LessonCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Float32Array(${BLOCK}); this.count = 0; }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const left = input[0];
      const right = input[1] || left;
      for (let i = 0; i < left.length; i += 1) {
        this.buffer[this.count] = (left[i] + right[i]) / 2;
        this.count += 1;
        if (this.count === ${BLOCK}) {
          this.port.postMessage(this.buffer);
          this.buffer = new Float32Array(${BLOCK});
          this.count = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('lesson-capture', LessonCapture);
`;

export type VideoChoice = { codec: string; muxerCodec: string };

export class LessonRecorder {
  /** Does this browser have what recording needs (Chrome or Edge), and which video format can it use? */
  static async check(width: number, height: number, bitrate: number): Promise<VideoChoice | null> {
    if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined' || typeof VideoFrame === 'undefined' || typeof AudioData === 'undefined') {
      return null;
    }
    try {
      const audio = await AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 1, bitrate: 64_000 });
      if (!audio.supported) return null;
      const options: VideoChoice[] = [
        { codec: 'vp09.00.40.08', muxerCodec: 'V_VP9' },
        { codec: 'vp8', muxerCodec: 'V_VP8' },
      ];
      for (const option of options) {
        const result = await VideoEncoder.isConfigSupported({ codec: option.codec, width, height, bitrate, framerate: 30 });
        if (result.supported) return option;
      }
    } catch {
      return null;
    }
    return null;
  }

  private state: 'idle' | 'recording' | 'paused' | 'stopped' = 'idle';
  private video: VideoEncoder | null = null;
  private audio: AudioEncoder | null = null;
  private videoChunks: Chunk[] = [];
  private audioChunks: Chunk[] = [];
  private videoMeta: EncodedVideoChunkMetadata | undefined;
  private audioMeta: EncodedAudioChunkMetadata | undefined;
  private levels: number[] = [];
  private levelSum = 0;
  private levelCount = 0;
  private events: TakeEvent[] = [];
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private frames = 0;
  private samples = 0;
  private node: AudioWorkletNode | null = null;
  private silent: GainNode | null = null;
  private workletUrl = '';
  private failure: Error | null = null;
  bytes = 0;

  constructor(
    private options: {
      canvas: HTMLCanvasElement;
      audioContext: AudioContext;
      /** Everything that should be heard (the microphone, the shared screen's sound) is connected here. */
      audioBus: AudioNode;
      width: number;
      height: number;
      bitrate: number;
      choice: VideoChoice;
    },
  ) {}

  /** Seconds recorded so far (a pause does not count). */
  get elapsed() {
    if (this.state === 'idle') return 0;
    const now = this.state === 'paused' ? this.pausedAt : performance.now();
    return Math.max(0, (now - this.startedAt - this.pausedTotal) / 1000);
  }

  get error() {
    return this.failure;
  }

  async start() {
    const { audioContext, audioBus, width, height, bitrate, choice } = this.options;

    this.video = new VideoEncoder({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.videoChunks.push({ ts: chunk.timestamp, key: chunk.type === 'key', data, dur: chunk.duration ?? FRAME_US });
        this.bytes += data.byteLength;
        if (!this.videoMeta && meta) this.videoMeta = { decoderConfig: meta.decoderConfig };
      },
      error: (error) => (this.failure = error),
    });
    this.video.configure({ codec: choice.codec, width, height, bitrate, framerate: 30, latencyMode: 'realtime', bitrateMode: 'variable' });

    this.audio = new AudioEncoder({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.audioChunks.push({ ts: chunk.timestamp, key: true, data, dur: chunk.duration ?? 20_000 });
        this.bytes += data.byteLength;
        if (!this.audioMeta && meta) this.audioMeta = { decoderConfig: meta.decoderConfig };
      },
      error: (error) => (this.failure = error),
    });
    this.audio.configure({ codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 1, bitrate: 64_000 });

    this.workletUrl = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
    await audioContext.audioWorklet.addModule(this.workletUrl);
    this.node = new AudioWorkletNode(audioContext, 'lesson-capture', { channelCount: 2, channelCountMode: 'explicit' });
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => this.onSound(event.data);
    // the node only runs when it is connected to the output; a gain of 0 keeps it silent
    this.silent = audioContext.createGain();
    this.silent.gain.value = 0;
    audioBus.connect(this.node);
    this.node.connect(this.silent);
    this.silent.connect(audioContext.destination);

    this.startedAt = performance.now();
    this.state = 'recording';
  }

  /** Called about 30 times a second: takes one picture of the canvas. */
  captureFrame() {
    if (this.state !== 'recording' || !this.video || this.video.state !== 'configured') return;
    if (this.video.encodeQueueSize > 12) return; // the computer is busy: skip this picture

    const frame = new VideoFrame(this.options.canvas, { timestamp: Math.round(this.elapsed * 1_000_000), duration: FRAME_US });
    try {
      this.video.encode(frame, { keyFrame: this.frames % KEY_EVERY_FRAMES === 0 });
      this.frames += 1;
    } finally {
      frame.close();
    }
  }

  private onSound(block: Float32Array) {
    if (this.state !== 'recording' || !this.audio || this.audio.state !== 'configured') return;

    let sum = 0;
    for (let i = 0; i < block.length; i += 1) sum += block[i] * block[i];
    this.levelSum += sum;
    this.levelCount += block.length;
    const perLevel = SAMPLE_RATE * LEVEL_STEP;
    while (this.levelCount >= perLevel) {
      this.levels.push(Math.sqrt(this.levelSum / this.levelCount));
      this.levelSum = 0;
      this.levelCount = 0;
    }

    const data = new AudioData({
      format: 'f32-planar',
      sampleRate: SAMPLE_RATE,
      numberOfFrames: block.length,
      numberOfChannels: 1,
      timestamp: Math.round((this.samples * 1_000_000) / SAMPLE_RATE),
      data: block as unknown as BufferSource,
    });
    this.audio.encode(data);
    data.close();
    this.samples += block.length;
  }

  pause() {
    if (this.state !== 'recording') return;
    this.pausedAt = performance.now();
    this.state = 'paused';
  }

  resume() {
    if (this.state !== 'paused') return;
    this.pausedTotal += performance.now() - this.pausedAt;
    this.state = 'recording';
  }

  /** Notes what happens on the stage, to find the spots again when editing. */
  mark(kind: TakeEvent['kind'], value: string | number) {
    if (this.state === 'idle' || this.state === 'stopped') return;
    this.events.push({ t: this.elapsed, kind, value });
  }

  async stop(): Promise<Take> {
    this.state = 'stopped';
    await Promise.all([this.video?.flush(), this.audio?.flush()]);
    if (this.levelCount > 0) this.levels.push(Math.sqrt(this.levelSum / this.levelCount));
    this.dispose();

    return {
      video: this.videoChunks,
      audio: this.audioChunks,
      levels: this.levels,
      levelStep: LEVEL_STEP,
      events: this.events,
      width: this.options.width,
      height: this.options.height,
      videoCodec: this.options.choice.muxerCodec,
      videoMeta: this.videoMeta,
      audioMeta: this.audioMeta,
      sampleRate: SAMPLE_RATE,
      channels: 1,
    };
  }

  dispose() {
    try {
      this.node?.disconnect();
      this.silent?.disconnect();
      this.options.audioBus.disconnect(this.node as AudioNode);
    } catch {
      // already disconnected
    }
    if (this.video && this.video.state !== 'closed') this.video.close();
    if (this.audio && this.audio.state !== 'closed') this.audio.close();
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl);
    this.workletUrl = '';
    this.state = 'stopped';
  }
}
