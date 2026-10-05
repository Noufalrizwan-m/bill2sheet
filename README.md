# Bill2Sheet — Gemini voucher reader

React + Vite + Tailwind; server-only Gemini vision; IndexedDB photo queue/register; editable Excel and PDF exports. Only the foreground voucher is requested. All fields are optional. AI output must be checked against the photo; exact handwriting is not guaranteed.

## Configure privately

Install Node.js 22.12 or later. Open a terminal in this folder and run `npm install`. Create `.env.local` (or edit the existing file; do not overwrite a working key):

```dotenv
GEMINI_API_KEY=your_private_AI_Studio_key
GEMINI_MODEL=gemini-3.6-flash
```

No VITE_ prefix. Never commit or paste the key into chat. Both settings are required; there is no hard-coded model, allowlist or paid/provider fallback. The model above is documented at https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash . Check your project's model access and quota. Model availability does not guarantee free access; keep billing disabled if you only want free quota.

## Test key and model before starting

In this folder, load your private environment and run this single curl request. This checks model/key access, not handwriting accuracy. The subshell keeps settings out of later shell sessions; do not run with shell tracing enabled.

```sh
( set -a; . ./.env.local; set +a; curl --fail-with-body --silent --show-error --write-out '\nHTTP %{http_code}\n' "https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent" --header 'Content-Type: application/json' --header "x-goog-api-key: ${GEMINI_API_KEY}" --data '{"contents":[{"parts":[{"text":"Return JSON with ok equal to true."}]}],"generationConfig":{"responseMimeType":"application/json","temperature":0}}' )
```

HTTP 200 means the request succeeded. Otherwise Google returns its actual error: check model name/access for 404, key restrictions for 400/403, quota for 429. Never share request headers or the key.

## Run locally and on iPhone

```sh
npm run dev -- --host 0.0.0.0 --port 5173
```

Vite's server middleware runs the exact `/api/read-voucher` handler locally; no separate proxy or backend command is needed. Restart once after installing this update. The local API then rereads `.env.local` for each request. On the Mac open http://localhost:5173. On the iPhone, connect to the same Wi-Fi and open the Network URL Vite prints (for example http://192.168.1.242:5173). Use the actual printed port. The Mac must stay running for this local URL. File-input camera capture works without relying on getUserMedia. Allow local-network/firewall access if prompted.

## Vercel

Set the Vercel project Root Directory to `bill2sheet` (or the folder containing this package.json). Use Vite, build `npm run build`, output `dist`. Add GEMINI_API_KEY and GEMINI_MODEL in Vercel Settings → Environment Variables for the intended environment, then redeploy. `.env.local` is not uploaded. `/api/read-voucher.js` is the sole server function. Use the deployed HTTPS address on your phone; it does not require the Mac to stay on. This edit does not itself deploy your project.

## Flow and review

1. Take a photo or select multiple images. Original photos persist on this device as queue jobs, not successful vouchers.
2. HEIC is decoded natively or converted to JPEG; images are scaled to at most 1600 pixels on the longest side and compressed before sending.
3. Gemini reads the top voucher only, ignores signatures/background vouchers, and returns JSON. The Being line is included in particulars. Ambiguous digits stay null. A two-digit year stays null with the visible date in a review note because the century is not guessed; enter the full date after checking.
4. Readable results populate vendor, date, numeric total and items with reviewed:false. All-null results remain failed photo jobs with Retry/Edit; no empty successful voucher is created.
5. Unclear fields and row-total mismatches are red. Open Edit to compare the photo, crop/rotate and retry, change row amounts, and explicitly confirm resolved uncertainty. Save changes does not block on missing fields. Arithmetic mismatches remain red until corrected.
6. Export includes only rows with voucher data. Excel has Vouchers (No., PAID TO, Date, AMOUNT (AED), Review notes) and Line Items. PDF uses the same summary columns. Numeric totals remain editable numbers; unknown amounts remain blank. No numeric amounts means NO AMOUNTS ENTERED, not a misleading zero.

Queue pauses on provider/network errors; the real Google status/message appears beside the saved photo. Resume after fixing configuration/quota. No automatic cross-provider fallback. Keep the page open while reading; interrupted jobs resume when reopened.

