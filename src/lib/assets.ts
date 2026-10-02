import fontkit, { type Font } from '@pdf-lib/fontkit';
import { CERTIFICATE_CONFIG } from './certificateConfig';

/** Raw bytes for the master template and the script font. */
export interface CertificateAssets {
  templateBytes: Uint8Array;
  fontBytes: Uint8Array;
}

let assetsPromise: Promise<CertificateAssets> | null = null;

async function fetchBytes(path: string): Promise<Uint8Array> {
  const base = import.meta.env?.BASE_URL ?? '/';
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Fetches the template and font from /public once, then reuses them. */
export function loadCertificateAssets(): Promise<CertificateAssets> {
  assetsPromise ??= Promise.all([
    fetchBytes(CERTIFICATE_CONFIG.templatePath),
    fetchBytes(CERTIFICATE_CONFIG.fontPath),
  ])
    .then(([templateBytes, fontBytes]) => ({ templateBytes, fontBytes }))
    .catch((err) => {
      assetsPromise = null; // allow a retry after a network error
      throw err;
    });
  return assetsPromise;
}

const parsedFonts = new WeakMap<Uint8Array, Font>();

/** Parses font bytes with fontkit (cached per byte buffer). */
export function parseFont(fontBytes: Uint8Array): Font {
  let font = parsedFonts.get(fontBytes);
  if (!font) {
    font = fontkit.create(fontBytes);
    parsedFonts.set(fontBytes, font);
  }
  return font;
}
