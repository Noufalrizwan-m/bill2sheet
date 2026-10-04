# Verification — 2026-10-04

## Passing checks

- 22 Node tests: printed OCR fixture, 100-record IndexedDB persistence, retry deduplication, edits/deletion, Excel round-trip with numeric cells, multipage voucher PDF, strict checked-value parsing, foreground field anchors, and unconfirmed handwriting excluded from exports.
- 2 simulated React UI tests: camera return adds one row despite input/change events; second photo appends; remount retains records; fields remain optional; malformed handwriting suggestions cannot be copied as numbers and require explicit checking.
- Production build succeeds. Handwriting is a separate worker bundle.
- Actual ONNX WebAssembly encoder inference succeeded with the shipped model and runtime: output shape [1, 578, 384]. This was a Node runtime smoke test, not an iPhone browser test.
- Running preview serves the handwriting encoder with HTTP 200.
- Updated handwriting dependency installation reports zero npm audit vulnerabilities.

## Actual sample accuracy — failed exact-transcription acceptance

The supplied HEIC was previously converted locally to PNG. No photo was uploaded to an external OCR service. Tests used manually selected name/date/amount line crops, then the same contrast-cleanup function used by the app.

Production small model (full-precision encoder, quantized decoder):
- Name: `Gras Both Camp :`
- Date: `27106126.`
- Amount: `( 7 2s )`

Larger comparison model:
- Name: `Grady Both-camp`
- Date: `27106126.`
- Amount: `1 725`

Neither model passed exact transcription. The larger model was not shipped because its additional download/memory does not resolve the errors. The free feature is explicitly an assisted reader; suggestions remain separate from saved Excel values until the user checks/corrects and saves them. No claim of reliable unattended 100-bill handwriting extraction is made.

## Remaining verification limits

- Physical iPhone camera behavior, HEIC variants, browser inference speed/memory and visual layout remain unverified. Browser automation was unavailable under the environment's browser policy.
- The page's image/record queue is durable, but processing pauses when the page closes.
- No deployment or cross-device synchronization performed. A development Wi-Fi address needs its host running; the deployed static app has no Mac-specific code or API-key dependency.
