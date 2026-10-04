# Bill2Sheet — free local handwriting helper

Personal React/Vite/Tailwind app. Photos, recognition, saved records and exports run in the browser. **No API key, no paid inference service and no Mac-only reader.**

## Run

1. Install Node.js 22.12+.
2. Open this `bill2sheet` folder in a terminal.
3. Run `npm ci`.
4. Run `npm run dev`. First preparation downloads the free model from Hugging Face (about 150 MB of model/tokenizer files plus the runtime). There is no model account or payment requirement. Existing downloaded assets are reused.
5. Open the printed URL. On a phone, use the Network URL while the development computer is running on the same Wi-Fi.

No `.env` configuration is used. An old private `.env.local` is left untouched but is not read by the free app.

## Workflow

1. Choose **Free handwriting helper**, then Take Photo → Use Photo, or Upload from Photos. Multiple photos are accepted.
2. Each selected photo is saved immediately in IndexedDB. Photos process sequentially; progress appears in the register.
3. The printed-label reader locates foreground payment-voucher fields. TrOCR reads the located handwritten lines and stores **suggestions**, not verified values.
4. Open Edit. Select Paid to, Date or Amount in **Free handwriting helper**. If needed, choose **Read handwritten field**, crop tightly around that single handwritten line, and read it again. Sliders can reach every edge; Rotate handles sideways images.
5. Correct the suggested text, choose **Use checked text**, then **Save changes**. You can also type directly into any field. Every field is optional.
6. Export Excel/PDF whenever needed. Downloading does not clear the register.

**The supplied handwritten voucher did not pass exact-transcription testing.** The production preprocessing/model read the manually cropped sample as `Gras Both Camp :`, `27106126.`, and `( 7 2s )`. The intended payee/date/amount cannot safely be inferred from these strings automatically. The app therefore does not put unconfirmed handwriting suggestions into the exported fields. This is an assisted free reader, not reliable unattended transcription of 100 handwritten bills.

TrOCR is designed for single handwritten text lines, not whole pages. Whole-page field location is conservative; if labels are unclear, select the handwritten lines manually. Current recognition is for English/Latin handwriting. There is no automatic perspective correction. Poor focus, shadows, ruled lines and uncommon handwriting can still require manual entry.

## Privacy, storage and mobile limits

- Model files and runtime are served by the same website. Recognition does not upload bill photos to an external service. Photos are processed in a worker on the current device.
- About 160 MB loads on first handwriting use; the browser may cache it. Memory requirements can be significantly larger than the download. Some phones may time out or lack sufficient memory; errors keep the saved photo and allow manual entry.
- The original photo remains stored. HEIC is decoded natively or converted locally; unsupported variants show an error. JPEG is a fallback.
- Closing the page pauses work. Reopening resumes unfinished photos and retains saved records. Browser storage can be cleared or evicted; download backups. Private browsing is not durable storage.
- Registers are per browser/origin. Different phones/computers do **not** synchronize automatically.
- Previous localStorage bills migrate once into IndexedDB. New records and originals use IndexedDB for greater capacity.
- The register saves automatically, not an existing Excel file on disk. Export downloads a new editable workbook.

## Excel / PDF

First Excel tab: **No. | PAID TO | Date | AMOUNT (AED)**. Second tab: line items. Rows sort by valid date. Single amounts are numeric cells. Unconfirmed handwriting stays blank. Combined values typed by the user remain text and are excluded from the numeric grand total. PDF uses the same four columns. Its built-in font supports Latin text.

To change a downloaded workbook, edit it in Excel. Those external edits do not sync back to the app; use Excel's PDF export after editing there.

## Use independently of the development computer

Deploy as a static Vite website on your chosen host: build `npm run build`, publish `dist/`. Build preparation needs access to Hugging Face once. No serverless function or secret environment variables are required. A static HTTPS address lets each device use its own register without keeping your Mac running. Hosting account limits, bandwidth and model-file limits still apply. This task has **not** deployed the website or added cross-device sync.

## Files

- `src/App.jsx`: capture, queue status, editing, exports
- `src/HandwritingReview.jsx`: field suggestions and explicit confirmation
- `src/handwriting.js`, `src/handwriting.worker.js`: sequential on-device inference
- `shared/handwriting.js`: field location, cleanup and strict checked-value parsing
- `src/Cropper.jsx`: rectangular crop / rotation
- `src/register.js`, `src/outbox.js`: IndexedDB persistence
- `src/image.js`: HEIC conversion and compression
- `src/ocr.js`: printed labels and optional printed-bill reader
- `shared/voucher-export.js`: Excel and PDF
- `scripts/prepare-handwriting.mjs`: model/runtime preparation
- `server/`: retired experiments, not imported or deployed by this static app

## Test

`npm test`, `npm run test:ui`, `npm run build`.

Tests cover persistence of 100 records, retry deduplication, exports, handwritten suggestions being excluded until checked, strict numeric/date parsing, and simulated camera→append→reopen→edit flows. They do not certify real iPhone camera or browser inference performance. The local model was run on the supplied photo, with the inaccurate results documented above.

Sources: [TrOCR intended use](https://huggingface.co/microsoft/trocr-small-handwritten), [browser-compatible model](https://huggingface.co/Xenova/trocr-small-handwritten), [Transformers.js](https://github.com/huggingface/transformers.js).
