# VoucherQuill

A personal tool for turning handwritten payment vouchers into editable Excel records.
Upload or capture a photo, review the reading beside the original, correct it, and export
an Excel workbook or PDF. Handwriting recognition is assisted by Gemini and requires
human review.

Public site: https://voucherquill.vercel.app/

Previously named **Bill2Sheet**. The package name and browser storage keys retain that
name to preserve existing local records. This is an owner-operated prototype, not a
multi-user accounting service.

## Start here

Requirements: Node.js **22.13.0 or later**, npm, and a Gemini API key with access to the
configured model.

1. Run `npm ci` in the repository root.
2. Create a private `.env.local` using [.env.example](.env.example) as the template.
   Do not overwrite an existing working file.
3. Set the server variables below.
4. Run `npm run dev -- --port 5174`.
5. Open the URL printed by Vite; it may choose a different port if that port is busy.

The Vite plugin mounts the same API handlers used in production. No separate backend
process is needed. Actual loopback requests on the development server can read photos
without the owner password. This exception is disabled on Vercel. A phone using a
plain HTTP Wi-Fi address cannot use owner sign-in; use the HTTPS deployment.

### Environment variables

| Variable | Purpose | Required |
| --- | --- | --- |
| `GEMINI_API_KEY` | Private Google API credential, used only by the server | Yes for reading |
| `GEMINI_MODEL` | Model identifier, for example `gemini-3.5-flash-lite` | Yes for reading |
| `GEMINI_FALLBACK_MODEL` | Optional alternate Gemini model for busy/quota retries; blank disables it | No |
| `VOUCHERQUILL_ACCESS_PASSWORD` | Owner password, 16–256 characters | Yes on hosted deployments |
| `VOUCHERQUILL_SESSION_SECRET` | Separate random session-encryption secret, 32–256 characters | Yes on hosted deployments |

Use different values for the password and session secret; neither may equal the API
key. Never prefix these with `VITE_`, put them in frontend code, or commit their values.
Paste only the model identifier into `GEMINI_MODEL`: no quotes, `models/` prefix,
display name, or `GEMINI_MODEL=` assignment.

Local handlers reload the private environment file on each request. Vercel injects
the environment at deployment time; changing a dashboard variable requires a new
deployment. The local private file is not automatically sent to Vercel.

## Technology and source map

| Technology | How it is used |
| --- | --- |
| React 19 / React DOM | Workspace, editing dialogs, owner sign-in, and intro components |
| Vite 7 / React plugin | Development server and production browser build |
| CSS / Tailwind Vite integration | Layout and styling; most visual rules live in the CSS files |
| IndexedDB / localStorage | Device-local photos, records, sheet list, and queue controls |
| Gemini REST API / native fetch | Server-side handwriting extraction into JSON |
| iron-session / Node crypto | Encrypted owner session cookie and password checks |
| heic-to / canvas | HEIC fallback decoding and JPEG preparation |
| SheetJS xlsx | Browser-generated Excel exports |
| jsPDF / jspdf-autotable | Browser-generated PDF summaries |
| Lucide React | Interface icons |
| Node test runner / Vitest / Testing Library | Core and UI verification |

`three` remains a dependency and `src/paper-toss-scene.js` contains an earlier scene
implementation. The current intro does **not** use that scene: it uses two rendered
hand images plus CSS animation. Do not treat unused files as the current rendering path.

| Path | Responsibility |
| --- | --- |
| `index.html` | Document metadata, structured data, and refresh scroll reset |
| `src/main.jsx` | React entry point; mounts App and PaperToss |
| `src/App.jsx` | Workspace, uploads, register, review/edit, and export actions |
| `src/BrandIntro.jsx`, `src/brand.css`, `src/styles.css` | Hero, navigation, and paper/ink UI |
| `src/PaperToss.jsx`, `src/paper-toss.css` | Refresh intro: grip, release, flying paper, fade-out |
| `public/images/paper-toss-hand-*.png` | Required hand images; preserve both files |
| `src/OwnerAccess.jsx` | Sign-in form and session state |
| `src/uploads.js`, `src/photo-type.js`, `src/image.js` | File selection, type detection, conversion, compression |
| `src/register.js` | IndexedDB register operations |
| `src/sheets.js` | Sheet metadata and active-sheet selection |
| `src/api.js`, `src/queue-delay.js` | Persistent reading queue, retries, stop/resume, API calls |
| `src/Cropper.jsx` | Crop/rotate and retry preparation |
| `src/export.js`, `src/ExportReview.jsx` | Export generation and pre-export review |
| `shared/gemini.js` | Extraction prompt and provider-response mapping |
| `shared/voucher.js`, `shared/bill.js`, `shared/date-recovery.js` | Record rules, validation warnings, date handling |
| `shared/voucher-export.js`, `shared/export-review.js` | Export data and review checks |
| `api/read-voucher.js` | Protected Gemini endpoint, validation, limits, retries |
| `api/session.js` | Session status, password sign-in, and sign-out |
| `server/access.js` | Authentication rules, cookies, same-origin checks, rate counters |
| `server/http.js` | Bounded JSON handling, response headers, credential redaction |
| `server/local-env.js`, `vite.config.js` | Private local configuration and API middleware |
| `public/robots.txt`, `public/sitemap.xml` | Search crawler instructions and public homepage URL |
| `scripts/check-public-secrets.mjs` | Source/public and built-asset credential checks |
| `tests/` | Core, storage, queue, export, authentication, and UI tests |

