'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  CameraOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Eraser,
  FileText,
  Flag,
  LoaderCircle,
  Mic,
  Monitor,
  Pause,
  Pencil,
  PictureInPicture2,
  Play,
  Presentation,
  RotateCcw,
  Square,
  Trash2,
  Undo2,
  Volume2,
  X,
} from 'lucide-react';

import { TakeEditor } from '@/components/take-editor';
import { LessonRecorder } from '@/lib/lesson-recorder';
import { buildTakeBlob, cutRange, cutRanges, takeBytes, takeDuration, type Take } from '@/lib/lesson-take';

/**
 * A small recording studio for instructors. The instructor shows slides (a PDF) and/or shares a window or
 * screen, with their camera in a small bubble in a corner, like a streaming setup. While recording they can
 * switch between the slides and their screen as often as they like. Everything is drawn on one canvas and
 * recorded in the browser: the recording is what the preview shows.
 */

type Mode = 'slides' | 'screen';
type Phase = 'setup' | 'countdown' | 'recording' | 'paused' | 'review';
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type BubbleSize = 's' | 'm' | 'l';
type Shape = 'circle' | 'rounded';
type Quality = '720p' | '1080p';

const QUALITY: Record<Quality, { w: number; h: number; bps: number; mbPerMinute: number }> = {
  '720p': { w: 1280, h: 720, bps: 2_500_000, mbPerMinute: 19 },
  '1080p': { w: 1920, h: 1080, bps: 5_000_000, mbPerMinute: 38 },
};
const BUBBLE: Record<BubbleSize, number> = { s: 0.2, m: 0.28, l: 0.38 };
const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/* ---- camera and microphone problems ---- */
type DeviceKind = 'camera' | 'microphone';
type Issue = { kind: 'blocked' | 'ask' | 'missing' | 'busy' | 'unplugged' | 'silent' | 'other'; title: string; help: string; button: string };

// Turns what the browser says into a clear problem and what to do about it.
async function explainDevice(device: DeviceKind, error: unknown): Promise<Issue> {
  const name = (error as { name?: string } | null)?.name ?? '';
  const other = device === 'camera' ? 'another camera' : 'another microphone';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    let state = 'prompt';
    try {
      const result = await navigator.permissions.query({ name: (device === 'camera' ? 'camera' : 'microphone') as PermissionName });
      state = result.state;
    } catch {
      // the browser cannot tell us
    }
    if (state === 'denied') {
      return {
        kind: 'blocked',
        title: `The ${device} is blocked for this website`,
        help: `Click the lock icon at the left of the address bar, switch "${device === 'camera' ? 'Camera' : 'Microphone'}" to Allow, then press the button below.`,
        button: 'I allowed it, try again',
      };
    }
    return {
      kind: 'ask',
      title: `Please allow the ${device}`,
      help: 'Press the button, then choose "Allow" in the question your browser shows at the top left.',
      button: `Allow the ${device}`,
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return {
      kind: 'missing',
      title: `No ${device} found`,
      help: `Plug in a ${device} (or switch it on), or choose ${other} in the list if you have one. Then press the button below.`,
      button: 'Look again',
    };
  }
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') {
    return {
      kind: 'busy',
      title: `The ${device} is used by another program`,
      help: `Close the programs that may be using it (Zoom, Teams, Meet, another browser tab), or choose ${other} in the list. Then press the button below.`,
      button: 'Try again',
    };
  }
  return { kind: 'other', title: `The ${device} does not work`, help: `Try ${other}, or unplug it and plug it in again. Then press the button below.`, button: 'Try again' };
}

/* ---- drawing on the stage ---- */
type Tool = 'none' | 'pen' | 'eraser';
// A drawing: its points are kept as a share of the picture (0 to 1), so it looks the same at any quality.
type Stroke = { color: string; width: number; points: { x: number; y: number }[] };
const INK_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#a78bfa', '#ffffff', '#111111'];
const INK_SIZES = { s: 0.005, m: 0.01, l: 0.02 } as const;
type InkSize = keyof typeof INK_SIZES;

// Drawings belong to the slide they were drawn on (and to the screen view).
const inkKeyOf = (state: { mode: Mode; page: number }) => (state.mode === 'slides' ? `s${state.page}` : 'screen');

// The line is drawn as a smooth curve through the middle of each pair of points.
function paintStroke(context: CanvasRenderingContext2D, stroke: Stroke, W: number, H: number) {
  const { points } = stroke;
  if (points.length === 0) return;

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width * H;

  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x * W, points[0].y * H, (stroke.width * H) / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(points[0].x * W, points[0].y * H);
    if (points.length === 2) {
      context.lineTo(points[1].x * W, points[1].y * H);
    } else {
      for (let i = 1; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        context.quadraticCurveTo(a.x * W, a.y * H, ((a.x + b.x) / 2) * W, ((a.y + b.y) / 2) * H);
      }
      const last = points[points.length - 1];
      context.lineTo(last.x * W, last.y * H);
    }
    context.stroke();
  }
  context.restore();
}

