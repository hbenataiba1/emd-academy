import {
  getCertificateVerifyUrl,
  qrPdfOperators,
  premiumQrSvg,
} from '@/lib/certificate-qr';

export type CertificateSvgPayload = {
  learnerName: string;
  courseTitle: string;
  certificateTitle: string;
  certificateNumber: string;
  issuedDate: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitSvgText(value: string, maxLength: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function svgTspans(lines: string[], x: number, y: number, lineHeight: number) {
  return lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');
}

export function formatCertificateDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function toPdfAscii(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: string) {
  return toPdfAscii(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function pdfText({
  text,
  x,
  y,
  size,
  font = 'F1',
  align = 'left',
}: {
  text: string;
  x: number;
  y: number;
  size: number;
  font?: 'F1' | 'F2' | 'F3' | 'F4';
  align?: 'left' | 'center' | 'right';
}) {
  const clean = escapePdfText(text);
  const estimatedWidth = clean.length * size * 0.48;
  const tx =
    align === 'center'
      ? x - estimatedWidth / 2
      : align === 'right'
        ? x - estimatedWidth
        : x;

  return `BT /${font} ${size} Tf ${tx.toFixed(2)} ${y.toFixed(2)} Td (${clean}) Tj ET`;
}

function pdfWrappedText({
  text,
  x,
  y,
  size,
  maxLength,
  lineHeight,
  font = 'F1',
  align = 'center',
}: {
  text: string;
  x: number;
  y: number;
  size: number;
  maxLength: number;
  lineHeight: number;
  font?: 'F1' | 'F2' | 'F3' | 'F4';
  align?: 'left' | 'center' | 'right';
}) {
  return splitSvgText(toPdfAscii(text), maxLength)
    .slice(0, 3)
    .map((line, index) =>
      pdfText({
        text: line,
        x,
        y: y - index * lineHeight,
        size,
        font,
        align,
      }),
    )
    .join('\n');
}

export function buildCertificatePdfBlob({
  learnerName,
  courseTitle,
  certificateTitle,
  certificateNumber,
  issuedDate,
}: CertificateSvgPayload) {
  const circle = (cx: number, cy: number, r: number, op: 'f' | 'S') => {
    const k = r * 0.5523;
    const p = (n: number) => n.toFixed(2);
    return [
      `${p(cx + r)} ${p(cy)} m`,
      `${p(cx + r)} ${p(cy + k)} ${p(cx + k)} ${p(cy + r)} ${p(cx)} ${p(cy + r)} c`,
      `${p(cx - k)} ${p(cy + r)} ${p(cx - r)} ${p(cy + k)} ${p(cx - r)} ${p(cy)} c`,
      `${p(cx - r)} ${p(cy - k)} ${p(cx - k)} ${p(cy - r)} ${p(cx)} ${p(cy - r)} c`,
      `${p(cx + k)} ${p(cy - r)} ${p(cx + r)} ${p(cy - k)} ${p(cx + r)} ${p(cy)} c ${op}`,
    ].join(' ');
  };
  // Soft lavender-to-mint background, drawn as vertical strips.
  const strips = 48;
  const background = Array.from({ length: strips }, (_, i) => {
    const t = i / (strips - 1);
    const r = 0.906 + (0.867 - 0.906) * t;
    const g = 0.882 + (0.925 - 0.882) * t;
    const b = 1 + (0.933 - 1) * t;
    return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${((842 / strips) * i).toFixed(2)} 0 ${(842 / strips + 1).toFixed(2)} 595 re f`;
  }).join('\n');
  const nameSize = Math.min(40, 700 / Math.max(toPdfAscii(learnerName).length * 0.45, 1));

  const content = [
    background,
    '0.486 0.227 0.929 RG 2 w 22 22 798 551 re S',
    '0.769 0.710 0.992 RG 0.8 w 32 32 778 531 re S',
    '0.831 0.627 0.090 RG 2.5 w 44 510 m 44 548 l 82 548 l S',
    '0.831 0.627 0.090 RG 2.5 w 798 510 m 798 548 l 760 548 l S',
    '0.831 0.627 0.090 RG 2.5 w 44 80 m 44 42 l 82 42 l S',
    '0.831 0.627 0.090 RG 2.5 w 798 80 m 798 42 l 760 42 l S',
    '0.486 0.227 0.929 rg',
    pdfText({ text: 'EASY MEDICAL DEVICE ACADEMY', x: 421, y: 516, size: 12, font: 'F2', align: 'center' }),
    '0.098 0.106 0.137 rg',
    pdfText({ text: 'CERTIFICATE', x: 421, y: 468, size: 44, font: 'F4', align: 'center' }),
    '0.486 0.227 0.929 rg',
    pdfText({ text: 'OF ACHIEVEMENT', x: 421, y: 444, size: 11, font: 'F2', align: 'center' }),
    '0.831 0.627 0.090 RG 1.5 w 350 428 m 408 428 l S 434 428 m 492 428 l S',
    '0.831 0.627 0.090 rg 421 433 m 426 428 l 421 423 l 416 428 l f',
    '0.392 0.455 0.545 rg',
    pdfText({ text: 'THIS CERTIFICATE IS PROUDLY PRESENTED TO', x: 421, y: 398, size: 10, font: 'F2', align: 'center' }),
    '0.231 0.027 0.392 rg',
    pdfText({ text: learnerName, x: 421, y: 352, size: nameSize, font: 'F3', align: 'center' }),
    '0.831 0.627 0.090 RG 1.5 w 250 334 m 592 334 l S',
    '0.278 0.333 0.412 rg',
    pdfText({ text: 'has demonstrated mastery of medical device regulatory requirements', x: 421, y: 306, size: 12, align: 'center' }),
    pdfText({ text: 'and successfully completed the official certification exam for', x: 421, y: 290, size: 12, align: 'center' }),
    '0.345 0.110 0.529 rg',
    pdfWrappedText({ text: courseTitle, x: 421, y: 260, size: 18, maxLength: 64, lineHeight: 22, font: 'F4' }),
    '0.200 0.251 0.333 rg',
    pdfWrappedText({ text: certificateTitle, x: 421, y: 196, size: 10, maxLength: 90, lineHeight: 13, font: 'F2' }),
    '0.392 0.455 0.545 rg',
    pdfText({ text: 'ISSUE DATE', x: 80, y: 100, size: 8, font: 'F2' }),
    '0.098 0.106 0.137 rg',
    pdfText({ text: issuedDate, x: 80, y: 84, size: 12, font: 'F2' }),
    // Premium verification QR (replaces the old seal + credential id)
    '0.831 0.627 0.090 RG 1.2 w 1 1 1 rg 383 52 76 76 re B',
    '0.231 0.027 0.392 rg',
    qrPdfOperators(getCertificateVerifyUrl(certificateNumber), 389, 58, 64),
    '1 1 1 rg 0.486 0.227 0.929 RG 0.8 w 414 83 14 14 re B',
    '0.231 0.027 0.392 rg',
    pdfText({ text: 'EMD', x: 421, y: 88, size: 5.5, font: 'F2', align: 'center' }),
    '0.427 0.157 0.851 rg',
    pdfText({ text: 'SCAN TO VERIFY', x: 421, y: 40, size: 6.5, font: 'F2', align: 'center' }),
    '0.231 0.027 0.392 rg',
    pdfText({ text: 'Monir El Azzouzi', x: 762, y: 92, size: 17, font: 'F3', align: 'right' }),
    '0.486 0.227 0.929 RG 1.2 w 622 83 m 762 83 l S',
    '0.200 0.251 0.333 rg',
    pdfText({ text: 'Founder and CEO, Lead Regulatory Consultant', x: 762, y: 70, size: 8, font: 'F2', align: 'right' }),
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> /Contents 8 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function buildCertificateSvg(
  {
    learnerName,
    courseTitle,
    certificateTitle,
    certificateNumber,
    issuedDate,
  }: CertificateSvgPayload,
  fontCss = '',
) {
  const courseLines = splitSvgText(courseTitle, 52).slice(0, 2);
  const titleText = splitSvgText(certificateTitle, 60)[0]?.toUpperCase() || '';
  const titleY = 626 + (courseLines.length - 1) * 46 + 54;
  const nameSize = Math.min(86, Math.floor(1240 / Math.max(learnerName.length * 0.5, 1)));
  const qr = premiumQrSvg(getCertificateVerifyUrl(certificateNumber), 744, 770, 112);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <defs>
    <style>${fontCss}</style>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f1ecff"/>
      <stop offset="55%" stop-color="#f8f6ff"/>
      <stop offset="100%" stop-color="#e6f1f3"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5d57a"/>
      <stop offset="50%" stop-color="#d4a017"/>
      <stop offset="100%" stop-color="#9a6a05"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <rect x="36" y="36" width="1528" height="928" rx="10" fill="none" stroke="#7c3aed" stroke-width="4"/>
  <rect x="58" y="58" width="1484" height="884" rx="4" fill="none" stroke="#d4a017" stroke-opacity="0.55" stroke-width="1.5"/>
  <path d="M84 150 V84 H150 M1516 150 V84 H1450 M84 850 V916 H150 M1516 850 V916 H1450" fill="none" stroke="url(#gold)" stroke-width="5"/>

  <g text-anchor="middle">
    <text x="800" y="132" font-family="Montserrat, Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="8" fill="#7c3aed">EASY MEDICAL DEVICE ACADEMY</text>
    <text x="800" y="236" font-family="Cinzel, Georgia, serif" font-size="92" font-weight="700" letter-spacing="14" fill="#1a1033">CERTIFICATE</text>
    <text x="800" y="284" font-family="Montserrat, Arial, sans-serif" font-size="21" font-weight="600" letter-spacing="13" fill="#7c3aed">OF ACHIEVEMENT</text>
    <line x1="660" y1="314" x2="770" y2="314" stroke="url(#gold)" stroke-width="3"/>
    <rect x="793" y="307" width="14" height="14" transform="rotate(45 800 314)" fill="#d4a017"/>
    <line x1="830" y1="314" x2="940" y2="314" stroke="url(#gold)" stroke-width="3"/>

    <text x="800" y="368" font-family="Montserrat, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="5" fill="#64748b">THIS CERTIFICATE IS PROUDLY PRESENTED TO</text>
    <text x="800" y="462" font-family="'Playfair Display', Georgia, serif" font-size="${nameSize}" font-weight="700" font-style="italic" fill="#3b0764">${escapeXml(learnerName)}</text>
    <line x1="480" y1="492" x2="1120" y2="492" stroke="url(#gold)" stroke-width="3"/>

    <text font-family="Montserrat, Arial, sans-serif" font-size="22" font-weight="500" fill="#475569">
      <tspan x="800" y="548">has demonstrated mastery of medical device regulatory requirements</tspan>
      <tspan x="800" y="582">and successfully completed the official certification exam for</tspan>
    </text>
    <text font-family="'Playfair Display', Georgia, serif" font-size="40" font-weight="700" fill="#581c87">
      ${svgTspans(courseLines, 800, 646, 46)}
    </text>
    <text x="800" y="${titleY + 20}" font-family="Montserrat, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="5" fill="#334155">${escapeXml(titleText)}</text>
  </g>

  <g font-family="Montserrat, Arial, sans-serif">
    <text x="190" y="846" font-size="14" font-weight="700" letter-spacing="4" fill="#64748b">ISSUE DATE</text>
    <text x="190" y="886" font-size="25" font-weight="700" fill="#1a1033">${escapeXml(issuedDate)}</text>

    <rect x="730" y="758" width="140" height="140" rx="20" fill="#ffffff" stroke="url(#gold)" stroke-width="3.5"/>
    ${qr}
    <line x1="636" y1="921" x2="696" y2="921" stroke="url(#gold)" stroke-width="2"/>
    <line x1="904" y1="921" x2="964" y2="921" stroke="url(#gold)" stroke-width="2"/>
    <text x="800" y="926" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="4" fill="#6d28d9">SCAN TO VERIFY</text>

    <text x="1410" y="858" text-anchor="end" font-family="'Great Vibes', 'Brush Script MT', cursive" font-size="64" fill="#3b0764">Monir El Azzouzi</text>
    <line x1="1130" y1="874" x2="1410" y2="874" stroke="#7c3aed" stroke-width="2.5"/>
    <text x="1410" y="902" text-anchor="end" font-size="15" font-weight="600" fill="#334155">Founder and CEO, Lead Regulatory Consultant</text>
  </g>
</svg>`;
}

let certificateFontsPromise: Promise<string> | null = null;

/** The certificate fonts are large, so they are loaded only when a certificate is shown. */
export function loadCertificateFonts() {
  certificateFontsPromise ??= import('@/lib/certificate-fonts').then(
    (module) => module.CERTIFICATE_FONT_CSS,
  );
  return certificateFontsPromise;
}

export async function buildCertificateSvgWithFonts(
  payload: CertificateSvgPayload,
) {
  return buildCertificateSvg(payload, await loadCertificateFonts());
}

function loadSvgImage(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Certificate image failed to load.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

async function renderCertificateJpeg(payload: CertificateSvgPayload) {
  const image = await loadSvgImage(await buildCertificateSvgWithFonts(payload));
  const canvas = document.createElement('canvas');
  canvas.width = 3200;
  canvas.height = 2000;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available.');

  // Embedded fonts can finish decoding just after load, so paint twice.
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  await new Promise((resolve) => setTimeout(resolve, 200));
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.94),
  );
  if (!blob) throw new Error('Certificate could not be rendered.');

  return new Uint8Array(await blob.arrayBuffer());
}

export type JpegPdfSize = {
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

const CERTIFICATE_PDF_SIZE: JpegPdfSize = {
  width: 3200,
  height: 2000,
  pageWidth: 842,
  pageHeight: 526,
};

/** Wraps one JPEG in a single-page PDF. */
export function buildJpegPdf(jpeg: Uint8Array, size: JpegPdfSize = CERTIFICATE_PDF_SIZE) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (index: number, body: string | (() => void)) => {
    offsets[index] = length;
    push(`${index} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body();
    push('\nendobj\n');
  };

  push('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size.pageWidth} ${size.pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  object(4, () => {
    push(
      `<< /Type /XObject /Subtype /Image /Width ${size.width} /Height ${size.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    push(jpeg);
    push('\nendstream');
  });
  const content = `q ${size.pageWidth} 0 0 ${size.pageHeight} 0 0 cm /Im0 Do Q`;
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const xref = length;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i += 1) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export async function downloadCertificatePdf(payload: CertificateSvgPayload) {
  let blob: Blob;

  try {
    blob = buildJpegPdf(await renderCertificateJpeg(payload));
  } catch {
    // Canvas unavailable: fall back to the plain vector certificate.
    blob = buildCertificatePdfBlob(payload);
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${payload.certificateNumber}-easy-medical-device-academy-certificate.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function openLinkedInCertificate({
  certificateTitle,
  certificateNumber,
  issuedAt,
}: {
  certificateTitle: string;
  certificateNumber: string;
  issuedAt?: string;
}) {
  const issueDate = issuedAt ? new Date(issuedAt) : new Date();
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: certificateTitle,
    organizationName: 'Easy Medical Device Academy',
    issueYear: String(issueDate.getFullYear()),
    issueMonth: String(issueDate.getMonth() + 1),
    certId: certificateNumber,
    certUrl: getCertificateVerifyUrl(certificateNumber),
  });
  window.open(
    `https://www.linkedin.com/profile/add?${params.toString()}`,
    '_blank',
    'noopener,noreferrer',
  );
}
