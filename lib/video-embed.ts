// Turns the video link saved in the CRM into something that can be shown inside
// the page. Supported: YouTube, Vimeo, Loom and Bunny Stream.

const YOUTUBE_ID =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

// https://iframe.mediadelivery.net/play/<library>/<video>  (or /embed/...)
const BUNNY = /iframe\.mediadelivery\.net\/(?:play|embed)\/(\d+)\/([A-Za-z0-9-]+)/i;

export function isVideoEmbedUrl(url?: string): boolean {
  if (!url) return false;

  const lower = url.toLowerCase();
  return (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('vimeo.com') ||
    lower.includes('loom.com') ||
    BUNNY.test(url)
  );
}

export function getVideoEmbedUrl(url?: string): string {
  if (!url) return '';

  const youtube = url.match(YOUTUBE_ID);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  const bunny = url.match(BUNNY);
  if (bunny) {
    return `https://iframe.mediadelivery.net/embed/${bunny[1]}/${bunny[2]}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`;
  }

  if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
    const id = url.split('vimeo.com/')[1]?.split(/[?#]/)[0];
    return `https://player.vimeo.com/video/${id}`;
  }

  if (url.includes('loom.com/share/')) {
    const id = url.split('loom.com/share/')[1]?.split(/[?#]/)[0];
    return `https://www.loom.com/embed/${id}`;
  }

  return url;
}
