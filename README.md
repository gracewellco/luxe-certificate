# Luxe Auto Works — Certificate Generator

Type a recipient's name, preview it on the certificate, download a print-ready PDF.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (no backend needed)
npm run samples    # writes test certificates to sample-output/
npm run samples -- "Jane Doe" "Li Wu"
```

## How it works

- `public/Luxe-Auto-Works-Certificate-Blank-Template.pdf` is the master. It is loaded with
  pdf-lib and **never redrawn**: the original page and its artwork stream are copied into
  every export unchanged. The only thing added is the name.
- The name is drawn as vector glyph outlines from the script font, filled with a PDF
  gradient (gold → champagne), so it stays sharp at any print size. The font is also
  embedded as an invisible text layer so the name remains searchable/selectable.
- Each name is horizontally centered on the page using its real painted width:
  `x = (pageWidth − nameWidth) / 2`. Long names shrink in font-size steps (no squashing)
  until they fit.
- The on-screen preview draws the exact same outline/position as the PDF
  (`src/lib/nameLayout.ts` is shared by both).

## Tuning

Everything lives in [`src/lib/certificateConfig.ts`](src/lib/certificateConfig.ts):
font sizes, max name width, vertical position (`nameCenterY`), gradient colours,
filename prefix.

**Changing the font:** put the `.ttf`/`.otf` in `public/fonts/`, update `fontPath`, then
run `npm run samples` and adjust `preferredFontSize` if needed. No other code changes.

Lobster Two is licensed under the SIL Open Font License (`public/fonts/OFL.txt`).
