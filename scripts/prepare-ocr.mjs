import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const target = resolve(root, 'public/ocr');
await mkdir(target, { recursive: true });
await copyFile(resolve(root, 'node_modules/tesseract.js/dist/worker.min.js'), resolve(target, 'worker.min.js'));
for (const name of ['tesseract-core-lstm', 'tesseract-core-simd-lstm']) {
  for (const suffix of ['.wasm.js', '.wasm']) await copyFile(resolve(root, `node_modules/tesseract.js-core/${name}${suffix}`), resolve(target, `${name}${suffix}`));
}
await copyFile(resolve(root, 'node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz'), resolve(target, 'eng.traineddata.gz'));
console.log('Local OCR assets ready (engine + English model).');
