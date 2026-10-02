/**
 * Saves a generated PDF to the user's device in the way each platform supports.
 *
 * Call this synchronously from a click/tap handler (no `await` before it):
 * iOS only allows the share sheet / downloads during a user gesture.
 */

export type SaveResult = 'downloaded' | 'shared' | 'cancelled';

/** iPhone, iPod, and iPad (iPadOS reports itself as a Mac with touch). */
export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function downloadViaLink(bytes: Uint8Array, filename: string) {
  // A generic binary type makes mobile browsers (notably Chrome on Android)
  // save the file instead of opening it in their built-in PDF viewer.
  const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Mobile browsers can read the blob well after the click; don't revoke early.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function savePdf(bytes: Uint8Array, filename: string): Promise<SaveResult> {
  if (isIOS()) {
    // iOS has no general "download" — the native share sheet's "Save to Files"
    // is the reliable path in Safari and in Chrome/Firefox on iOS.
    const file = new File([bytes as BlobPart], filename, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      return navigator.share({ files: [file], title: filename }).then(
        (): SaveResult => 'shared',
        (err: unknown): SaveResult => {
          if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
          downloadViaLink(bytes, filename);
          return 'downloaded';
        },
      );
    }
  }
  downloadViaLink(bytes, filename);
  return Promise.resolve('downloaded');
}
