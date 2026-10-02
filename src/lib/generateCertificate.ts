import fontkit from '@pdf-lib/fontkit';
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  appendBezierCurve,
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
} from 'pdf-lib';
import { type CertificateAssets, loadCertificateAssets, parseFont } from './assets';
import { CERTIFICATE_CONFIG } from './certificateConfig';
import { type NameLayout, findUnsupportedCharacters, layoutName, normalizeName } from './nameLayout';

/** A problem with the input the user can fix (shown verbatim in the UI). */
export class CertificateInputError extends Error {}

/** Validates and normalizes a recipient name. Throws CertificateInputError. */
export function validateRecipientName(raw: string, fontBytes?: Uint8Array): string {
  const name = normalizeName(raw);
  if (!name) throw new CertificateInputError('Recipient name is required.');
  if (fontBytes) {
    const missing = findUnsupportedCharacters(parseFont(fontBytes), name);
    if (missing.length > 0) {
      throw new CertificateInputError(
        `The certificate font can't draw: ${missing.join(' ')}`,
      );
    }
  }
  return name;
}

/** Luxe-Auto-Works-Certificate-Chally-Ramos.pdf */
export function buildCertificateFilename(recipientName: string): string {
  const slug = normalizeName(recipientName)
    .replace(/[\\/:*?"<>|]/g, '') // characters not allowed in filenames
    .replace(/ /g, '-');
  return `${CERTIFICATE_CONFIG.filenamePrefix}-${slug}.pdf`;
}

/**
 * Paints the name outline filled with a left→right gold gradient.
 * Vector outlines + a PDF axial shading: razor-sharp at any print resolution.
 */
function drawGradientName(pdfDoc: PDFDocument, page: PDFPage, layout: NameLayout) {
  const { left, right } = CERTIFICATE_CONFIG.gradient;
  const toUnit = (c: readonly number[]) => c.map((v) => v / 255);

  const shading = pdfDoc.context.register(
    pdfDoc.context.obj({
      ShadingType: 2,
      ColorSpace: 'DeviceRGB',
      Coords: [layout.ink.left, 0, layout.ink.right, 0],
      Function: { FunctionType: 2, Domain: [0, 1], C0: toUnit(left), C1: toUnit(right), N: 1 },
      Extend: [true, true],
    }),
  );

  const { Resources } = page.node.normalizedEntries();
  let shadings = Resources.lookupMaybe(PDFName.of('Shading'), PDFDict);
  if (!shadings) {
    shadings = pdfDoc.context.obj({});
    Resources.set(PDFName.of('Shading'), shadings);
  }
  const shadingName = PDFName.of('LuxeNameGradient');
  shadings.set(shadingName, shading);

  const pathOps = layout.path.map((c) => {
    switch (c.op) {
      case 'M':
        return moveTo(c.x, c.y);
      case 'L':
        return lineTo(c.x, c.y);
      case 'C':
        return appendBezierCurve(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
      case 'Z':
        return closePath();
    }
  });

  page.pushOperators(
    pushGraphicsState(),
    ...pathOps,
    clip(), // nonzero winding, matching TrueType outlines
    endPath(),
    PDFOperator.of(PDFOperatorNames.ShadingFill, [shadingName]),
    popGraphicsState(),
  );
}

/**
 * Loads the master PDF, adds the recipient name, and returns the finished
 * PDF bytes. Nothing else on the page is touched.
 *
 * `assets` is optional: the browser fetches them from /public; scripts/tests
 * can pass bytes read from disk.
 */
export async function generateCertificate(
  recipientName: string,
  assets?: CertificateAssets,
): Promise<Uint8Array> {
  const { templateBytes, fontBytes } = assets ?? (await loadCertificateAssets());
  const name = validateRecipientName(recipientName, fontBytes);

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.getPage(0);
  const { width: pageWidth } = page.getSize();

  const layout = layoutName(parseFont(fontBytes), name, pageWidth);
  drawGradientName(pdfDoc, page, layout);

  // Invisible copy of the name in the embedded font, so the certificate text
  // stays searchable/selectable. The visible name is the gradient outline above.
  const embeddedFont = await pdfDoc.embedFont(fontBytes, { subset: true });
  page.drawText(name, {
    x: layout.originX,
    y: layout.baselineY,
    size: layout.fontSize,
    font: embeddedFont,
    opacity: 0,
  });

  pdfDoc.setTitle(`Luxe Auto Works Certificate – ${name}`);
  return pdfDoc.save();
}
