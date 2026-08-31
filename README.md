# heyroo.dev

A portable, static personal site built with Vite and TypeScript. The repository may stay named `me`; hosting and URLs are defined by the Cloudflare configuration, not by the GitHub repository name.

The current build has two real pages:

- `/` is a profile-neutral placeholder for the future site.
- `/me/` is the QR-first digital business card.

Cloudflare Workers Static Assets serves the generated `dist/` directory. There is no Worker script, application server, framework runtime, analytics, service worker, external font, CDN asset, or third-party runtime request.

## Local development

Requirements: Node.js 24 and npm.

1. Copy `profile.example.json` to `.profile.local.json`.
2. Replace the example fields locally, including the configured custom-domain `/me/` URL.
3. Run `npm ci`, then `npm run dev`.

The development server exposes both the homepage and `/me/`. The profile generator creates ignored files at:

- `me/index.html`
- `src/generated/profile.ts`
- `public/me/<name>.vcf`
- `public/me/card-qr.svg`

If the local profile is absent, ordinary development, CI, and preview builds use committed example data.

Useful checks:

```sh
npm test
npm run typecheck
npm run build
```

The final artifact is:

```text
dist/
├── index.html
├── 404.html
├── _headers
├── assets/
├── robots.txt
└── me/
    ├── index.html
    ├── icons.svg
    ├── card-qr.svg
    └── <name>.vcf
```

The build enforces the card budgets independently of the future homepage: HTML below 10 KiB, referenced CSS below 30 KiB, and referenced JavaScript below 20 KiB. It also rejects production source maps, external runtime resources, network APIs, service workers, missing security policies, and stale card files at the origin root.

## Production profile

The production profile is one JSON object matching `profile.example.json`. Store it in Cloudflare Builds as the encrypted `CARD_PROFILE_JSON` secret. It is a build-time secret, not a runtime Worker variable.

`npm run build:production` is fail-closed:

- the secret must exist and parse successfully;
- the profile must pass validation;
- its card URL must match the permanent URL fingerprint;
- none of its values may appear in tracked or non-ignored repository source.

The secret keeps personal fields out of GitHub code search and preview builds. It does not make the deployed card confidential; its rendered HTML, contact file, and QR payload are public.

## Cloudflare deployment

`wrangler.jsonc` defines an assets-only Worker, the `heyroo.dev` custom-domain route, static HTML handling, and the custom 404 page. The zone must be active in the same Cloudflare account used by Builds.

Connect this GitHub repository under **Workers & Pages > Create > Import a repository** and configure separate build triggers:

| Trigger | Build command | Deploy command | Profile secret |
| --- | --- | --- | --- |
| Production `main` | `npm run build:production` | `npm run deploy:cloudflare` | `CARD_PROFILE_JSON` |
| Preview branches | `npm run build` | `npm run deploy:cloudflare:preview` | none |

The deploy command independently checks that `dist/me/index.html` contains the permanent production URL before publishing the custom domain. Preview uploads contain example data and do not receive deployment authority over production.

The GitHub Actions CI workflow remains read-only and builds example data for pushes and pull requests. GitHub Pages is no longer part of deployment. After the Cloudflare cutover, disable Pages unless an older printed card still depends on its URL.

For a local Cloudflare-style preview, run:

```sh
npm run preview:cloudflare
```

Do not run the production deploy command until a successful production build has populated `dist/`.

## Privacy and hardening

The card is public. These controls reduce incidental discovery and data leakage; they are not authentication:

- origin-root `robots.txt` discourages crawling only under `/me/`;
- card HTML and response headers apply `noindex,nofollow,noarchive,nosnippet`;
- a restrictive early meta CSP is backed by a Cloudflare response-header CSP;
- response headers deny framing, MIME sniffing, referrers, and unnecessary browser capabilities;
- external links use `noreferrer noopener`;
- preview URLs receive a no-index response header;
- no sitemap, canonical metadata, contact-bearing social metadata, tracking, or third-party resources are shipped.

The future homepage is intentionally not blocked from indexing. Security headers apply to the whole static site, while crawler-blocking rules are scoped to the card.

## vCard

The contact file is generated from the same validated profile as the page. It uses vCard 3.0, UTF-8, CRLF line endings, byte-aware 75-octet folding, a structured name, a work email, both URLs, and a role-neutral note containing both roles plus the Discord username. It omits `ORG`, `TITLE`, `ROLE`, photos, logos, and platform-specific extensions.

Before release, import the deployed file into both Apple Contacts and Google Contacts. Confirm the name, work email, two URLs, Discord note, and both equally prominent roles, then remove the test contact.

## On-screen and printed QR

**Show QR** opens a native dialog with a large black-on-white code for in-person scanning. With JavaScript disabled or without dialog support, the link opens the raw same-origin SVG.

The permanent custom-domain path fits a Version 3-H QR:

- 29 × 29 symbol modules;
- a four-module quiet zone on every side;
- 37 × 37 modules overall;
- 30 mm physical size, approximately 0.811 mm per module.

A local or production-profile generation writes the canonical SVG and print manifest to `output/qr/`. Create the trim-size PDF proof with:

```sh
python -m pip install -r requirements-print.txt
python scripts/create-print-proof.py
```

The PDF is written to `output/pdf/`. Its page is 88.9 × 50.8 mm, and its 30 mm QR is drawn from the exact generated matrix. Ask the printer about bleed and safe areas; this is a proof, not a universal press template.

Test the final printed proof on current iPhone and Android devices under glare, low light, rotation, distance, and partial obstruction. Verify the printed URL and email as manual fallbacks. Do not add a logo, gradient, transparency, or decorative QR modules.

## Long-term URL lifecycle

The custom domain and `/me/` path are the permanent identity printed into new cards. This decouples the cards from GitHub and Cloudflare: hosting can move later without reprinting as long as the same HTTPS hostname and path continue to resolve.

- Enable registrar MFA, auto-renew, registrar lock, expiry alerts, and DNSSEC.
- Keep the `/me/` route working indefinitely while physical cards exist.
- Re-test printed cards after DNS, certificate, hosting, or routing changes.
- Archive the exact SVG, PDF, profile revision, and device-test record for each print run.
- Preserve redirects for any previously printed GitHub-hosted URL until those cards are retired.

NFC, wallet passes, analytics, lead capture, authentication, and approved organization logos remain deferred.