// How close a point is to a drawing (in pixels), to erase it by touching it.
function distanceToStroke(stroke: Stroke, x: number, y: number, W: number, H: number) {
  let best = Infinity;
  const { points } = stroke;
  for (let i = 0; i < points.length; i += 1) {
    const ax = points[i].x * W;
    const ay = points[i].y * H;
    const bx = (points[i + 1] ?? points[i]).x * W;
    const by = (points[i + 1] ?? points[i]).y * H;
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/* ---- the PDF viewer (PDF.js, a copy of it is in /academy/vendor) ---- */
type PdfPage = {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
};
type PdfDocument = { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> | void };
type PdfLib = { getDocument(source: { data: ArrayBuffer }): { promise: Promise<PdfDocument> }; GlobalWorkerOptions: { workerSrc: string } };

let pdfLibPromise: Promise<PdfLib> | null = null;
function loadPdfLib() {
  pdfLibPromise ??= new Promise<PdfLib>((resolve, reject) => {
    const holder = window as unknown as { pdfjsLib?: PdfLib };
    const ready = () => {
      if (!holder.pdfjsLib) return reject(new Error('The slide viewer could not be loaded.'));
      holder.pdfjsLib.GlobalWorkerOptions.workerSrc = '/academy/vendor/pdf.worker.min.js';
      resolve(holder.pdfjsLib);
    };
    if (holder.pdfjsLib) return ready();
    const script = document.createElement('script');
    script.src = '/academy/vendor/pdf.min.js';
    script.onload = ready;
    script.onerror = () => {
      pdfLibPromise = null;
      reject(new Error('The slide viewer could not be loaded.'));
    };
    document.head.appendChild(script);
  });
  return pdfLibPromise;
}

/** A small always-on-top window (Chrome and Edge) used for the floating controls. */
type PictureInPictureApi = { requestWindow(options?: { width?: number; height?: number }): Promise<Window> };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(bytes > 99 * 1024 * 1024 ? 0 : 1);

export function InstructorRecordingStudio({
  open,
  onClose,
  onUse,
  presentationUrl,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives the finished recording, to upload it into the lesson like any video file. */
  onUse: (file: File) => void;
  /** The "Course presentation" the instructor already added: a PDF is loaded here by itself. */
  presentationUrl?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [mode, setMode] = useState<Mode>('slides');
  const [phase, setPhase] = useState<Phase>('setup');
  const [message, setMessage] = useState('');

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const [cameraOn, setCameraOn] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [camIssue, setCamIssue] = useState<Issue | null>(null);
  const [micIssue, setMicIssue] = useState<Issue | null>(null);
  const quietTicks = useRef(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const heardOnce = useRef(false); // once we heard the microphone, "we cannot hear you" is never shown for it
  const [soundTest, setSoundTest] = useState<'idle' | 'recording' | 'playing'>('idle');
  const [soundLeft, setSoundLeft] = useState(0);
  const soundStop = useRef<() => void>(() => undefined);
  const soundClose = useRef<() => void>(() => undefined);

  const [corner, setCorner] = useState<Corner>('bottom-right');
  const [bubbleSize, setBubbleSize] = useState<BubbleSize>('m');
  const [shape, setShape] = useState<Shape>('circle');
  const [tool, setTool] = useState<Tool>('none');
  const [penColor, setPenColor] = useState(INK_COLORS[0]);
  const [penSize, setPenSize] = useState<InkSize>('m');
  const [inkState, setInkState] = useState({ canUndo: false, hasInk: false });
  const quality: Quality = '720p'; // always HD 720p

  const [pdfName, setPdfName] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [screenReady, setScreenReady] = useState(false);
  const [pip, setPip] = useState<Window | null>(null);

  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [bytes, setBytes] = useState(0);
  // The recording and every state after a cut (the first one is what was recorded).
  const [history, setHistory] = useState<Take[]>([]);
  const [marked, setMarked] = useState(false);
  const [finishing, setFinishing] = useState(false);

  /* everything that changes without a new picture lives in refs */
  const stageRef = useRef<HTMLCanvasElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const camVideo = useRef<HTMLVideoElement | null>(null);
  const screenVideo = useRef<HTMLVideoElement | null>(null);
  const camStream = useRef<MediaStream | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioBus = useRef<GainNode | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const micSource = useRef<MediaStreamAudioSourceNode | null>(null);
  const screenAudioSource = useRef<MediaStreamAudioSourceNode | null>(null);
  const ticker = useRef<{ stop: () => void } | null>(null);
  const pdfDoc = useRef<PdfDocument | null>(null);
  const pageCache = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const recorderRef = useRef<LessonRecorder | null>(null);
  const timerRef = useRef(0);
  const phaseRef = useRef<Phase>('setup');
  const modeRef = useRef<Mode>('slides');
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => undefined);
  // Every drawing view keeps its list of states: the last one is what is shown, the ones before are for Undo.
  const inkStacks = useRef<Map<string, Stroke[][]>>(new Map());
  const inkCanvas = useRef<HTMLCanvasElement | null>(null);
  const liveStroke = useRef<Stroke | null>(null);
  const eraseWork = useRef<{ strokes: Stroke[]; changed: boolean } | null>(null);
  const openPdfRef = useRef<(data: ArrayBuffer, name: string) => Promise<void>>(async () => undefined);
  const live = useRef({ mode: 'slides' as Mode, page: 1, cameraOn: true, corner: 'bottom-right' as Corner, bubbleSize: 'm' as BubbleSize, shape: 'circle' as Shape });

  phaseRef.current = phase;
  modeRef.current = mode;
  live.current = { mode, page, cameraOn, corner, bubbleSize, shape };

  const size = QUALITY[quality];
  const recording = phase === 'recording' || phase === 'paused';

  /* what the course presentation is: only a PDF can be shown here */
  const presentationKind = !presentationUrl
    ? 'none'
    : /\.pdf(\?|#|$)/i.test(presentationUrl)
      ? 'pdf'
      : /docs\.google\.com\/presentation/i.test(presentationUrl)
        ? 'google'
        : /\.pptx?(\?|#|$)/i.test(presentationUrl)
          ? 'powerpoint'
          : 'other';

  /* ------------------------------------------------------------------ the picture */
  const draw = useCallback(() => {
    const canvas = stageRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const W = canvas.width;
    const H = canvas.height;
    const state = live.current;

    const background = context.createLinearGradient(0, 0, W, H);
    background.addColorStop(0, '#150c28');
    background.addColorStop(1, '#2a0a52');
    context.fillStyle = background;
    context.fillRect(0, 0, W, H);

    // the slide or the shared screen, as big as it fits
    let main: CanvasImageSource | null = null;
    let mainW = 0;
    let mainH = 0;
    if (state.mode === 'slides') {
      const slide = pageCache.current.get(state.page);
      if (slide) {
        main = slide;
        mainW = slide.width;
        mainH = slide.height;
      }
    } else if (screenVideo.current && screenVideo.current.videoWidth > 0) {
      main = screenVideo.current;
      mainW = screenVideo.current.videoWidth;
      mainH = screenVideo.current.videoHeight;
    }
    if (main) {
      const fit = Math.min(W / mainW, H / mainH);
      context.drawImage(main, (W - mainW * fit) / 2, (H - mainH * fit) / 2, mainW * fit, mainH * fit);
    }

    // the drawings (under the camera bubble)
    if (inkCanvas.current) context.drawImage(inkCanvas.current, 0, 0, W, H);
    if (liveStroke.current) paintStroke(context, liveStroke.current, W, H);

    // the camera bubble
    const camera = camVideo.current;
    if (state.cameraOn && camera && camera.videoWidth > 0) {
      const d = BUBBLE[state.bubbleSize] * H;
      const margin = 0.04 * H;
      const x = state.corner.endsWith('left') ? margin : W - d - margin;
      const y = state.corner.startsWith('top') ? margin : H - d - margin;
      const bubble = () => {
        context.beginPath();
        if (state.shape === 'circle') context.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
        else context.roundRect(x, y, d, d, d * 0.2);
      };

      context.save();
      context.shadowColor = 'rgba(0,0,0,0.45)';
      context.shadowBlur = H * 0.03;
      context.shadowOffsetY = H * 0.008;
      bubble();
      context.fillStyle = '#000';
      context.fill();
      context.restore();

      const side = Math.min(camera.videoWidth, camera.videoHeight);
      context.save();
      bubble();
      context.clip();
      context.drawImage(camera, (camera.videoWidth - side) / 2, (camera.videoHeight - side) / 2, side, side, x, y, d, d);
      context.restore();

      bubble();
      context.lineWidth = H * 0.006;
      context.strokeStyle = '#ffffff';
      context.stroke();
    }
  }, []);

  // A timer in a worker keeps drawing even when this window is behind another one
  // (the browser slows down normal timers and animation frames of windows that are not visible).
  const startTicker = useCallback(() => {
    ticker.current?.stop();
    try {
      const url = URL.createObjectURL(
        new Blob(['let t;onmessage=(e)=>{clearInterval(t);if(e.data==="go"){t=setInterval(()=>postMessage(0),33)}}'], {
          type: 'text/javascript',
        }),
      );
      const worker = new Worker(url);
      worker.onmessage = () => {
        draw();
        recorderRef.current?.captureFrame();
      };
      worker.postMessage('go');
      ticker.current = {
        stop: () => {
          worker.terminate();
          URL.revokeObjectURL(url);
        },
      };
    } catch {
      const id = window.setInterval(() => {
        draw();
        recorderRef.current?.captureFrame();
      }, 33);
      ticker.current = { stop: () => window.clearInterval(id) };
    }
  }, [draw]);

  /* ------------------------------------------------------------------ drawing */
  const currentStrokes = useCallback(() => {
    const stack = inkStacks.current.get(inkKeyOf(live.current));
    return stack ? stack[stack.length - 1] : [];
  }, []);

  // draws the saved drawings of this slide (or of the screen) on their own layer
  const redrawInk = useCallback(
    (strokes?: Stroke[]) => {
      let canvas = inkCanvas.current;
      if (!canvas || canvas.width !== size.w || canvas.height !== size.h) {
        canvas = document.createElement('canvas');
        canvas.width = size.w;
        canvas.height = size.h;
        inkCanvas.current = canvas;
      }
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, size.w, size.h);
      (strokes ?? currentStrokes()).forEach((stroke) => paintStroke(context, stroke, size.w, size.h));
    },
    [currentStrokes, size.h, size.w],
  );

  const refreshInk = useCallback(() => {
    const stack = inkStacks.current.get(inkKeyOf(live.current));
    setInkState({ canUndo: Boolean(stack && stack.length > 1), hasInk: Boolean(stack && stack[stack.length - 1].length > 0) });
  }, []);

  const commitInk = useCallback(
    (strokes: Stroke[]) => {
      const key = inkKeyOf(live.current);
      const stack = inkStacks.current.get(key) ?? [[]];
      inkStacks.current.set(key, [...stack, strokes].slice(-60));
      redrawInk();
      refreshInk();
    },
    [redrawInk, refreshInk],
  );

  function undoInk() {
    const key = inkKeyOf(live.current);
    const stack = inkStacks.current.get(key);
    if (!stack || stack.length < 2) return;
    inkStacks.current.set(key, stack.slice(0, -1));
    redrawInk();
    refreshInk();
  }

  function clearInk() {
    if (currentStrokes().length > 0) commitInk([]);
  }

  const toPoint = (event: { clientX: number; clientY: number }, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  // touching a drawing with the eraser deletes it
  function eraseAt(point: { x: number; y: number }) {
    const work = eraseWork.current;
    if (!work) return;
    const radius = 0.035 * size.h;
    const left = work.strokes.filter((stroke) => distanceToStroke(stroke, point.x * size.w, point.y * size.h, size.w, size.h) > radius + (stroke.width * size.h) / 2);
    if (left.length !== work.strokes.length) {
      work.strokes = left;
      work.changed = true;
      redrawInk(left);
    }
  }

  function inkDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === 'none' || phase === 'review' || phase === 'countdown') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event, event.currentTarget);
    if (tool === 'pen') {
      liveStroke.current = { color: penColor, width: INK_SIZES[penSize], points: [point] };
    } else {
      eraseWork.current = { strokes: [...currentStrokes()], changed: false };
      eraseAt(point);
    }
  }

  function inkMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = liveStroke.current;
    if (!stroke && !eraseWork.current) return;

    // all the small movements the mouse made since the last event keep the line smooth
    const moves = event.nativeEvent.getCoalescedEvents?.() ?? [];
    (moves.length > 0 ? moves : [event.nativeEvent]).forEach((move) => {
      const raw = toPoint(move, event.currentTarget);
      if (stroke) {
        const last = stroke.points[stroke.points.length - 1];
        if (Math.hypot((raw.x - last.x) * size.w, (raw.y - last.y) * size.h) < 1.5) return;
        // each point moves only part of the way to the pen: small shakes of the hand disappear
        stroke.points.push({ x: last.x + (raw.x - last.x) * 0.6, y: last.y + (raw.y - last.y) * 0.6 });
      } else {
        eraseAt(raw);
      }
    });
  }

  function inkUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = liveStroke.current;
    if (stroke) {
      stroke.points.push(toPoint(event, event.currentTarget));
      liveStroke.current = null;
      commitInk([...currentStrokes(), stroke]);
    }
    const work = eraseWork.current;
    if (work) {
      eraseWork.current = null;
      if (work.changed) commitInk(work.strokes);
      else redrawInk();
    }
  }

  /* ------------------------------------------------------------------ camera and microphone */
  const ensureAudio = useCallback(() => {
    if (!audioContext.current) {
      const context = new AudioContext({ sampleRate: 48000 });
      audioContext.current = context;
      audioBus.current = context.createGain();
      analyser.current = context.createAnalyser();
      analyser.current.fftSize = 512;
    }
    return audioContext.current;
  }, []);

  const attachMic = useCallback(
    (stream: MediaStream) => {
      const context = ensureAudio();
      micSource.current?.disconnect();
      micStream.current?.getTracks().forEach((track) => track.stop());
      micStream.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (micStream.current !== stream) return;
          setMicIssue({ kind: 'unplugged', title: 'The microphone was disconnected', help: 'Plug it in again, or choose another microphone in the list. Then press the button below.', button: 'Look again' });
        };
      });
      micSource.current = context.createMediaStreamSource(stream);
      micSource.current.connect(analyser.current as AnalyserNode);
      micSource.current.connect(audioBus.current as GainNode);
    },
    [ensureAudio],
  );

  const attachCamera = useCallback(async (stream: MediaStream) => {
    camStream.current?.getTracks().forEach((track) => track.stop());
    camStream.current = stream;
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        if (camStream.current !== stream) return;
        setCamIssue({ kind: 'unplugged', title: 'The camera was disconnected', help: 'Plug it in again, or choose another camera in the list. Then press the button below.', button: 'Look again' });
      };
    });
    const video = camVideo.current ?? document.createElement('video');
    camVideo.current = video;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play().catch(() => undefined);
  }, []);

  const openCamera = useCallback(
    async (deviceId?: string) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      await attachCamera(stream);
      return stream.getVideoTracks()[0]?.getSettings().deviceId || deviceId || '';
    },
    [attachCamera],
  );

  const openMic = useCallback(
    async (deviceId?: string) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...AUDIO, deviceId: deviceId ? { exact: deviceId } : undefined },
        video: false,
      });
      attachMic(stream);
      return stream.getAudioTracks()[0]?.getSettings().deviceId || deviceId || '';
    },
    [attachMic],
  );

  const listDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameras(devices.filter((device) => device.kind === 'videoinput'));
    setMics(devices.filter((device) => device.kind === 'audioinput'));
  }, []);

  /* ------------------------------------------------------------------ slides */
  const renderPage = useCallback(
    async (number: number) => {
      const doc = pdfDoc.current;
      if (!doc || number < 1 || number > doc.numPages || pageCache.current.has(number)) return;

      const pdfPage = await doc.getPage(number);
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: Math.min(size.w / base.width, size.h / base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await pdfPage.render({ canvasContext: context, viewport }).promise;
      pageCache.current.set(number, canvas);
    },
    [size.h, size.w],
  );

  // Small pictures of every slide, so the instructor can click the slide to start from.
  // They are made one after the other in the background.
  const makeThumbs = useCallback(async (doc: PdfDocument) => {
    const urls: string[] = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      if (pdfDoc.current !== doc) return;
      try {
        const pdfPage = await doc.getPage(n);
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: 220 / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) continue;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        urls[n - 1] = canvas.toDataURL('image/jpeg', 0.7);
      } catch {
        urls[n - 1] = '';
      }
      if (n % 3 === 0 || n === doc.numPages) setThumbs([...urls]);
    }
  }, []);

  const openPdf = useCallback(
    async (data: ArrayBuffer, name: string) => {
      setPdfBusy(true);
      setMessage('');
      try {
        const lib = await loadPdfLib();
        const doc = await lib.getDocument({ data }).promise;
        await pdfDoc.current?.destroy();
        pdfDoc.current = doc;
        pageCache.current.clear();
        setThumbs([]);
        setPdfName(name);
        setPageCount(doc.numPages);
        setPage(1);
        setMode('slides');
        await renderPage(1);
        void renderPage(2);
        void makeThumbs(doc);
      } catch (error) {
        setMessage(error instanceof Error && error.message.includes('viewer') ? error.message : 'This file could not be opened. Please choose a PDF.');
      } finally {
        setPdfBusy(false);
      }
    },
    [renderPage, makeThumbs],
  );
  openPdfRef.current = openPdf;

  const goTo = useCallback(
    (number: number) => {
      const next = Math.max(1, Math.min(pageCount, number));
      setPage(next);
      void renderPage(next).then(() => renderPage(next + 1));
    },
    [pageCount, renderPage],
  );

  async function chooseSlides(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await openPdf(await file.arrayBuffer(), file.name);
  }

  /* ------------------------------------------------------------------ screen sharing */
  const stopRecording = useCallback(async () => {
    const active = recorderRef.current;
    if (!active) return;
    recorderRef.current = null;
    window.clearInterval(timerRef.current);

    setFinishing(true);
    try {
      setHistory([await active.stop()]);
      setPhase('review');
    } catch {
      setMessage('The recording could not be finished. Please try again.');
      setPhase('setup');
    } finally {
      setFinishing(false);
    }
  }, []);

  async function chooseScreen() {
    setMessage('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true });
      screenStream.current?.getTracks().forEach((track) => track.stop());
      screenAudioSource.current?.disconnect();
      screenStream.current = stream;

      const video = screenVideo.current ?? document.createElement('video');
      screenVideo.current = video;
      video.muted = true;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      if (stream.getAudioTracks().length > 0) {
        const context = ensureAudio();
        screenAudioSource.current = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        screenAudioSource.current.connect(audioBus.current as GainNode);
      }

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        // "Stop sharing" in the browser bar. With slides loaded the instructor is simply brought back
        // to the slides and the recording goes on; with only the screen, the recording ends.
        if (screenStream.current !== stream) return;
        screenStream.current = null;
        setScreenReady(false);
        if (pdfDoc.current) {
          modeRef.current = 'slides';
          setMode('slides');
        } else if (phaseRef.current === 'recording' || phaseRef.current === 'paused') {
          void stopRecording();
        }
      });
      setScreenReady(true);
      modeRef.current = 'screen';
      setMode('screen');
    } catch {
      // the window picker was closed without choosing anything: nothing to say
    }
  }

  function stopSharing() {
    screenStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current = null;
    screenAudioSource.current?.disconnect();
    setScreenReady(false);
    if (pdfDoc.current) {
      modeRef.current = 'slides';
      setMode('slides');
    } else if (recording) {
      void stopRecording();
    }
  }

  // what the stage shows right now
  function showSlides() {
    if (pageCount === 0) return setMessage('Choose your slides first.');
    modeRef.current = 'slides';
    setMode('slides');
  }

  function showScreen() {
    if (!screenReady) return void chooseScreen();
    modeRef.current = 'screen';
    setMode('screen');
  }

  /* ------------------------------------------------------------------ recording */
  async function begin() {
    setMessage('');
    if (pageCount === 0 && !screenReady) return setMessage('Choose your slides, or share your screen, first.');
    // start with whatever is ready
    if (modeRef.current === 'slides' && pageCount === 0) {
      modeRef.current = 'screen';
      setMode('screen');
    } else if (modeRef.current === 'screen' && !screenReady) {
      modeRef.current = 'slides';
      setMode('slides');
    }
    if (!micStream.current) return setMessage('We need your microphone to record. Allow it in the address bar of your browser.');

    const choice = await LessonRecorder.check(size.w, size.h, size.bps);
    if (!choice) return setMessage('Recording needs Google Chrome or Microsoft Edge on a computer.');

    await audioContext.current?.resume();
    setPhase('countdown');
    phaseRef.current = 'countdown';
    for (let n = 3; n >= 1; n -= 1) {
      setCountdown(n);
      await sleep(1000);
      if (phaseRef.current !== 'countdown') return;
    }

    const recorder = new LessonRecorder({
      canvas: stageRef.current as HTMLCanvasElement,
      audioContext: audioContext.current as AudioContext,
      audioBus: audioBus.current as GainNode,
      width: size.w,
      height: size.h,
      bitrate: size.bps,
      choice,
    });
    try {
      await recorder.start();
    } catch {
      recorder.dispose();
      setPhase('setup');
      return setMessage('Recording could not start. Please use Google Chrome or Microsoft Edge on a computer.');
    }

    recorderRef.current = recorder;
    recorder.mark('mode', modeRef.current);
    recorder.mark('slide', live.current.page);
    setBytes(0);
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor(recorder.elapsed));
      setBytes(recorder.bytes);
      if (recorder.error) {
        setMessage('The recording stopped because of a problem with the video encoder. What was recorded is kept.');
        void stopRecording();
      }
    }, 250);
    setPhase('recording');
  }

  function pause() {
    recorderRef.current?.pause();
    setPhase('paused');
  }

  function resume() {
    recorderRef.current?.resume();
    setPhase('recording');
  }

  // a mark in the recording, to find the spot again when editing
  function markMistake() {
    if (!recorderRef.current) return;
    recorderRef.current.mark('mistake', 1);
    setMarked(true);
    window.setTimeout(() => setMarked(false), 2500);
  }

  function again() {
    setHistory([]);
    setElapsed(0);
    setBytes(0);
    setPhase('setup');
  }

  // a recording that was not saved is not lost by mistake
  function closeStudio() {
    if (phase === 'review' && history.length > 0) setConfirmClose(true);
    else onClose();
  }

  async function useRecording() {
    const take = history[history.length - 1];
    if (!take || finishing) return;

    setFinishing(true);
    try {
      const blob = await buildTakeBlob(take);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      onUse(new File([blob], `lesson-recording-${stamp}.webm`, { type: 'video/webm' }));
      onClose();
    } catch {
      setMessage('The video could not be prepared. Please try again.');
    } finally {
      setFinishing(false);
    }
  }

  /* ------------------------------------------------------------------ floating controls */
  async function popOut() {
    const api = (window as unknown as { documentPictureInPicture?: PictureInPictureApi }).documentPictureInPicture;
    if (!api) return setMessage('Floating controls need Google Chrome or Microsoft Edge on a computer.');
    try {
      const floating = await api.requestWindow({ width: 340, height: 230 });

      // the small window looks like the studio: it gets the same styles
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          const style = document.createElement('style');
          style.textContent = Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
          floating.document.head.appendChild(style);
        } catch {
          if (sheet.href) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            floating.document.head.appendChild(link);
          }
        }
      });
      floating.document.body.style.margin = '0';
      floating.addEventListener('keydown', (event) => keyHandler.current(event));
      floating.addEventListener('pagehide', () => setPip(null));
      setPip(floating);
    } catch {
      setMessage('The floating controls could not be opened.');
    }
  }

  /* ------------------------------------------------------------------ opening, closing */
  const teardown = useCallback(() => {
    window.clearInterval(timerRef.current);
    recorderRef.current?.dispose();
    recorderRef.current = null;
    ticker.current?.stop();
    ticker.current = null;
    [camStream, micStream, screenStream].forEach((holder) => {
      holder.current?.getTracks().forEach((track) => track.stop());
      holder.current = null;
    });
    micSource.current?.disconnect();
    screenAudioSource.current?.disconnect();
    micSource.current = null;
    screenAudioSource.current = null;
    void audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
    audioBus.current = null;
    analyser.current = null;
    camVideo.current = null;
    screenVideo.current = null;
    void pdfDoc.current?.destroy();
    pdfDoc.current = null;
    pageCache.current.clear();
    inkStacks.current.clear();
    inkCanvas.current = null;
    liveStroke.current = null;
    eraseWork.current = null;
    setTool('none');
    setInkState({ canUndo: false, hasInk: false });
    setPhase('setup');
    setMode('slides');
    setMessage('');
    setHistory([]);
    setPdfName('');
    setPageCount(0);
    setPage(1);
    setThumbs([]);
    setScreenReady(false);
    setElapsed(0);
    setBytes(0);
  }, []);

  useEffect(() => {
    if (!open) return;

    const ok = Boolean(navigator.mediaDevices?.getUserMedia) && typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
    setSupported(ok);
    if (!ok) return;

    let cancelled = false;
    startTicker();

    (async () => {
      try {
        // one permission question for both; the two are then used separately
        const first = await navigator.mediaDevices
          .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: AUDIO })
          .catch(async (error) => {
            setCameraOn(false);
            setCamIssue(await explainDevice('camera', error));
            return navigator.mediaDevices.getUserMedia({ audio: AUDIO });
          });
        if (cancelled) return first.getTracks().forEach((track) => track.stop());

        const video = first.getVideoTracks();
        if (video.length > 0) {
          setCameraOn(true);
          setCamIssue(null);
          await attachCamera(new MediaStream(video));
          setCameraId(video[0].getSettings().deviceId || '');
        }
        const audio = first.getAudioTracks();
        if (audio.length === 0) setMicIssue(await explainDevice('microphone', { name: 'NotFoundError' }));
        if (audio.length > 0) {
          setMicIssue(null);
          attachMic(new MediaStream(audio));
          setMicId(audio[0].getSettings().deviceId || '');
        }
        await listDevices();
      } catch (error) {
        if (!cancelled) setMicIssue(await explainDevice('microphone', error));
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [open, attachCamera, attachMic, listDevices, startTicker, teardown]);

  // The "Course presentation" the instructor already added is loaded by itself (a PDF).
  useEffect(() => {
    if (!open || presentationKind !== 'pdf' || !presentationUrl) return;

    let cancelled = false;
    (async () => {
      setPdfBusy(true);
      try {
        const response = await fetch(presentationUrl);
        if (!response.ok) throw new Error('not found');
        const data = await response.arrayBuffer();
        if (!cancelled) await openPdfRef.current(data, 'Your course presentation');
      } catch {
        if (!cancelled) {
          setPdfBusy(false);
          setMessage('Your course presentation could not be loaded here. Choose the PDF file from your computer instead.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, presentationUrl, presentationKind]);

  // the drawings of the slide that is shown
  useEffect(() => {
    if (!open) return;
    redrawInk();
    refreshInk();
  }, [open, mode, page, quality, redrawInk, refreshInk]);

  // the floating window closes with the studio
  useEffect(() => {
    if (!open && pip) {
      pip.close();
      setPip(null);
    }
  }, [open, pip]);

  // the picture size follows the quality; slides are drawn again at that size
  useEffect(() => {
    const canvas = stageRef.current;
    if (!canvas || !open) return;
    canvas.width = size.w;
    canvas.height = size.h;
    pageCache.current.clear();
    if (pdfDoc.current) void renderPage(page).then(() => renderPage(page + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quality, size.h, size.w, renderPage]);

  useEffect(() => {
    if (!open) soundClose.current();
  }, [open]);

  // a camera or microphone plugged in or out
  useEffect(() => {
    if (!open || !navigator.mediaDevices) return;
    const onChange = () => void listDevices().catch(() => undefined);
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
  }, [open, listDevices]);

  // the microphone level
  useEffect(() => {
    if (!open) return;
    quietTicks.current = 0;
    heardOnce.current = false;
    const id = window.setInterval(() => {
      const node = analyser.current;
      if (!node) return;
      const data = new Uint8Array(node.fftSize);
      node.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) sum += ((value - 128) / 128) ** 2;
      const level = Math.min(1, Math.sqrt(sum / data.length) * 3);
      setMicLevel(level);

      // a microphone that gives no sound at all for a few seconds is probably muted or the wrong one
      const track = micStream.current?.getAudioTracks()[0];
      if (!track || track.readyState !== 'live') return;
      if (level > 0.02) {
        heardOnce.current = true;
        quietTicks.current = 0;
        setMicIssue((current) => (current?.kind === 'silent' ? null : current));
      } else {
        quietTicks.current += 1;
        if (quietTicks.current === 60 && !heardOnce.current) {
          setMicIssue(
            (current) =>
              current ?? {
                kind: 'silent',
                title: 'We cannot hear you',
                help: track.muted
                  ? 'Your microphone is muted. Switch it on (look for a mute button on it, on your keyboard or in your computer sound settings).'
                  : 'Say something. If the bar does not move, choose another microphone in the list, or check that it is not muted.',
                button: 'Check again',
              },
          );
        }
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [open]);

  // the current slide stays in the middle of the row of small slides
  useEffect(() => {
    const strip = stripRef.current;
    const current = strip?.querySelector<HTMLElement>('[data-current="true"]');
    if (!strip || !current) return;
    strip.scrollTo({ left: current.offsetLeft - strip.clientWidth / 2 + current.clientWidth / 2, behavior: 'smooth' });
  }, [page, thumbs.length, phase]);

  // keys: arrows change the slide, S shows the slides, D shows the screen
  keyHandler.current = (event: KeyboardEvent) => {
    if (phaseRef.current === 'review' || phaseRef.current === 'countdown') return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undoInk();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (['ArrowRight', 'PageDown'].includes(event.key) && pageCount > 0) {
      event.preventDefault();
      goTo(page + 1);
    } else if (['ArrowLeft', 'PageUp'].includes(event.key) && pageCount > 0) {
      event.preventDefault();
      goTo(page - 1);
    } else if (event.key === 's' || event.key === 'S') {
      showSlides();
    } else if (event.key === 'd' || event.key === 'D') {
      showScreen();
    } else if ((event.key === 'm' || event.key === 'M') && recorderRef.current) {
      markMistake();
    } else if (event.key === 'p' || event.key === 'P') {
      setTool((current) => (current === 'pen' ? 'none' : 'pen'));
    } else if (event.key === 'e' || event.key === 'E') {
      setTool((current) => (current === 'eraser' ? 'none' : 'eraser'));
    } else if (event.key === 'Escape') {
      setTool('none');
    }
  };

  // what happens on the stage is noted in the recording, to find it again when editing
  useEffect(() => {
    recorderRef.current?.mark('mode', mode);
  }, [mode]);
  useEffect(() => {
    recorderRef.current?.mark('slide', page);
  }, [page]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // records 5 seconds of the microphone, then plays them, so the instructor hears what the learners will hear
  function testSound() {
    if (soundTest !== 'idle') {
      soundStop.current();
      return;
    }
    const stream = micStream.current;
    if (!stream || stream.getAudioTracks()[0]?.readyState !== 'live' || typeof MediaRecorder === 'undefined') {
      setMicIssue({ kind: 'other', title: 'There is no microphone to test', help: 'Allow or choose a microphone first, then test your sound.', button: 'Try again' });
      return;
    }

    const recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()));
    const pieces: Blob[] = [];
    let audio: HTMLAudioElement | null = null;
    let url = '';
    let countdown = 0;
    let left = 5;

    const finish = () => {
      window.clearInterval(countdown);
      audio?.pause();
      if (url) URL.revokeObjectURL(url);
      audio = null;
      url = '';
      setSoundTest('idle');
      soundStop.current = () => undefined;
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) pieces.push(event.data);
    };
    recorder.onstop = () => {
      if (pieces.length === 0 || soundStopped) return finish();
      url = URL.createObjectURL(new Blob(pieces, { type: recorder.mimeType || 'audio/webm' }));
      audio = new Audio(url);
      audio.onended = finish;
      audio.onerror = finish;
      setSoundTest('playing');
      void audio.play().catch(finish);
    };

    let soundStopped = false;
    // a click while recording stops the recording and plays it; a click while playing stops the playing
    soundStop.current = () => {
      if (recorder.state !== 'inactive') recorder.stop();
      else finish();
    };
    soundClose.current = () => {
      soundStopped = true;
      window.clearInterval(countdown);
      if (recorder.state !== 'inactive') recorder.stop();
      else finish();
    };

    recorder.start();
    setSoundTest('recording');
    setSoundLeft(left);
    countdown = window.setInterval(() => {
      left -= 1;
      setSoundLeft(left);
      if (left <= 0) {
        window.clearInterval(countdown);
        if (recorder.state !== 'inactive') recorder.stop();
      }
    }, 1000);
  }

  async function retryCamera() {
    try {
      const id = await openCamera(cameraId || undefined).catch(() => openCamera());
      setCameraId(id);
      setCameraOn(true);
      setCamIssue(null);
      await listDevices();
    } catch (error) {
      setCamIssue(await explainDevice('camera', error));
    }
  }

  async function retryMic() {
    quietTicks.current = 0;
    heardOnce.current = false;
    try {
      const id = await openMic(micId || undefined).catch(() => openMic());
      setMicId(id);
      setMicIssue(null);
      await listDevices();
    } catch (error) {
      setMicIssue(await explainDevice('microphone', error));
    }
  }

  async function toggleCamera() {
    if (cameraOn) {
      camStream.current?.getTracks().forEach((track) => track.stop());
      setCameraOn(false);
      return;
    }
    await retryCamera();
  }

  async function changeCamera(id: string) {
    setCameraId(id);
    try {
      await openCamera(id);
      setCameraOn(true);
      setCamIssue(null);
    } catch (error) {
      setCamIssue(await explainDevice('camera', error));
    }
  }

  async function changeMic(id: string) {
    setMicId(id);
    try {
      await openMic(id);
      setMicIssue(null);
      quietTicks.current = 0;
      heardOnce.current = false;
    } catch (error) {
      setMicIssue(await explainDevice('microphone', error));
    }
  }

  if (!open || typeof document === 'undefined') return null;

  /* ------------------------------------------------------------------ what the instructor sees */
  const choice = (active: boolean) =>
    `rounded-xl border px-3 py-2 text-xs font-bold transition ${
      active ? 'border-[#34d4c6] bg-[#34d4c6]/15 text-white' : 'border-white/15 bg-white/5 text-[#cfc8de] hover:bg-white/10'
    }`;
  const card = 'rounded-2xl border border-white/10 bg-[#171322] p-4';
  const issueBox = (issue: Issue, retry: () => void, count: number) => (
    <div role="alert" className="mt-3 rounded-xl border border-[#f6b44b]/40 bg-[#f6b44b]/10 p-3">
      <p className="text-xs font-black text-[#ffd99a]">{issue.title}</p>
      <p className="mt-1 text-xs leading-5 text-[#f0e6d0]">{issue.help}</p>
      {count > 1 && issue.kind !== 'ask' && issue.kind !== 'blocked' ? (
        <p className="mt-1 text-xs font-bold text-[#ffd99a]">You have {count} to choose from in the list.</p>
      ) : null}
      <button type="button" onClick={retry} className="mt-2 rounded-full bg-[#f6b44b] px-3 py-1.5 text-xs font-black text-[#1a1208] hover:bg-[#ffc765]">
        {issue.button}
      </button>
    </div>
  );
  const label = 'text-[11px] font-black uppercase tracking-[0.14em] text-[#b58dfb]';
  const select =
    'mt-2 h-10 w-full rounded-lg border border-white/15 bg-[#0f0b18] px-3 text-sm text-white outline-none focus:border-[#34d4c6]';

  const sourceReady = pageCount > 0 || screenReady;
  const stageEmpty = mode === 'slides' ? pageCount === 0 : !screenReady;
  const switching = phase === 'countdown' || phase === 'review';

  const presentationNote =
    presentationKind === 'powerpoint'
      ? 'Your course presentation is a PowerPoint file. The studio shows PDFs: export it as PDF (File, then Export), then choose it here.'
      : presentationKind === 'google'
        ? 'Your course presentation is a Google Slides link. In Google Slides choose File, Download, PDF document, then choose that file here.'
        : presentationKind === 'other'
          ? 'The studio can only show PDF slides. Choose a PDF file here.'
          : 'Tip: add your slides as the "Course presentation" (a PDF) and they will open here by themselves.';

  const slideButtons = (compact = false) =>
    pageCount > 0 ? (
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Previous slide" className="rounded-lg border border-white/15 p-2 hover:bg-white/10 disabled:opacity-30">
          <ChevronLeft className="size-5" />
        </button>
        <span className={`${compact ? 'min-w-12' : 'min-w-16'} text-center text-sm font-bold`}>
          {page} / {pageCount}
        </span>
        <button type="button" onClick={() => goTo(page + 1)} disabled={page >= pageCount} aria-label="Next slide" className="rounded-lg border border-white/15 p-2 hover:bg-white/10 disabled:opacity-30">
          <ChevronRight className="size-5" />
        </button>
      </div>
    ) : null;

  const showSwitch = (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-bold text-[#c4bdd8]">Show</span>
      <button type="button" onClick={showSlides} disabled={switching} className={choice(mode === 'slides')}>
        Slides <span className="font-normal opacity-60">S</span>
      </button>
      <button type="button" onClick={showScreen} disabled={switching} className={choice(mode === 'screen')}>
        My screen <span className="font-normal opacity-60">D</span>
      </button>
    </div>
  );

  // the small floating window
  const floatingControls = pip ? (
    <div className="flex h-screen flex-col justify-between gap-2 bg-[#0b0814] p-3 text-white">
      <div className="flex items-center justify-between text-xs font-black">
        <span className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${phase === 'recording' ? 'animate-pulse bg-[#ef4444]' : phase === 'paused' ? 'bg-[#f6b44b]' : 'bg-white/30'}`} />
          {phase === 'recording' ? 'REC' : phase === 'paused' ? 'PAUSED' : phase === 'review' ? 'DONE' : 'READY'} {clock(elapsed)}
        </span>
        <span className="text-[#c4bdd8]">{megabytes(bytes)} MB</span>
      </div>
      {showSwitch}
      {slideButtons(true)}
      <div className="grid grid-cols-2 gap-2">
        {phase === 'setup' ? (
          <button type="button" onClick={() => void begin()} disabled={!sourceReady} className="col-span-2 h-10 rounded-xl bg-[#ef4444] text-sm font-black disabled:opacity-50">
            Start recording
          </button>
        ) : null}
        {recording ? (
          <>
            <button type="button" onClick={phase === 'recording' ? pause : resume} className="h-10 rounded-xl border border-white/20 bg-white/10 text-sm font-bold">
              {phase === 'recording' ? 'Pause' : 'Resume'}
            </button>
            <button type="button" onClick={stopRecording} className="h-10 rounded-xl bg-[#ef4444] text-sm font-black">
              Stop
            </button>
          </>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-[#0b0814] text-white">
          <div className="mx-auto w-full max-w-[1320px] px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#34d4c6]">Recording studio</p>
                <h2 className="text-xl font-black sm:text-2xl">Record your lesson</h2>
              </div>
              <button
                type="button"
                onClick={closeStudio}
                disabled={recording || phase === 'countdown'}
                aria-label="Close the studio"
                title={recording ? 'Stop the recording first' : 'Close'}
                className="rounded-full p-2 text-[#b8b0cf] transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                <X className="size-6" />
              </button>
            </div>

            {confirmClose ? (
              <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Your video is not saved">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171322] p-6 shadow-2xl">
                  <h3 className="text-lg font-black">Your video is not saved</h3>
                  <p className="mt-2 text-sm leading-6 text-[#d8d0ea]">
                    You recorded a video but did not use it yet. If you close the studio now, the recording will be lost.
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                    <button type="button" autoFocus onClick={() => setConfirmClose(false)} className="rounded-full bg-[#34d4c6] px-5 py-2.5 text-sm font-black text-[#06241f] hover:bg-[#5be3d6]">
                      Go back to my video
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmClose(false);
                        onClose();
                      }}
                      className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-[#f0b4b4] hover:bg-white/10"
                    >
                      Close without saving
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!supported ? (
              <div className={`${card} mt-6 text-sm leading-6 text-[#d8d0ea]`}>
                Recording needs a computer with Google Chrome or Microsoft Edge. Please open this page in one of them,
                or upload a video file instead.
              </div>
            ) : (
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                {/* the stage */}
                <div>
                  {phase === 'review' && history.length > 0 ? (
                    <TakeEditor
                      take={history[history.length - 1]}
                      canUndo={history.length > 1}
                      onCut={(start, end) => setHistory((list) => [...list, cutRange(list[list.length - 1], start, end)])}
                      onCutMany={(ranges) => setHistory((list) => [...list, cutRanges(list[list.length - 1], ranges)])}
                      onUndo={() => setHistory((list) => (list.length > 1 ? list.slice(0, -1) : list))}
                    />
                  ) : null}

                  {/* drawing tools */}
                  {phase !== 'review' ? (
                    <div className={`${card} mb-3 flex flex-wrap items-center gap-3`}>
                      <button type="button" onClick={() => setTool((current) => (current === 'pen' ? 'none' : 'pen'))} className={`${choice(tool === 'pen')} inline-flex h-10 items-center gap-1.5`}>
                        <Pencil className="size-4" /> Draw <span className="font-normal opacity-60">P</span>
                      </button>
                      <button type="button" onClick={() => setTool((current) => (current === 'eraser' ? 'none' : 'eraser'))} className={`${choice(tool === 'eraser')} inline-flex h-10 items-center gap-1.5`}>
                        <Eraser className="size-4" /> Eraser <span className="font-normal opacity-60">E</span>
                      </button>
                      <span className="hidden h-6 w-px bg-white/10 sm:block" />
                      <div className="flex items-center gap-1.5">
                        {INK_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Colour ${color}`}
                            onClick={() => {
                              setPenColor(color);
                              setTool('pen');
                            }}
                            className={`size-7 rounded-full border-2 transition ${penColor === color ? 'border-white ring-2 ring-[#34d4c6]' : 'border-white/30 hover:border-white/70'}`}
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                      <span className="hidden h-6 w-px bg-white/10 sm:block" />
                      <div className="flex items-center gap-1.5">
                        {(Object.keys(INK_SIZES) as InkSize[]).map((value, index) => (
                          <button
                            key={value}
                            type="button"
                            aria-label={`Pen size ${value.toUpperCase()}`}
                            onClick={() => {
                              setPenSize(value);
                              setTool('pen');
                            }}
                            className={`${choice(penSize === value)} flex size-10 items-center justify-center px-0`}
                          >
                            <span className="rounded-full bg-white" style={{ width: 5 + index * 5, height: 5 + index * 5 }} />
                          </button>
                        ))}
                      </div>
                      <span className="hidden h-6 w-px bg-white/10 sm:block" />
                      <button type="button" onClick={undoInk} disabled={!inkState.canUndo} className={`${choice(false)} inline-flex h-10 items-center gap-1.5 disabled:opacity-40`}>
                        <Undo2 className="size-4" /> Undo
                      </button>
                      <button type="button" onClick={clearInk} disabled={!inkState.hasInk} className={`${choice(false)} inline-flex h-10 items-center gap-1.5 disabled:opacity-40`}>
                        <Trash2 className="size-4" /> Clear
                      </button>
                    </div>
                  ) : null}

                  <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl ${phase === 'review' ? 'hidden' : ''}`}>
                    <canvas
                      ref={stageRef}
                      width={size.w}
                      height={size.h}
                      onPointerDown={inkDown}
                      onPointerMove={inkMove}
                      onPointerUp={inkUp}
                      onPointerCancel={inkUp}
                      style={{ touchAction: tool === 'none' ? undefined : 'none', cursor: tool === 'pen' ? 'crosshair' : tool === 'eraser' ? 'cell' : undefined }}
                      className={`block aspect-video h-auto w-full ${phase === 'review' ? 'hidden' : ''}`}
                    />

                    {phase !== 'review' && stageEmpty ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                        {mode === 'slides' ? <Presentation className="size-10 text-[#b58dfb]" /> : <Monitor className="size-10 text-[#b58dfb]" />}
                        <p className="text-lg font-black">
                          {mode === 'slides'
                            ? pdfBusy
                              ? 'Opening your slides...'
                              : 'Choose your slides to start'
                            : 'Choose what to share to start'}
                        </p>
                        <p className="max-w-sm text-sm text-[#c4bdd8]">
                          {mode === 'slides'
                            ? 'Use the panel on the right. PowerPoint? Export it as PDF first (File, then Export).'
                            : 'Pick the window or the screen you want to show. Do not pick this window.'}
                        </p>
                      </div>
                    ) : null}

                    {phase === 'countdown' ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                        <span className="text-[140px] font-black leading-none text-white">{countdown}</span>
                      </div>
                    ) : null}

                    {recording ? (
                      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-black">
                        <span className={`size-2.5 rounded-full ${phase === 'recording' ? 'animate-pulse bg-[#ef4444]' : 'bg-[#f6b44b]'}`} />
                        {phase === 'recording' ? 'REC' : 'PAUSED'} {clock(elapsed)}
                        <span className="font-semibold text-[#c4bdd8]">{megabytes(bytes)} MB</span>
                      </div>
                    ) : null}

                  </div>

                  {/* the controls under the stage */}
                  <div className={`${card} mt-4 flex flex-wrap items-center gap-3`}>
                    {phase === 'setup' || phase === 'countdown' ? (
                      <button
                        type="button"
                        onClick={() => void begin()}
                        disabled={phase === 'countdown' || !sourceReady}
                        className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#ef4444] px-6 text-sm font-black text-white transition hover:bg-[#dc2626] disabled:opacity-50"
                      >
                        <span className="size-3 rounded-full bg-white" /> Start recording
                      </button>
                    ) : null}

                    {recording ? (
                      <>
                        {phase === 'recording' ? (
                          <button type="button" onClick={pause} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-bold hover:bg-white/15">
                            <Pause className="size-4" /> Pause
                          </button>
                        ) : (
                          <button type="button" onClick={resume} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#34d4c6] px-5 text-sm font-black text-[#08110f] hover:bg-[#5ee7dc]">
                            <Play className="size-4" /> Resume
                          </button>
                        )}
                        <button type="button" onClick={() => void stopRecording()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#ef4444] px-5 text-sm font-black hover:bg-[#dc2626]">
                          <Square className="size-4" /> Stop
                        </button>
                        <button type="button" onClick={markMistake} title="Press when you make a mistake: you will find the spot again when you edit" className={`${choice(marked)} inline-flex h-11 items-center gap-1.5`}>
                          <Flag className="size-4 text-[#ef4444]" /> {marked ? 'Marked' : 'Mark mistake'} <span className="font-normal opacity-60">M</span>
                        </button>
                      </>
                    ) : null}

                    {phase !== 'review' ? showSwitch : null}

                    {phase !== 'review' ? (
                      <div className="ml-auto flex items-center gap-3">
                        {slideButtons()}
                        <button
                          type="button"
                          onClick={() => (pip ? pip.close() : void popOut())}
                          title="A small window that stays on top of your other windows, to change slides, switch between slides and your screen, pause or stop."
                          className={`${choice(Boolean(pip))} inline-flex items-center gap-1.5`}
                        >
                          <PictureInPicture2 className="size-4" /> {pip ? 'Close floating controls' : 'Floating controls'}
                        </button>
                      </div>
                    ) : null}

                    {phase === 'review' && history.length > 0 ? (
                      <>
                        <button type="button" onClick={() => void useRecording()} disabled={finishing} className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#34d4c6] px-6 text-sm font-black text-[#08110f] transition hover:bg-[#5ee7dc] disabled:opacity-60">
                          <Check className="size-5" /> Use this video ({clock(takeDuration(history[history.length - 1]))}, about {megabytes(takeBytes(history[history.length - 1]))} MB)
                        </button>
                        <button type="button" onClick={again} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-bold hover:bg-white/15">
                          <RotateCcw className="size-4" /> Record again
                        </button>
                        {takeBytes(history[history.length - 1]) > 45 * 1024 * 1024 ? (
                          <p className="basis-full text-xs leading-5 text-[#ffd99a]">
                            This video is large. If the upload says the file is too large, record the lesson in shorter parts
                            (about 10 minutes each), or choose HD 720p.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="basis-full text-xs leading-5 text-[#c4bdd8]">
                        {recording
                          ? 'Switch between your slides and your screen whenever you like. Keys: ← → change slide, S slides, D screen, M marks a mistake so you can find it when editing.'
                          : 'A 3-second countdown starts the recording. During the recording you can switch between your slides and your screen, and mark mistakes (key M) to find them easily when you edit. Keys: ← → change slide, S slides, D screen.'}
                      </p>
                    )}
                  </div>

                  {/* the slides: click one to start from it */}
                  {pageCount > 0 && phase !== 'review' ? (
                    <div className={`${card} mt-4`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={label}>{recording ? 'Your slides' : 'Click the slide to start from'}</p>
                        <label className="flex items-center gap-2 text-xs font-bold text-[#c4bdd8]">
                          Go to slide
                          <input
                            type="number"
                            min={1}
                            max={pageCount}
                            value={page}
                            onChange={(event) => {
                              const number = Number(event.target.value);
                              if (number >= 1 && number <= pageCount) goTo(number);
                            }}
                            className="h-8 w-16 rounded-md border border-white/20 bg-[#0f0b18] px-2 text-center text-sm text-white outline-none focus:border-[#34d4c6]"
                          />
                          of {pageCount}
                        </label>
                      </div>
                      <div ref={stripRef} className="relative mt-3 flex gap-2 overflow-x-auto pb-2">
                        {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                          <button
                            key={number}
                            type="button"
                            data-current={number === page}
                            aria-label={`Slide ${number}`}
                            onClick={() => goTo(number)}
                            className={`shrink-0 rounded-lg border p-1 transition ${
                              number === page ? 'border-[#34d4c6] bg-[#34d4c6]/15' : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            {thumbs[number - 1] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumbs[number - 1]} alt={`Slide ${number}`} className="h-[68px] w-auto rounded" />
                            ) : (
                              <span className="flex h-[68px] w-[110px] items-center justify-center rounded bg-white/5 text-xs text-[#8e879f]">...</span>
                            )}
                            <span className={`mt-1 block text-center text-[11px] font-bold ${number === page ? 'text-[#34d4c6]' : 'text-[#c4bdd8]'}`}>{number}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {message ? <p className="mt-3 rounded-xl border border-[#f6b44b]/40 bg-[#f6b44b]/10 p-3 text-sm font-semibold text-[#ffd99a]">{message}</p> : null}
                </div>

                {/* the settings */}
                <div className="space-y-4">
                  <div className={card}>
                    <p className={label}>Slides</p>
                    <div className="mt-2 space-y-2">
                      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 text-sm font-black transition hover:bg-[#6d31dc]">
                        {pdfBusy ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
                        {pageCount > 0 ? 'Choose other slides' : 'Choose your slides (PDF)'}
                        <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(event) => void chooseSlides(event)} disabled={recording || phase === 'countdown' || pdfBusy} />
                      </label>
                      {pdfName ? (
                        <p className="flex items-center gap-1.5 truncate text-xs text-[#c4bdd8]">
                          <Check className="size-3.5 shrink-0 text-[#34d4c6]" /> {pdfName} · {pageCount} slides
                        </p>
                      ) : (
                        <p className="text-xs leading-5 text-[#c4bdd8]">{pdfBusy ? 'Opening your course presentation...' : presentationNote}</p>
                      )}
                    </div>
                  </div>

                  <div className={card}>
                    <p className={label}>Your screen</p>
                    <div className="mt-2 space-y-2">
                      {screenReady ? (
                        <button type="button" onClick={stopSharing} disabled={switching} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold hover:bg-white/15">
                          <Monitor className="size-4" /> Stop sharing
                        </button>
                      ) : (
                        <button type="button" onClick={() => void chooseScreen()} disabled={switching} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 text-sm font-black transition hover:bg-[#6d31dc] disabled:opacity-50">
                          <Monitor className="size-4" /> Share my screen
                        </button>
                      )}
                      <p className="text-xs leading-5 text-[#c4bdd8]">
                        {screenReady
                          ? 'You are sharing. Use "Show" under the picture (or the floating controls) to go between your slides and your screen.'
                          : 'Share a window (for example PowerPoint or a website) rather than the whole screen. With slides loaded, you can do this at any time, even while recording.'}
                      </p>
                    </div>
                  </div>

                  <div className={card}>
                    <div className="flex items-center justify-between">
                      <p className={label}>Camera</p>
                      <button type="button" onClick={() => void toggleCamera()} disabled={recording} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cameraOn ? 'bg-[#34d4c6]/20 text-[#34d4c6]' : 'bg-white/10 text-[#c4bdd8]'}`}>
                        {cameraOn ? <Camera className="size-3.5" /> : <CameraOff className="size-3.5" />} {cameraOn ? 'On' : 'Off'}
                      </button>
                    </div>
                    {camIssue ? issueBox(camIssue, () => void retryCamera(), cameras.length) : null}
                    {cameras.length > 1 ? (
                      <select className={select} value={cameraId} onChange={(event) => void changeCamera(event.target.value)} disabled={recording}>
                        {cameras.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>
                        ))}
                      </select>
                    ) : null}

                    <p className="mt-3 text-xs font-bold text-[#c4bdd8]">Where is the camera?</p>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as Corner[]).map((value) => (
                        <button key={value} type="button" onClick={() => setCorner(value)} className={`${choice(corner === value)} px-1`} aria-label={value.replace('-', ' ')}>
                          <span className="relative mx-auto block h-6 w-9 rounded border border-white/30">
                            <span className={`absolute size-2 rounded-full bg-[#34d4c6] ${value.includes('top') ? 'top-0.5' : 'bottom-0.5'} ${value.includes('left') ? 'left-0.5' : 'right-0.5'}`} />
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#c4bdd8]">Size</p>
                        <div className="mt-1.5 grid grid-cols-3 gap-1">
                          {(['s', 'm', 'l'] as BubbleSize[]).map((value) => (
                            <button key={value} type="button" onClick={() => setBubbleSize(value)} className={`${choice(bubbleSize === value)} px-0`}>{value.toUpperCase()}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#c4bdd8]">Shape</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-1">
                          <button type="button" onClick={() => setShape('circle')} className={`${choice(shape === 'circle')} px-0`}>Round</button>
                          <button type="button" onClick={() => setShape('rounded')} className={`${choice(shape === 'rounded')} px-0`}>Square</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={card}>
                    <p className={label}>Microphone</p>
                    {micIssue ? issueBox(micIssue, () => void retryMic(), mics.length) : null}
                    {mics.length > 1 ? (
                      <select className={select} value={micId} onChange={(event) => void changeMic(event.target.value)} disabled={recording}>
                        {mics.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>
                        ))}
                      </select>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2">
                      <Mic className="size-4 text-[#b58dfb]" />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#34d4c6] to-[#7c3aed] transition-all" style={{ width: `${Math.round(micLevel * 100)}%` }} />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-[#c4bdd8]">Say something: the bar should move.</p>
                    <button
                      type="button"
                      onClick={testSound}
                      disabled={recording || phase === 'countdown'}
                      className={`${choice(soundTest !== 'idle')} mt-3 inline-flex w-full items-center justify-center gap-2 disabled:opacity-40`}
                    >
                      <Volume2 className="size-4" />
                      {soundTest === 'recording' ? `Speak now... ${soundLeft}s (click to listen)` : soundTest === 'playing' ? 'Listening to you... (click to stop)' : 'Test my sound'}
                    </button>
                    <p className="mt-1.5 text-[11px] leading-4 text-[#c4bdd8]">
                      {soundTest === 'recording'
                        ? 'Say a few words in your normal voice.'
                        : soundTest === 'playing'
                          ? 'This is how your learners will hear you.'
                          : 'Records 5 seconds, then plays them back. Use headphones to avoid an echo.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
      {finishing
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center gap-2 bg-black/70 text-sm font-bold text-white">
              <LoaderCircle className="size-5 animate-spin" /> Preparing your video...
            </div>,
            document.body,
          )
        : null}
      {pip && floatingControls ? createPortal(floatingControls, pip.document.body) : null}
    </>
  );
}
