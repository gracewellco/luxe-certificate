import type { Font, Glyph } from '@pdf-lib/fontkit';
import { CERTIFICATE_CONFIG, type CertificateConfig } from './certificateConfig';

/**
 * Shared geometry for the recipient name. The PDF export and the browser
 * preview both draw exactly the outline produced here, so they cannot drift
 * apart.
 */

/** Outline commands in absolute PDF coordinates (points, y-up). */
export type PathCommand =
  | { op: 'M'; x: number; y: number }
  | { op: 'L'; x: number; y: number }
  | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: 'Z' };

export interface NameLayout {
  text: string;
  fontSize: number;
  /** Pen origin of the first glyph (used for the invisible, selectable text layer). */
  originX: number;
  baselineY: number;
  /** Tight bounds of the painted glyph outlines, in PDF coordinates. */
  ink: { left: number; right: number; bottom: number; top: number };
  path: PathCommand[];
}

// fontkit's typings omit the raw command list, which is what we need.
type FontkitCommand = { command: string; args: number[] };
type GlyphWithCommands = Glyph & { path: Glyph['path'] & { commands: FontkitCommand[] } };

/** Trim, collapse runs of whitespace, keep punctuation and casing as typed. */
export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Characters the configured font cannot draw (deduplicated). */
export function findUnsupportedCharacters(font: Font, name: string): string[] {
  const missing = new Set<string>();
  for (const ch of name) {
    if (ch === ' ') continue;
    if (!font.hasGlyphForCodePoint(ch.codePointAt(0)!)) missing.add(ch);
  }
  return [...missing];
}

interface ShapedRun {
  glyphs: GlyphWithCommands[];
  /** Pen x for each glyph, in font units, relative to the run origin. */
  penX: number[];
  penY: number[];
  /** Exact horizontal ink extents in font units (curve extrema included). */
  inkMinX: number;
  inkMaxX: number;
}

function shape(font: Font, text: string): ShapedRun {
  const run = font.layout(text);
  const glyphs = run.glyphs as GlyphWithCommands[];
  const penX: number[] = [];
  const penY: number[] = [];
  let x = 0;
  let inkMinX = Infinity;
  let inkMaxX = -Infinity;

  glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const gx = x + pos.xOffset;
    penX.push(gx);
    penY.push(pos.yOffset);
    if (glyph.path.commands.length > 0) {
      const box = glyph.path.bbox;
      inkMinX = Math.min(inkMinX, gx + box.minX);
      inkMaxX = Math.max(inkMaxX, gx + box.maxX);
    }
    x += pos.xAdvance;
  });

  if (!Number.isFinite(inkMinX)) {
    inkMinX = 0;
    inkMaxX = 0;
  }
  return { glyphs, penX, penY, inkMinX, inkMaxX };
}

/**
 * Lays out `name` (already normalized) on a page of `pageWidth` points:
 * picks the font size, measures the real rendered width and centers it.
 */
export function layoutName(
  font: Font,
  name: string,
  pageWidth: number,
  config: CertificateConfig = CERTIFICATE_CONFIG,
): NameLayout {
  const run = shape(font, name);
  const unitsPerEm = font.unitsPerEm;
  const inkWidthUnits = run.inkMaxX - run.inkMinX;
  const maxWidth = pageWidth * config.maxNameWidthRatio;

  // Start at the preferred size; step down until the name fits (never below minimum).
  // Real font-size reduction only — no horizontal scaling.
  let fontSize: number = config.preferredFontSize;
  while (
    fontSize - config.fontSizeStep >= config.minimumFontSize &&
    (inkWidthUnits * fontSize) / unitsPerEm > maxWidth
  ) {
    fontSize -= config.fontSizeStep;
  }

  const scale = fontSize / unitsPerEm;
  const inkWidth = inkWidthUnits * scale;

  // Horizontal: center the actual painted ink on the page's center line.
  //   x = (pageWidth - textWidth) / 2
  const inkLeft = (pageWidth - inkWidth) / 2;
  const originX = inkLeft - run.inkMinX * scale;

  // Vertical: center the font's descender→cap-height band on nameCenterY.
  // This uses font metrics, not the glyphs typed, so the baseline is stable.
  const bandMid = ((font.descent + font.capHeight) / 2) * scale;
  const baselineY = config.nameCenterY - bandMid;

  const path: PathCommand[] = [];
  let inkBottom = Infinity;
  let inkTop = -Infinity;

  run.glyphs.forEach((glyph, i) => {
    const gx = originX + run.penX[i] * scale;
    const gy = baselineY + run.penY[i] * scale;
    const px = (u: number) => gx + u * scale;
    const py = (u: number) => gy + u * scale;
    let cx = 0;
    let cy = 0;

    for (const { command, args: a } of glyph.path.commands) {
      switch (command) {
        case 'moveTo':
          path.push({ op: 'M', x: px(a[0]), y: py(a[1]) });
          [cx, cy] = [a[0], a[1]];
          break;
        case 'lineTo':
          path.push({ op: 'L', x: px(a[0]), y: py(a[1]) });
          [cx, cy] = [a[0], a[1]];
          break;
        case 'quadraticCurveTo': {
          // PDF has no quadratic operator: convert exactly to a cubic.
          const [qx, qy, x, y] = a;
          path.push({
            op: 'C',
            x1: px(cx + (2 / 3) * (qx - cx)),
            y1: py(cy + (2 / 3) * (qy - cy)),
            x2: px(x + (2 / 3) * (qx - x)),
            y2: py(y + (2 / 3) * (qy - y)),
            x: px(x),
            y: py(y),
          });
          [cx, cy] = [x, y];
          break;
        }
        case 'bezierCurveTo':
          path.push({ op: 'C', x1: px(a[0]), y1: py(a[1]), x2: px(a[2]), y2: py(a[3]), x: px(a[4]), y: py(a[5]) });
          [cx, cy] = [a[4], a[5]];
          break;
        case 'closePath':
          path.push({ op: 'Z' });
          break;
      }
    }

    if (glyph.path.commands.length > 0) {
      inkBottom = Math.min(inkBottom, py(glyph.path.bbox.minY));
      inkTop = Math.max(inkTop, py(glyph.path.bbox.maxY));
    }
  });

  return {
    text: name,
    fontSize,
    originX,
    baselineY,
    ink: {
      left: inkLeft,
      right: inkLeft + inkWidth,
      bottom: Number.isFinite(inkBottom) ? inkBottom : baselineY,
      top: Number.isFinite(inkTop) ? inkTop : baselineY,
    },
    path,
  };
}
