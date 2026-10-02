import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CertificatePreview } from './components/CertificatePreview';
import { type CertificateAssets, loadCertificateAssets, parseFont } from './lib/assets';
import { CERTIFICATE_CONFIG } from './lib/certificateConfig';
import {
  CertificateInputError,
  buildCertificateFilename,
  generateCertificate,
  validateRecipientName,
} from './lib/generateCertificate';
import { layoutName, normalizeName } from './lib/nameLayout';
import { type RenderedTemplate, renderTemplate } from './lib/renderTemplate';

/** Preview resolution (px). High enough to stay crisp on large/retina screens. */
const PREVIEW_PIXEL_WIDTH = 2400;

type Busy = 'preview' | 'download' | null;
type Notice = { kind: 'success' | 'error'; text: string } | null;

export default function App() {
  const [assets, setAssets] = useState<CertificateAssets | null>(null);
  const [template, setTemplate] = useState<RenderedTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rawName, setRawName] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadCertificateAssets()
      .then(async (a) => {
        const t = await renderTemplate(a.templateBytes, PREVIEW_PIXEL_WIDTH);
        if (!cancelled) {
          setAssets(a);
          setTemplate(t);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = normalizeName(rawName);

  // Live validation + the exact layout the PDF export will use.
  const { layout, inputError } = useMemo(() => {
    if (!assets || !template || !name) return { layout: null, inputError: null };
    try {
      validateRecipientName(name, assets.fontBytes);
      return { layout: layoutName(parseFont(assets.fontBytes), name, template.pageWidth), inputError: null };
    } catch (err) {
      return { layout: null, inputError: err instanceof Error ? err.message : String(err) };
    }
  }, [assets, template, name]);

  const ready = assets !== null && template !== null;
  const shrunk = layout !== null && layout.fontSize < CERTIFICATE_CONFIG.preferredFontSize;

  async function run(kind: Exclude<Busy, null>) {
    if (!ready || busy) return;
    setNotice(null);
    if (!name) {
      setNotice({ kind: 'error', text: 'Recipient name is required.' });
      inputRef.current?.focus();
      return;
    }

    // Open the tab synchronously (inside the click) so popup blockers allow it.
    const previewTab = kind === 'preview' ? window.open('', '_blank') : null;
    setBusy(kind);
    try {
      const bytes = await generateCertificate(name, assets);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const filename = buildCertificateFilename(name);

      if (kind === 'preview') {
        if (previewTab) previewTab.location.href = url;
        else window.location.assign(url);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setNotice({ kind: 'success', text: `Downloaded ${filename}` });
      }
    } catch (err) {
      previewTab?.close();
      const text =
        err instanceof CertificateInputError
          ? err.message
          : `Couldn't create the PDF: ${err instanceof Error ? err.message : String(err)}`;
      setNotice({ kind: 'error', text });
    } finally {
      setBusy(null);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void run('preview');
  }

  function handleClear() {
    setRawName('');
    setNotice(null);
    inputRef.current?.focus();
  }

  const error = inputError ?? (notice?.kind === 'error' ? notice.text : null);
  const disabled = !ready || busy !== null || inputError !== null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">Luxe Auto Works</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Certificate Generator</h1>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[340px_1fr] lg:py-10">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div>
            <label htmlFor="recipient" className="mb-2 block text-sm font-medium text-neutral-300">
              Recipient Name
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="recipient"
                type="text"
                value={rawName}
                onChange={(e) => {
                  setRawName(e.target.value);
                  if (notice) setNotice(null);
                }}
                placeholder="e.g. Chally Ramos"
                autoComplete="off"
                autoFocus
                spellCheck={false}
                aria-invalid={error !== null}
                aria-describedby="recipient-help"
                className="w-full rounded-md border border-white/15 bg-neutral-900 px-3 py-2.5 pr-9 text-base text-white placeholder:text-neutral-500 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 aria-invalid:border-red-500/70"
              />
              {rawName && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear name"
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-neutral-500 hover:text-neutral-200"
                >
                  ✕
                </button>
              )}
            </div>
            <p id="recipient-help" className="mt-2 min-h-5 text-sm" role="status">
              {error ? (
                <span className="text-red-400">{error}</span>
              ) : notice?.kind === 'success' ? (
                <span className="text-emerald-400">✓ {notice.text}</span>
              ) : shrunk ? (
                <span className="text-neutral-400">Long name — reduced to {layout.fontSize} pt to fit.</span>
              ) : (
                <span className="text-neutral-500">Press Enter to preview the PDF.</span>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={disabled}
              className="rounded-md border border-gold/60 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'preview' ? 'Creating preview…' : 'Preview Certificate'}
            </button>
            <button
              type="button"
              onClick={() => void run('download')}
              disabled={disabled}
              className="rounded-md bg-gradient-to-r from-gold to-champagne px-4 py-2.5 text-sm font-semibold text-neutral-950 shadow-lg shadow-gold/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'download' ? 'Creating PDF…' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!rawName && !notice}
              className="rounded-md px-4 py-2 text-sm text-neutral-400 transition hover:text-white disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          {name && (
            <p className="hidden truncate text-xs text-neutral-500 lg:block" title={buildCertificateFilename(name)}>
              File: {buildCertificateFilename(name)}
            </p>
          )}
        </form>

        <section aria-label="Certificate preview" className="min-w-0">
          {loadError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
              Couldn't load the certificate template: {loadError}
            </div>
          ) : (
            <CertificatePreview template={template} layout={layout} />
          )}
        </section>
      </main>
    </div>
  );
}