Register/photos persist in IndexedDB on the same browser and origin, including after refresh. They do not sync between devices or between a Wi-Fi URL and Vercel. Export backups before clearing browser data. Downloading does not clear the register. An already downloaded workbook is not automatically rewritten.

## Checks

`npm test`, `npm run test:ui`, `npm run build`.

Automated checks cover provider contracts/errors, photo-queue pause/resume, blank-result rejection, 100 stored photos, numeric Excel round-trip and PDF pagination. Real handwriting accuracy and physical iPhone camera/HEIC capture still need a configured key and device test. Upload one voucher first; compare every digit, then try a batch and reopen the page before exporting.

## Diagnose missing server variables

The key check is in `api/read-voucher.js`. It expects exactly `GEMINI_API_KEY` and `GEMINI_MODEL`. `src/api.js` sends images to that endpoint and never reads the key. `server/local-env.js` loads the private file for Vite; it is not browser code. The Vercel function uses its injected process environment.

Run `npm run check:env` in this project. It prints the exact project root and only true/false for each setting. Local loading reads `.env.local` relative to the source project, independent of the terminal working directory. Nonempty file values take precedence over inherited shell values; neither value is changed. Missing/empty file entries fall back to the process environment.

After starting Vite, confirm the running server (not just the file) with:

```sh
curl --silent --show-error http://localhost:5173/api/read-voucher
```

The result has `variables.GEMINI_API_KEY` and `variables.GEMINI_MODEL` booleans, `configured`, and missing variable names. It never returns the key. Use the port shown by Vite if different. A 503 names missing variables. If the file check says true but the running endpoint says false, verify the URL/port and project copy, and stop/restart the old process.

No separate dev proxy is needed: Vite handles `/api/read-voucher` on its own server port. The iPhone uses that same relative endpoint, not localhost on the phone.

## Exact Vercel environment steps

1. Open Vercel dashboard → your Bill2Sheet project → Settings → Environment Variables.
2. Add `GEMINI_API_KEY` with your existing tested key. Select both Production and Preview. Save. Do not add a VITE_ prefix.
3. Add `GEMINI_MODEL` with your existing tested model value. Select both Production and Preview. Save. Leave Preview branch scope unrestricted unless you deliberately need an override.
4. Open Deployments. Choose the latest deployment with this updated source → three-dot menu → Redeploy. Redeploy Production and any Preview deployment you intend to test so each gets its scoped values. An older deployment does not acquire new variables automatically.
5. Open `/api/read-voucher` on the exact deployment URL; both booleans should be true. Then retry the queued photo in the app.

`.env.local` is ignored and is not uploaded to Vercel. Setting Production alone does not configure Preview. These edits do not deploy or change your Vercel settings automatically.

Official reference: https://vercel.com/docs/environment-variables

## Busy-model retries (local)

Optional `.env.local` setting:

```dotenv
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
```

Keep the existing GEMINI_API_KEY and GEMINI_MODEL. An empty/missing fallback means all attempts use the primary. No model is silently selected by the code. Both models use the same key and their respective project quotas.

503/429 responses get up to six retries after the first attempt (seven calls maximum), alternating primary/fallback. Waits are approximately 2, 4, 8, 16, 20, 20 seconds, each with 0–499 ms jitter. Other HTTP errors are not automatically retried. Each provider call has a 20-second timeout; client timeout is 240 seconds to cover the bounded retry sequence. A timed-out provider call is kept as a failed photo rather than retried automatically.

Requests use thinkingConfig.thinkingLevel low, maxOutputTokens 2000, temperature 0 and application/json output. All response text parts are joined. Production request logs contain only status, model and attempt. Keys, photos and extracted text are not logged.

The client reads one voucher at a time, with 2–3 seconds between jobs. Exhausted busy/quota failures remain in Retry failed, while later jobs continue. Authentication/model-configuration failures pause the queue. Use Retry failed photos to queue failures again; Stop processing still preserves originals and prevents further work. Closing/stopping the client aborts server retries when the HTTP connection closes; work already received by Google may still finish.

Restart the local server once after this update, then refresh the phone. Subsequent private environment edits are loaded on each request.
