import { buildJpegPdf, formatCertificateDate } from '@/lib/academy-certificate';

/** One finished course, as returned by /api/academy/me. */
export type CareerCourseInput = {
  id: string;
  title: string;
  category?: string;
  progress: number;
  minutesLearned?: number;
  certificate?: { certificate_number: string; issued_at: string } | null;
};

export type CareerEntry = {
  id: string;
  title: string;
  category: string;
  points: number;
  minutes: number;
  completedAt?: string;
  certificateNumber?: string;
};

export type CareerLevel = { name: string; min: number };

export const CAREER_LEVELS: CareerLevel[] = [
  { name: 'Foundation', min: 0 },
  { name: 'Practitioner', min: 200 },
  { name: 'Specialist', min: 500 },
  { name: 'Expert', min: 1000 },
];

/** Skill Points for one finished course: 100 per hour of content, at least 50. */
export function skillPointsForMinutes(minutes: number) {
  return Math.max(50, Math.round(((minutes / 60) * 100) / 10) * 10);
}

export function buildCareerRecord(courses: CareerCourseInput[]) {
  const entries = courses
    .filter((course) => course.progress >= 100)
    .map<CareerEntry>((course) => {
      const minutes = course.minutesLearned || 0;
      return {
        id: course.id,
        title: course.title,
        category: course.category || 'Course',
        points: skillPointsForMinutes(minutes),
        minutes,
        completedAt: course.certificate?.issued_at,
        certificateNumber: course.certificate?.certificate_number,
      };
    })
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const levelIndex = CAREER_LEVELS.reduce(
    (found, level, index) => (totalPoints >= level.min ? index : found),
    0,
  );
  const next = CAREER_LEVELS[levelIndex + 1] || null;
  const current = CAREER_LEVELS[levelIndex];

  return {
    entries,
    totalPoints,
    totalMinutes,
    level: current,
    nextLevel: next,
    levelProgress: next
      ? Math.min(100, Math.round(((totalPoints - current.min) / (next.min - current.min)) * 100))
      : 100,
  };
}

export type CareerRecord = ReturnType<typeof buildCareerRecord>;

