'use client';

import { useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Globe,
  Play,
  PlayCircle,
  X,
} from 'lucide-react';

type ResourceLike = {
  name: string;
  url?: string;
  size?: string;
  type?: string;
};

type ResourceKind = 'youtube' | 'link' | 'file';

const FILE_EXTENSION =
  /\.(pdf|docx?|xlsx?|pptx?|csv|zip|rar|txt|png|jpe?g|webp)(\?|#|$)/i;

export function getYouTubeId(url: string) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function getResourceKind(resource: ResourceLike): ResourceKind {
  const url = resource.url || '';
  const type = String(resource.type || '').toLowerCase();

  if (getYouTubeId(url)) return 'youtube';
  if (type === 'link') return 'link';
  if (/^https?:\/\//i.test(url) && !FILE_EXTENSION.test(url) && type === '') {
    return 'link';
  }
  return 'file';
}

export function LessonResourceCard({ resource }: { resource: ResourceLike }) {
  const [playing, setPlaying] = useState(false);
  const kind = getResourceKind(resource);
  const url = resource.url && resource.url !== '#' ? resource.url : '';

  if (kind === 'youtube') {
    const id = getYouTubeId(url);

    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        {playing && id ? (
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
              title={resource.name}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block aspect-video w-full overflow-hidden bg-black"
            aria-label={`Play ${resource.name}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02] group-hover:opacity-100"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-[#ff0033] text-white shadow-lg transition group-hover:scale-110">
                <Play className="ml-0.5 size-6 fill-current" />
              </span>
            </span>
          </button>
        )}

        <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <PlayCircle className="size-5 shrink-0 text-[#ff6b81]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{resource.name}</p>
              <p className="text-xs text-[#b9b1cf]">YouTube video</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {playing ? (
              <button
                type="button"
                onClick={() => setPlaying(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
              >
                <X className="size-3.5" />
                Close
              </button>
            ) : null}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#6d31dc]"
            >
              <ExternalLink className="size-3.5" />
              Open on YouTube
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'link') {
    const host = getHostname(url);

    return (
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#34d4c6]/15 text-[#34d4c6]">
            <Globe className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{resource.name}</p>
            <p className="truncate text-xs text-[#b9b1cf]">
              Article / website{host ? ` • ${host}` : ''}
            </p>
          </div>
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#7c3aed] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#6d31dc]"
          >
            <ExternalLink className="size-3.5" />
            Open link
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#b58dfb]/15 text-[#b58dfb]">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{resource.name}</p>
          <p className="text-xs text-[#b9b1cf]">
            {resource.type ? String(resource.type).toUpperCase() : 'DOCUMENT'}
            {resource.size && resource.size !== 'File' ? ` • ${resource.size}` : ''}
          </p>
        </div>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#7c3aed] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#6d31dc]"
        >
          <Download className="size-3.5" />
          Download
        </a>
      ) : null}
    </div>
  );
}
