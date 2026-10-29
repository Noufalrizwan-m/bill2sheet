# VoucherQuill credential and API access review

Reviewed 29 October 2026. This is a source/configuration review with automated checks,
not a penetration-test certification or verification of a hosted deployment.

## Findings and fixes

| Severity | Finding | Action |
| --- | --- | --- |
| High | `/api/read-voucher` previously accepted anonymous requests. An attacker could consume the owner's Gemini quota without extracting the key. Same-origin checking alone is not authentication. | Reading now requires an encrypted, eight-hour owner session. An unconfigured hosted deployment fails closed before contacting Gemini. See `server/access.js`, `api/session.js`, and `api/read-voucher.js`. |
| Medium | No application-level limits on sign-in attempts, concurrent reads, or read request frequency. | Added bounded per-process counters: 10 sign-in attempts per client / 15 minutes, 100 total sign-in attempts / 15 minutes, 6 admitted reads / minute, 120 / hour, at most 2 concurrent reads. Existing provider retry maximum remains 7 calls per admitted read. These counters are NOT distributed serverless quotas; see deployment requirements below. |
| Low | Diagnostics exposed server model/configuration details to anyone. | Anonymous status responses now contain booleans only; detailed configuration diagnostics require owner access or the explicit trusted local development path. |
| High / critical dependency advisories | The dependency audit flagged DOMPurify, Undici, and Vite. | Applied compatible patched versions through `npm audit fix`; the resulting dependency audit reports zero known vulnerabilities. |
| Defense in depth | Error-message redaction only covered a literal Gemini key. No build check guarded browser assets. | Central redaction covers the Gemini key and owner credentials, including escaped/URL-encoded forms. Provider messages are bounded. Public-asset and built-output secret checks run before/after every production build. |

## Secret exposure review

- No credential-pattern matches or matches for the configured local Gemini key were
  found in the scanned source, built browser assets, or 144 Git-history blobs.
- `.env.local` is ignored. The Gemini key remains in a server-side environment variable,
  is sent to Google in a request header, and is not used in browser code.
- New owner access credentials also remain server-side. The access password is submitted
  only to this site's sign-in endpoint. The browser receives an encrypted HttpOnly cookie;
  it does not receive the Gemini key or session encryption secret.
- No real secret values are included in this report or audit output.
- Scans do not establish whether a key was previously copied into a message, third-party
  log, unreferenced Git object, deleted remote repository, or older deployed artifact.
  Remote logs and Google/Vercel account settings were not accessed.
- If a real key has ever been exposed, revoke and replace it in Google AI Studio / Google
  Cloud and update the private server configuration. Removing code or Git text does not
  invalidate a key. This review did not revoke or rotate the existing Gemini key.

## Required hosted setup

Set these privately in the Vercel project's intended Production/Preview environment:

- `GEMINI_API_KEY`: existing provider key. Never use `VITE_` or `NEXT_PUBLIC_`.
- `GEMINI_MODEL`: model identifier.
- `VOUCHERQUILL_ACCESS_PASSWORD`: an independent random password, 16-256 characters.
- `VOUCHERQUILL_SESSION_SECRET`: a different random secret, 32-256 characters.

Do not reuse the Gemini key for either new setting. Use your password manager's random
password generator, and enter the values directly in the hosting environment settings.
Do not paste them into chat or a committed file. Deployments receive the variables only
when deployed/redeployed. Values were not changed in your local private file by this task.

Visitors can view the public page, but cannot spend your Gemini quota without the owner
password. This is an owner-only utility, not public account registration. A password you
share grants use of your Gemini quota; do not publish it with the LinkedIn demo.

Hosted sign-in requires HTTPS. Cookies use Secure, HttpOnly, SameSite=Strict, Path=/,
with the `__Host-` prefix. JSON and same-origin checks protect state-changing routes.
Sessions have an explicit server-checked expiry. Changing the owner password or session
secret invalidates existing sessions. Sign-out removes the current browser's cookie;
a previously stolen copy can remain valid until expiry or credential rotation because
sessions are stateless. Use a stateful session service for individual session revocation.

Before broader public use, configure a shared Vercel WAF/edge limit or a durable shared
rate-limit store. The in-process limits reset on restart and do not coordinate across
Vercel instances, regions, or the separate API functions. They are a secondary safeguard,
not an account-wide spending ceiling. Set provider quota/billing controls separately.

## Local development

The Vite server has an explicit development-only convenience path. It allows a loopback
peer AND a loopback Host (`localhost`, `127.0.0.1`, or `[::1]`) to read without signing in.
It ignores forwarded IP headers for this check. Deployed handlers do not enable this
path; Vercel disables it even if a caller attempts to configure the dev flag.

The former plain-HTTP Wi-Fi phone URL cannot sign in or make privileged reads. Use the
HTTPS deployment and owner password on your phone. Do not weaken cookie security to
send the password across plain HTTP. Existing browser records remain available for
manual editing/exporting without owner access.

## Verification and limits

Security checks cover anonymous denial, owner sign-in, cookie flags, tampered/expired
sessions, password rotation, sign-out, cross-origin rejection, JSON/body limits, local
bypass restrictions, brute-force limits, read limits, concurrency, and response redaction.
UI checks cover sign-in, sign-out, failed sign-in, and clearing password inputs.
Production builds scan both public files and generated browser output for credentials.
No live voucher was sent to Gemini during this audit.

Manual hosted verification remains required: redeploy with the private variables, check
that anonymous POSTs never call Gemini, sign in through HTTPS, review Secure/HttpOnly
cookies in browser developer tools, verify WAF/global limits, and inspect hosting logs
for accidental logging by platform integrations.

## Implementation references

- Encrypted cookie sessions: https://github.com/vvo/iron-session
- Cookie and session hardening: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Vercel-provided request headers: https://vercel.com/docs/headers/request-headers

Dependency patches applied: Vite 7.3.7, DOMPurify 3.4.17, Undici 8.12.3.
Owner sessions use iron-session 9.0.1; Node.js 22.13 or later is required.