export function formatHours(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clip(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

const PAGE = { width: 1700, height: 2400, pageWidth: 595, pageHeight: 842 };
const MAX_ROWS = 10;

export function buildCareerRecordSvg(record: CareerRecord, learnerName: string) {
  const rows = record.entries.slice(0, MAX_ROWS);
  const hidden = record.entries.length - rows.length;
  const font = "font-family=\"Helvetica, Arial, sans-serif\"";

  const stat = (x: number, value: string, label: string) => `
    <rect x="${x}" y="760" width="440" height="190" rx="28" fill="#f6f3ff"/>
    <text x="${x + 220}" y="866" text-anchor="middle" ${font} font-size="76" font-weight="800" fill="#2b1a5e">${esc(value)}</text>
    <text x="${x + 220}" y="918" text-anchor="middle" ${font} font-size="30" font-weight="600" fill="#6e687d">${esc(label)}</text>`;

  const rowSvg = rows
    .map((entry, index) => {
      const y = 1150 + index * 100;
      const meta = [
        entry.completedAt ? formatCertificateDate(entry.completedAt) : '',
        entry.certificateNumber || '',
      ]
        .filter(Boolean)
        .join('  ·  ');
      return `
    ${index % 2 === 0 ? `<rect x="110" y="${y - 28}" width="1480" height="100" rx="18" fill="#faf8ff"/>` : ''}
    <text x="140" y="${y + 14}" ${font} font-size="34" font-weight="700" fill="#191625">${esc(clip(entry.title, 52))}</text>
    <text x="140" y="${y + 52}" ${font} font-size="25" fill="#6e687d">${esc(clip(meta, 78))}</text>
    <text x="1560" y="${y + 30}" text-anchor="end" ${font} font-size="38" font-weight="800" fill="#7c3aed">+${entry.points}</text>`;
    })
    .join('');

  const barWidth = 1480;
  const filled = Math.round((barWidth * record.levelProgress) / 100);
  const levelText = record.nextLevel
    ? `${record.nextLevel.min - record.totalPoints} points to ${record.nextLevel.name}`
    : 'Highest level reached';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}" height="${PAGE.height}" viewBox="0 0 ${PAGE.width} ${PAGE.height}">
  <defs>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b0764"/><stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <rect width="100%" height="560" fill="url(#hero)"/>
  <text x="110" y="140" ${font} font-size="28" font-weight="700" letter-spacing="6" fill="#34d4c6">EASY MEDICAL DEVICE ACADEMY</text>
  <text x="110" y="270" ${font} font-size="96" font-weight="800" fill="#ffffff">Career Record</text>
  <text x="110" y="350" ${font} font-size="44" fill="#e6dcff">${esc(clip(learnerName, 40))}</text>
  <text x="110" y="470" ${font} font-size="30" fill="#c4bdd8">Issued ${esc(formatCertificateDate())}</text>
  <text x="1590" y="360" text-anchor="end" ${font} font-size="190" font-weight="800" fill="#ffffff">${record.totalPoints}</text>
  <text x="1590" y="430" text-anchor="end" ${font} font-size="38" font-weight="700" letter-spacing="3" fill="#34d4c6">SKILL POINTS</text>

  <text x="110" y="680" ${font} font-size="42" font-weight="800" fill="#2b1a5e">Level: ${esc(record.level.name)}</text>
  <text x="1590" y="680" text-anchor="end" ${font} font-size="30" fill="#6e687d">${esc(levelText)}</text>
  <rect x="110" y="710" width="${barWidth}" height="18" rx="9" fill="#ece7fb"/>
  <rect x="110" y="710" width="${Math.max(filled, 18)}" height="18" rx="9" fill="#7c3aed"/>

  ${stat(110, String(record.entries.length), 'Courses completed')}
  ${stat(630, formatHours(record.totalMinutes), 'Learning time')}
  ${stat(1150, String(record.entries.filter((e) => e.certificateNumber).length), 'Certificates')}

  <text x="110" y="1080" ${font} font-size="40" font-weight="800" fill="#2b1a5e">Completed courses</text>
  <rect x="110" y="1100" width="1480" height="3" fill="#ece7fb"/>
  ${rowSvg || `<text x="110" y="1180" ${font} font-size="32" fill="#6e687d">No course completed yet.</text>`}
  ${hidden > 0 ? `<text x="110" y="${1150 + rows.length * 100 + 30}" ${font} font-size="28" fill="#6e687d">+ ${hidden} more completed course${hidden === 1 ? '' : 's'}</text>` : ''}

  <rect x="110" y="2262" width="1480" height="3" fill="#ece7fb"/>
  <text x="110" y="2326" ${font} font-size="26" fill="#8e879f">Certificates can be verified at easymedicaldevice.com/academy/verify</text>
  <text x="1590" y="2326" text-anchor="end" ${font} font-size="26" font-weight="700" fill="#7c3aed">easymedicaldevice.com/academy</text>
</svg>`;

  return svg;
}

function loadSvgImage(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Career record could not be rendered.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export async function downloadCareerRecordPdf(record: CareerRecord, learnerName: string) {
  const image = await loadSvgImage(buildCareerRecordSvg(record, learnerName));
  const canvas = document.createElement('canvas');
  canvas.width = PAGE.width;
  canvas.height = PAGE.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available.');

  context.drawImage(image, 0, 0, PAGE.width, PAGE.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.94),
  );
  if (!blob) throw new Error('Career record could not be created.');

  const pdf = buildJpegPdf(new Uint8Array(await blob.arrayBuffer()), PAGE);
  const url = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'career-record-easy-medical-device-academy.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
