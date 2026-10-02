import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface RenderedTemplate {
  /** The untouched master page, rasterized for on-screen preview only. */
  canvas: HTMLCanvasElement;
  pageWidth: number;
  pageHeight: number;
}

/** Rasterizes page 1 of the template for the preview background (never exported). */
export async function renderTemplate(templateBytes: Uint8Array, pixelWidth: number): Promise<RenderedTemplate> {
  // pdf.js takes ownership of the buffer it's given, so hand it a copy.
  const task = pdfjs.getDocument({ data: templateBytes.slice() });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: pixelWidth / base.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;

    return { canvas, pageWidth: base.width, pageHeight: base.height };
  } finally {
    void task.destroy();
  }
}
