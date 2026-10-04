import { mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
if (process.platform === 'darwin') {
  const output = resolve(root, '.runtime/vision-reader');
  const source = resolve(root, 'server/vision.swift');
  await mkdir(resolve(root, '.runtime'), { recursive: true });
  const compiled = await stat(output).catch(() => null);
  if (!compiled || compiled.mtimeMs < (await stat(source)).mtimeMs) {
    console.log('Preparing the Mac’s local voucher reader…');
    execFileSync('swiftc', ['-O', '-module-cache-path', resolve(root, '.runtime/swift-cache'), source, '-o', output], { stdio: 'inherit' });
  }
  console.log('Mac voucher reader ready. No API key needed.');
} else console.log('The handwritten-voucher reader requires a Mac. Uploads and manual editing remain available.');