## How the reading flow works

1. The user selects photos or captures a photo. Each original is saved in IndexedDB
   as a queued photo job before a successful reading exists.
2. The browser decodes the image. HEIC conversion is loaded when native decoding fails.
   Input is limited to 35 MB; the prepared JPEG has a longest side of at most 1600 px
   and a target maximum of 1.8 MB.
3. The client processes one queued photo at a time and posts JSON to
   `/api/read-voucher` on the same origin. It waits 2–3 seconds between jobs.
4. The server checks owner access, origin, content type, JPEG data, body size, and
   application limits before calling Google. The browser never receives the API key.
5. The server requests structured JSON for the foreground voucher. The prompt asks
   it to ignore background vouchers and signatures and preserve uncertainty.
6. The response is mapped into the local record. Empty or incomplete readings remain
   failed photo jobs; readable results are saved as unreviewed records.
7. The user compares the result with the photo, edits fields, or crops/rotates and
   retries. Arithmetic mismatches and uncertain fields need review.
8. Exports are created in the browser for the selected sheet. Excel contains voucher
   summary and line-item sheets; PDF contains a summary. Downloading does not delete
   saved records or update previously downloaded files.

All fields are optional. Unknown numeric values stay blank rather than being presented
as confirmed zero. Ambiguous dates and digits need manual review; do not assume the
AI has resolved them correctly.

Busy/quota responses (HTTP 503/429) allow up to seven provider calls, with increasing
delays and an optional explicitly configured fallback model. Other HTTP errors are
not automatically retried. Each provider request has a 20-second timeout; the client
allows 240 seconds. Failed photos stay available for retry. Authentication and
configuration failures pause processing. Stop/closing the connection cancels pending
client/server work where possible; a request already received by Google may finish.

## API contract

| Endpoint | Method | Behavior |
| --- | --- | --- |
| `/api/session` | GET | Returns authentication/configuration status |
| `/api/session` | POST | Accepts JSON `{ "password": "..." }`; establishes owner session |
| `/api/session` | DELETE | Clears this browser's session cookie |
| `/api/read-voucher` | GET | Returns safe configuration status; additional model diagnostics require authorization |
| `/api/read-voucher` | POST | Accepts JSON `{ "image": "<base64 JPEG or JPEG data URL>" }`; returns mapped voucher JSON or a safe error |

Owner sessions last up to eight hours. Hosted cookies are Secure, HttpOnly, and
SameSite=Strict. Rotating the password or session secret invalidates existing sessions.
Sign-out clears the cookie in the current browser; it does not clear saved voucher
data or revoke a copied cookie elsewhere before expiry.

## User data and privacy boundaries

**The application does not fetch another visitor's register from a shared server database.**
There is no server-hosted voucher database or endpoint for listing other users' records
in this implementation.

| Data | Location and access |
| --- | --- |
| Original photos and extracted records | IndexedDB, scoped to the browser profile and site origin |
| Sheet names and active selection | localStorage on the same origin |
| Photo submitted for reading | Sent through the server to Google Gemini |
| Owner session | Encrypted cookie, separate from voucher storage |
| Gemini credential and session configuration | Server environment only |
| Downloaded Excel/PDF files | User's download destination; no longer managed by the app |

This is **browser isolation, not account-based isolation**. Two people using the same
browser profile and origin share the same local register. Signing out only disables
hosted reading: existing records remain viewable/editable/exportable in that browser.
Separate sheets organize records; they are not security boundaries.

Records do not automatically sync between devices, browser profiles, localhost ports,
or deployment origins. Clearing browser/site data can remove them. Export backups.

Reading is not entirely offline or device-only: submitted photos and extracted content
pass through Google. This README makes no claim about Google's retention, training,
or data-use terms; review the applicable provider/account terms before using sensitive
documents. Operational logging in the handler is limited to provider status, model,
and attempt; hosting/provider infrastructure has its own logging behavior.

There is one owner-access password, no public signup, no per-user accounts, and no
tenant authorization model. Before introducing multiple accounts or cloud storage,
add server-side ownership checks for every record and file, session/tenant isolation,
and appropriate storage and deletion policies. Do not expose a shared record list.

## Security controls and limits

The server fails closed for reading when owner configuration is absent or invalid.
It validates same-origin requests, limits request sizes, and redacts configured secret
values from returned errors. The build scans public files and browser bundles for
credential exposure.

