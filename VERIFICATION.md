# Verification — Gemini replacement, 4 October 2026

- `npm test`: 27 passed.
- `npm run test:ui`: 4 passed across 3 files (jsdom, not a physical browser).
- `npm run build`: passed. The existing lazily loaded HEIC converter produces a large-chunk warning.
- Dependency lockfile refreshed; npm audit reported zero vulnerabilities.
- Multipart output tests include thoughtSignature-only parts, text with extra metadata, whitespace, temperature 0 and an output budget of at least 2000 tokens. Runtime budget remains 8192.
- Provider tests use mocked Gemini responses: arbitrary configured models, missing settings, Google HTTP error/message preservation, JSON schema validation, request limits and queue pause/resume.
- Storage/export tests cover 100 photos, reopen persistence, blank export exclusion, numeric zero, review notes, mismatches, Excel round-trip and multi-page PDF.
- An earlier live curl check reported HTTP 200 for a previously configured model. The current configuration uses gemini-3.5-flash-lite; it has not been live-tested as part of this configuration update. The earlier result verifies past key/model access, not current handwriting accuracy.
- Physical iPhone camera/HEIC, visual browser layout and deployed Vercel behavior were not verified in this turn. No deployment was performed.
- Photos with no extracted data remain recoverable photo jobs, not successful vouchers; export filters them out.
- Two-digit years require manual century confirmation. AI output is unreviewed until the user checks it.

Environment loading regression checks pass: explicit root, empty shell variables, file reload and secret-free missing-variable diagnostics. Local safe check currently reports key false/model true in this project copy; user reports a working key in their curl-tested copy. No private values changed or printed.

Live HTTP-400 diagnosis: existing model/key returned 400 with responseJsonSchema, 200 without it. Removed provider schema option; strict local JSON validation remains. A Mac sips HEIC test conversion was black (visually confirmed); this does not test the browser converter. A subsequent readable voucher screenshot request returned provider 503 UNAVAILABLE/high demand. No successful real-voucher transcription claimed.
