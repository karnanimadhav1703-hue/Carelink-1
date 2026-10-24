# CareLink

An adaptive health and accessibility app connecting patients and families.

Live app: https://care-link-f876a.web.app

## Features

- Patient and family accounts with Firebase Authentication.
- Standard, Elderly and Vision-assist modes; English and Hindi.
- Medicine schedules, foreground reminders, dose logging and missed-dose family alerts.
- Appointment reminders with editable visit dates and advance reminder options.
- SOS and simulated-fall countdowns, GPS location, nearby hospitals, maps and directions.
- Invite codes and a family dashboard updated through Firestore listeners.
- Installable PWA with a public offline fallback and heart app icon.

CareLink does not diagnose or provide medical advice. Call 112 for emergencies. Reminders require the app to remain open; installing it does not add background delivery. Public hospital lookup services may be unavailable.

## Run locally

Use Node.js 22.12 or later.

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill .env.local with your Firebase web app configuration.
npm run dev
```

In Firebase Console, enable Email/Password authentication and create a Firestore database. The configuration keys are documented in `.env.example`. Never commit `.env.local`, service-account credentials or demo passwords. Vite's `VITE_` values are visible in the browser bundle; database rules enforce access control.

## Checks and build

```powershell
npm test
npm run build
npm run preview
```

Live integration tests are opt-in; inspect the relevant `tests/live-*.test.js` file before running them against Firebase, because they create test records/accounts.

## Deploy

This repository is configured for the existing Firebase project/site `care-link-f876a`. To use your own Firebase project, update `.firebaserc`, `firebase.json` and your local environment configuration first.

```powershell
npx --yes firebase-tools login
npx --yes firebase-tools deploy --only hosting --project care-link-f876a
```

Hosting runs the build and uploads only `dist`. The deployment above does not publish Firestore rules.

## Database rules

`firestore.rules` contains the requested temporary hackathon test-mode rules, expiring November 21, 2026. They allow public reads/writes until that date: use fictional data. Before using real data, require authentication, enforce patient ownership, limit family reads to linked patients, validate fields and roles, and test rules with Firebase emulators. Do not simply extend the test-mode expiry for a production launch.

## Demo accounts

With Firebase configured, `npm run seed:demo` creates fictional Meena and Arjun accounts, medicines and a family link. Credentials are generated locally in the ignored `.demo-accounts.local.json`. The existing deployment's passwords are intentionally absent from this repository. Do not rerun seeding against existing demo accounts without their original local credential file.

## Structure

```text
src/       React screens, components, contexts and database helpers
public/    PWA manifest, notification worker, icons and offline fallback
assets/    Editable/source icon artwork
scripts/   Icon generation, demo seeding and diagnostic scripts
tests/     Tests and local preview fixtures
```

The theme uses burgundy and blush surfaces. Fonts are bundled through Fontsource: Inter for English and Noto Sans Devanagari for Hindi. Licenses are in `public/fonts/`. The supplied heart artwork is stored in `assets/carelink-heart-master.png`; regenerate icon sizes with `npm run icons`.

## Upload to GitHub

Upload the contents of this folder, preserving the directory structure, to the root of your repository. Include `.gitignore`, `.env.example` and `.firebaserc`. Upload the extracted files, not just the ZIP archive.

Alternatively, from this folder, use Git (replace the final URL with your repository URL):

```powershell
git init
git add .
git commit -m "Add CareLink app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

These commands assume an empty remote repository. If it already contains work, clone it first and copy these files into that checkout before committing. Do not force-push over existing work.

Excluded from this handoff: dependencies (`node_modules`), generated build (`dist`), Firebase local cache, local environment values, demo passwords, debug logs, and historical screenshots/source snapshots.
