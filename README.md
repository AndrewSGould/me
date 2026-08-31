# QR-first digital business card

A contact-first, framework-free business card built with Vite, TypeScript, and vanilla CSS. The production site is designed for GitHub Pages at the `/me/` project path. It makes no third-party runtime requests and keeps the production profile out of the public source tree.

## Local development

Requirements: Node.js 24 and npm.

1. Copy `profile.example.json` to `.profile.local.json`.
2. Replace the example fields locally. The local profile is ignored by Git.
3. Run `npm ci`, then `npm run dev`.

The generator validates the profile and creates ignored versions of `index.html`, `src/generated/profile.ts`, and the `.vcf` contact file. If `.profile.local.json` is absent, ordinary development and pull-request builds use the committed example profile.

Useful checks:

```sh
npm test
npm run typecheck
npm run build
```

The build fails if minified HTML reaches 10 KiB, CSS reaches 30 KiB, JavaScript reaches 20 KiB, a production source map is emitted, privacy/CSP metadata is absent, or a loadable/runtime network resource is not same-origin and static.

## Production profile and deployment

The production profile is a single JSON object matching `profile.example.json`. Store it as the `CARD_PROFILE_JSON` secret in a GitHub environment named `profile-production`; do not commit it or paste it into a workflow file.

Repository setup:

1. In **Settings > Pages**, select **GitHub Actions** as the source.
2. Create the `profile-production` environment, add `CARD_PROFILE_JSON`, and limit its deployment branch to `main`.
3. Keep the generated `github-pages` environment limited to `main`.
4. Protect `main` and require the CI workflow before merging.
5. Keep both environment secrets and Actions logs out of pull-request jobs.

The deployment workflow is fail-closed: `npm run build:production` accepts only `CARD_PROFILE_JSON`. It will not silently deploy the example or local profile. Before generation, it compares the production fields against Git-tracked and non-ignored source files and fails generically if a value leaked into source. It also verifies the configured permanent URL against a committed SHA-256 fingerprint, without storing the URL itself. The build job can read repository contents; only the separate deploy job can write Pages and request an identity token. All third-party Actions are pinned to full commit SHAs, and Dependabot tracks both Actions and npm updates.

To exercise the production path locally without printing the JSON, load the ignored file into the environment and run `npm run build:production`. The build output is `dist/`.

## Privacy model

The deployed card is public. Avoiding source-control exposure only removes the profile from code search and pull-request artifacts; anyone who loads the deployed page can read its HTML, JavaScript, contact file, and network responses.

The page adds `noindex,nofollow,noarchive,nosnippet`, a no-referrer policy, restrictive early meta CSP, and `noreferrer noopener` on external web links. It intentionally has no analytics, trackers, sitemap, canonical link, contact-bearing social metadata, service worker, external fonts, CDN assets, or project-level `robots.txt`. A `robots.txt` file under `/me/` would not control the origin because crawlers only recognize it at `/robots.txt`.

## vCard

The contact file is generated from the same validated profile as the page. It uses vCard 3.0, UTF-8, CRLF line endings, byte-aware 75-octet folding, a structured name, a work email, both URLs, and a role-neutral note containing both roles plus the Discord username. It omits `ORG`, `TITLE`, `ROLE`, photos, logos, and platform-specific extensions.

Before release, import the deployed file into both Apple Contacts and Google Contacts. Confirm the name, work email, two URLs, Discord note, and both equally prominent roles, then remove the test contact.

## QR and print proof

A production or local-profile generation creates ignored artifacts in `output/qr/`:

- a 30 mm black-on-white SVG;
- a JSON print manifest containing the same Version 4-H matrix and its SHA-256 digest.

The SVG includes the required four-module quiet zone. Do not add a logo, gradient, transparency, or decorative modules. The term QR Code is a registered trademark of DENSO WAVE INCORPORATED.

An optional trim-size PDF proof is generated from that exact matrix:

```sh
python -m pip install -r requirements-print.txt
python scripts/create-print-proof.py
```

The PDF is written to `output/pdf/`. Its page is 88.9 x 50.8 mm and the QR is 30 mm including its quiet zone. Ask the printer about bleed and safe-area requirements before production; this file is a proof, not a universal press template.

Test the final physical proof on current iPhone and Android devices under glare, low light, rotation, distance, and partial obstruction. Verify both the printed URL and email as manual fallbacks.

## Physical-card lifecycle

Treat the URL in `cardUrl` as permanent while printed cards exist. Update the content behind it, but do not rename the GitHub account or repository. If hosting moves, preserve `/me/` at the existing origin as a permanent redirect and re-test old cards. A later custom domain does not force a reprint only if the original printed URL continues serving or redirecting indefinitely; cards must be reprinted if that URL is retired.

Archive the exact production SVG, print PDF, profile revision, and a successful device-test record for every print run. NFC, wallet passes, analytics, lead capture, authentication, and a custom domain are outside v1.