Current application counters are **per process**, not global across Vercel instances:
six reads per minute, 120 per hour, two simultaneous reads per process, plus sign-in
attempt limits. Use shared edge/WAF or durable limits and provider spending controls
when opening access more widely.

See [SECURITY.md](SECURITY.md) for the audit scope, controls, and remaining checks.
No automated scan establishes that the whole application is secure.

## Deployment to Vercel

- Connect the intended Git repository and production branch.
- Root Directory: the folder containing `package.json` (repository root for this layout).
- Framework: Vite. Build: `npm run build`. Output: `dist`.
- Configure all required environment variables for Production. Configure Preview
  separately if you use it. Never add frontend prefixes to private credentials.
- Deploy the latest source commit and verify the public production domain.

Redeploying an old deployment rebuilds its old source; it does not automatically select
the newest Git commit. Check the deployment commit before redeploying or promoting it.
Variable changes need a new deployment. This repository edit does not publish itself.

### Common failures

| Symptom | Check |
| --- | --- |
| Old UI on the public domain | Production deployment commit and domain assignment |
| Owner access not configured (503) | Both owner variables, lengths, distinct values, environment scope, then redeploy |
| Photo reading is private | Enter the configured owner access password, not the API key or session secret |
| Unexpected model name format (400) | Model identifier only; remove display names, prefixes, quotes, assignments |
| Missing Gemini configuration | Both Gemini variables must be present in the running deployment |
| Busy/quota error (429/503) | Provider quota, model availability, retry later |
| Connection interrupted | Browser-to-server connection/timeout; inspect API response and runtime logs before blaming the provider |
| Missing records on another device | Expected: storage is local to the browser and origin |

`npm run check:env` prints the local project root and presence booleans, not credentials.
A GET to the running `/api/read-voucher` reports safe status. Anonymous responses do not
include all authorized diagnostics. Do not share private request headers or cookies.

## Interface, refresh behavior, and SEO

The current UI uses a black-and-white bill/paper style, a sidebar workspace, a readable
hero, and responsive controls. The opening hand holds papers before releasing them.
There is no skip-intro button. Reduced-motion preferences suppress the animation;
image-load failure dismisses it instead of blocking the app.

A browser refresh resets the page to the hero and clears a section hash so the browser
does not restore a lower scroll position. Ordinary section-link navigation keeps its
anchors. The reset runs only for reload navigation in `index.html`.

The document includes a descriptive title, canonical URL, social metadata, and WebSite
JSON-LD with the alternate name "Voucher Quill". The sitemap lists only the homepage;
fragment sections are not separate pages. The robots file discourages API crawling;
it is **not** access control. Authentication still protects reading.

After deploying, verify the URL-prefix property in Google Search Console, submit
`https://voucherquill.vercel.app/sitemap.xml`, and request homepage indexing. Metadata
and sitemaps do not guarantee indexing or ranking. If the domain changes, update the
canonical, social URL, structured data, robots sitemap URL, and sitemap together.

## Recent changes

These describe the current implementation, not a complete historical release log.

| Area | Change |
| --- | --- |
| Branding | Bill2Sheet became VoucherQuill; legacy storage keys retained |
| UI | Monochrome paper styling, revised hero/sidebar, larger controls and alignment fixes |
| Intro | Grip/open hand assets and paper-flight animation; no skip button |
| Refresh | Reload from a lower section now starts at the hero |
| Storage/queue | Persistent photo jobs, saved sheets, review/edit, retry and stop/resume |
| Reading | Server-only Gemini calls; explicit model configuration and bounded retries |
| Access | Owner password and encrypted session; same-origin checks and request limits |
| Secret handling | Build-time public/bundle scans and sanitized errors |
| SEO | Canonical/social metadata, alternate name, robots file, homepage sitemap |
| Handoff | This README documents setup, architecture, data boundaries, and failure recovery |

## Checks and maintenance

```sh
npm test
npm run test:ui
npm run build
```

Tests cover provider contracts/errors, queue behavior, storage, export/review rules,
authentication, and UI behavior. A successful build also runs public-secret checks.
These do not establish real-world handwriting accuracy or prove every phone/HEIC
combination works.

Before a release, test one non-sensitive voucher through the deployed flow: sign in,
upload, inspect the original against the extracted fields, edit, export, refresh, and
confirm the local record remains. Test a failed reading and retry as well. Inspect the
exact deployment and its environment, not just localhost.

## Code and asset provenance

This project contains custom application code developed with AI assistance and uses
third-party packages. Package versions and sources are recorded in `package.json` and
`package-lock.json`; each dependency retains its own license.

The hand images used by the opening animation were AI-generated. They live in
`public/images/` and are required by `src/PaperToss.jsx`.

This document does not certify that every line or asset is unique or claim that no
external code was used. No full provenance audit has been completed. Do not copy
another user's private vouchers, credentials, or records into fixtures, documentation,
screenshots, or marketing assets. Use consented material or clearly fictional samples.
