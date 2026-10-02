/**
 * Single source of truth for everything that controls how the recipient name
 * is placed on the master certificate. Both the browser preview and the PDF
 * export read from here — tune values in this file only.
 *
 * Coordinates are PDF points (1/72 inch) with the origin at the BOTTOM-LEFT
 * of the page, as in the PDF spec. The template page is A4 landscape
 * (841.92 × 595.2 pt).
 */

export type RGB = readonly [r: number, g: number, b: number];

export const CERTIFICATE_CONFIG = {
  /** Master template, relative to /public. Never modified — only drawn over. */
  templatePath: 'Luxe-Auto-Works-Certificate-Blank-Template.pdf',

  /**
   * Script font, relative to /public. To swap fonts, drop a new .ttf/.otf
   * into public/fonts and change this path (then re-check the sizes below).
   */
  fontPath: 'fonts/LobsterTwo-Regular.ttf',

  /** Font size used for every name that fits within the max width. */
  preferredFontSize: 50,

  /** Long names shrink toward this size; they never go below it. */
  minimumFontSize: 30,

  /** Step used when shrinking a long name. */
  fontSizeStep: 0.25,

  /** Max ink width of the name, as a fraction of the page width. */
  maxNameWidthRatio: 0.52,

  /**
   * Vertical center of the name area: midway between the bottom of
   * "LUXE AUTO WORKS CERTIFIES THAT:" and the top of the body copy.
   * The name's descender-to-cap-height band is centered on this line, so it
   * stays put no matter which letters (or how many descenders) a name has.
   */
  nameCenterY: 287.2,

  /** Left → right gold/champagne gradient across the name's ink width. */
  gradient: {
    left: [190, 143, 42] as RGB,
    right: [246, 215, 155] as RGB,
  },

  /** Download name: `${filenamePrefix}-First-Last.pdf` */
  filenamePrefix: 'Luxe-Auto-Works-Certificate',
} as const;

export type CertificateConfig = typeof CERTIFICATE_CONFIG;
