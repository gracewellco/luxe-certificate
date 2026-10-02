import { useEffect, useRef } from 'react';
import { CERTIFICATE_CONFIG } from '../lib/certificateConfig';
import type { NameLayout } from '../lib/nameLayout';
import type { RenderedTemplate } from '../lib/renderTemplate';

interface Props {
  template: RenderedTemplate | null;
  /** Same layout object the PDF export uses; null draws the blank template. */
  layout: NameLayout | null;
}

const rgb = ([r, g, b]: readonly number[]) => `rgb(${r}, ${g}, ${b})`;

export function CertificatePreview({ template, layout }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;
    canvas.width = template.canvas.width;
    canvas.height = template.canvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(template.canvas, 0, 0);
    if (!layout) return;

    // Map PDF points (origin bottom-left, y-up) onto the canvas.
    const k = canvas.width / template.pageWidth;
    ctx.setTransform(k, 0, 0, -k, 0, template.pageHeight * k);

    const gradient = ctx.createLinearGradient(layout.ink.left, 0, layout.ink.right, 0);
    gradient.addColorStop(0, rgb(CERTIFICATE_CONFIG.gradient.left));
    gradient.addColorStop(1, rgb(CERTIFICATE_CONFIG.gradient.right));

    ctx.beginPath();
    for (const c of layout.path) {
      if (c.op === 'M') ctx.moveTo(c.x, c.y);
      else if (c.op === 'L') ctx.lineTo(c.x, c.y);
      else if (c.op === 'C') ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
      else ctx.closePath();
    }
    ctx.fillStyle = gradient;
    ctx.fill('nonzero');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [template, layout]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10 aspect-[841.92/595.2]">
      {template ? (
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          role="img"
          aria-label={layout ? `Certificate preview for ${layout.text}` : 'Blank certificate preview'}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-neutral-500">
          Loading certificate template…
        </div>
      )}
    </div>
  );
}
