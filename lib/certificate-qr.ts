import QRCode from 'qrcode';

import { ACADEMY_URL } from '@/lib/site';

// Dots slightly overlap their neighbours so every scanner reads them as solid modules.
const DOT_RADIUS = 0.54;

export function getCertificateVerifyUrl(certificateNumber: string) {
  return `${ACADEMY_URL}/verify/${encodeURIComponent(certificateNumber)}`;
}

// Each row is a list of [startColumn, length] runs of dark modules, so the
// code can be drawn with a few large rectangles instead of one per module.
function getQrRuns(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'Q' });
  const size = qr.modules.size;
  const rows: [number, number][][] = [];

  for (let row = 0; row < size; row += 1) {
    const runs: [number, number][] = [];
    let start = -1;

    for (let col = 0; col <= size; col += 1) {
      const dark = col < size && qr.modules.get(row, col) === 1;
      if (dark && start === -1) start = col;
      if (!dark && start !== -1) {
        runs.push([start, col - start]);
        start = -1;
      }
    }

    rows.push(runs);
  }

  return { size, rows };
}

/** PDF drawing operators that fill the QR modules inside a square. */
export function qrPdfOperators(text: string, x: number, y: number, side: number) {
  const { size, rows } = getQrRuns(text);
  const module = side / size;
  const rects = rows.flatMap((runs, row) =>
    runs.map(
      ([col, length]) =>
        `${(x + col * module).toFixed(3)} ${(y + side - (row + 1) * module).toFixed(3)} ${(length * module + 0.02).toFixed(3)} ${(module + 0.02).toFixed(3)} re`,
    ),
  );

  return `${rects.join('\n')}\nf`;
}

/**
 * Premium QR: round dots with a purple gradient, custom rounded finder
 * "eyes" and a centred EMD emblem. Returned as an SVG fragment drawn inside
 * the square (x, y, side). Error correction Q leaves room for the emblem.
 */
export function premiumQrSvg(text: string, x: number, y: number, side: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'Q' });
  const size = qr.modules.size;
  const scale = side / size;
  const center = size / 2;
  const clearRadius = 4.3;
  const eyes: [number, number][] = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  const inEye = (row: number, col: number) =>
    eyes.some(([c, r]) => col >= c && col < c + 7 && row >= r && row < r + 7);

  let dots = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.modules.get(row, col) !== 1 || inEye(row, col)) continue;
      if (Math.hypot(col + 0.5 - center, row + 0.5 - center) < clearRadius) continue;
      dots += `M${col + 0.5 - DOT_RADIUS} ${row + 0.5}a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 ${DOT_RADIUS * 2} 0a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 -${DOT_RADIUS * 2} 0`;
    }
  }

  const eyeSvg = eyes
    .map(
      ([col, row]) =>
        `<rect x="${col + 0.5}" y="${row + 0.5}" width="6" height="6" rx="1.9" fill="none" stroke="url(#qrInk)" stroke-width="1.05"/>` +
        `<rect x="${col + 2}" y="${row + 2}" width="3" height="3" rx="1" fill="url(#qrInk)"/>`,
    )
    .join('');

  return `<g transform="translate(${x} ${y}) scale(${scale.toFixed(5)})">
      <defs>
        <linearGradient id="qrInk" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${size}" y2="${size}">
          <stop offset="0%" stop-color="#2e1065"/>
          <stop offset="100%" stop-color="#6d28d9"/>
        </linearGradient>
      </defs>
      <path d="${dots}" fill="url(#qrInk)"/>
      ${eyeSvg}
      <circle cx="${center}" cy="${center}" r="3.4" fill="#1e1b4b" stroke="#d4a017" stroke-width="0.35"/>
      <text x="${center}" y="${center + 0.95}" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-size="2.7" font-weight="800" letter-spacing="0.05" fill="#f5d57a">EMD</text>
    </g>`;
}
