// Article HTML is authored in the CRM and rendered on a light reading card.
// Pasted or hand-coloured content can carry inline colours that would be
// unreadable there (white text, dark backgrounds), so those are dropped.

function parseColor(value: string): [number, number, number] | null {
  const color = value.trim().toLowerCase();

  if (color === 'white') return [255, 255, 255];
  if (color === 'black') return [0, 0, 0];

  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1].split('').map((char) => char + char).join('')
        : hex[1];
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ];
  }

  const rgb = color.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];

  return null;
}

function brightness(value: string) {
  const rgb = parseColor(value);
  return rgb ? (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 : null;
}

function cleanStyle(style: string) {
  return style
    .split(';')
    .filter((declaration) => {
      const index = declaration.indexOf(':');
      if (index === -1) return declaration.trim() !== '';

      const property = declaration.slice(0, index).trim().toLowerCase();
      const value = declaration.slice(index + 1).trim();

      if (property === 'color') {
        const level = brightness(value);
        return level === null || level < 0.7;
      }

      if (property === 'background' || property === 'background-color') {
        const level = brightness(value);
        return level === null || level > 0.45;
      }

      return true;
    })
    .join(';');
}

export function prepareArticleHtml(html: string) {
  return html
    // Embedded players load once and stay put (no lazy loading while scrolling).
    .replace(/(<iframe\b[^>]*?)\sloading="lazy"/gi, '$1')
    // Wide tables scroll sideways instead of breaking the page layout.
    .replace(/<table\b/gi, '<div style="overflow-x:auto;margin:20px 0"><table')
    .replace(/<\/table>/gi, '</table></div>')
    .replace(/\sstyle="([^"]*)"/gi, (_match, style: string) => {
      const cleaned = cleanStyle(style);
      return cleaned ? ` style="${cleaned}"` : '';
    })
    .replace(/\scolor="([^"]*)"/gi, (match, value: string) => {
      const level = brightness(value);
      return level !== null && level >= 0.7 ? '' : match;
    });
}
