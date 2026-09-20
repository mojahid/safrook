# Safrook automated QA — isolated starter kit

This package is based on the user-uploaded `safrook-registration-engine(1).zip` and includes its six original application files **unchanged**. The additional files implement repeatable registration-rule tests and real-browser smoke tests with **mocked APIs**. It does NOT run destructive tests on production or claim to verify real Netlify Database persistence.

## Run locally

```bash
npm install
npx playwright install chromium
npm test
```

`npm run test:rules` needs Node 22 but no browser. `npm run test:e2e` uses Playwright Chromium and a local Python HTTP server (Python 3 required). A browser HTML report is written to `playwright-report/`.

## GitHub Actions

Commit the added `package.json`, `playwright.config.js`, `tests/`, `.github/workflows/safrook-qa.yml` along with the existing Safrook app. GitHub Actions runs on pull requests and pushes to `main`. It tests an isolated local copy and intercepts `/api/*` browser calls, so it cannot modify real registrations. To make passing tests mandatory, configure a branch protection rule requiring the `qa` job before merging to `main`; do not assume the included workflow alone blocks production deployments.

## What is covered

- Backend pure rule tests: deadline, guest displacement, protected guest, paid flag, waiting promotion, capacity increase, post-deadline behavior, kickoff.
- Browser smoke tests: initial state rendering, guest registration UI, refresh persistence against a mock state API, mobile layout.

## NOT yet covered (requires separate test Netlify site and test database)

- Actual Netlify Functions, Admin auth, real database writes, simultaneous registrations, and automatic game rollover against a running backend.
- iOS Safari / real-device behavior. Mobile browser test uses Chromium device emulation.

## Issues discovered while inspecting uploaded code

1. `public-state.js` performs read-then-write of the full JSON state without an atomic transaction/version check. Two simultaneous public requests can overwrite one another. **Concurrency is not verified or solved by this QA package.**
2. Automatic rollover is invoked when an authenticated Admin opens the game settings or loads the site, not by a scheduled server-side job. If no Admin opens the site after a match, rollover is not guaranteed to run automatically.
3. `reconcile()` does not itself check kickoff before promoting waiting players; its callers need to enforce closure.
4. The ZIP contains only six files, and does not include `netlify.toml`, the admin-auth function, database migration or assets. Merge these QA additions into your complete existing GitHub repository; do not replace the entire repo with this ZIP.

The rule tests exercise current code behavior; a green test result is not a guarantee of production readiness.
