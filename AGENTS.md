# Notes for coding agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first.

- Don't change what a seed produces without bumping `rulesVersion` and updating `spec/`.
- Don't weaken the adult gate (`packages/core/src/check.ts`) or remove the "Bazi is not fortune-telling" disclaimers.
- Animation and lip-sync timing come from the anone.life API (`/v1/1t/speak`). This repo only plays timelines. Don't reimplement that logic here.
- Never commit API keys. `.env.local` is git-ignored. In the web app, keys live only in the user's browser.
- Run `npm test` and `npm run typecheck` before you finish. For UI changes, also run the web app and check it in a browser.
