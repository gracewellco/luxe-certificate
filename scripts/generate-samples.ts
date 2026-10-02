/**
 * Generates sample certificates with the exact same code the app uses.
 *   npm run samples                     → default test names
 *   npm run samples -- "Jane Doe" "Li Wu"
 * Output: sample-output/
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CERTIFICATE_CONFIG } from '../src/lib/certificateConfig';
import { buildCertificateFilename, generateCertificate } from '../src/lib/generateCertificate';

const DEFAULT_NAMES = [
  'Chally Ramos',
  'Lucas A. Hernandez',
  'Alexander Montgomery',
  'Christopher Alexander Hernandez',
  'Li Wu',
];

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'sample-output');
const names = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_NAMES;

const assets = {
  templateBytes: new Uint8Array(await readFile(path.join(root, 'public', CERTIFICATE_CONFIG.templatePath))),
  fontBytes: new Uint8Array(await readFile(path.join(root, 'public', CERTIFICATE_CONFIG.fontPath))),
};

await mkdir(outDir, { recursive: true });
for (const name of names) {
  const bytes = await generateCertificate(name, assets);
  const file = buildCertificateFilename(name);
  await writeFile(path.join(outDir, file), bytes);
  console.log(`✓ ${file} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
}
