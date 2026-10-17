# Contributing

Thanks for wanting to help. A few things to know first.

## Setup

```bash
npm install          # Node 23.6+ (runs TypeScript directly, no build step for packages)
npm test             # all packages
npm run typecheck
npm run web          # the web app on :5190
```

Set your model under **Model** in the web app. The CLI reads `OPENAI_BASE_URL`, `OPENAI_API_KEY` and `ONE_T_MODEL`.

## Ground rules

- **Same seed, same person.** Anything that changes what a seed produces (enums, constraints, weights, the translation table, solar-term data) is a new `rulesVersion`. Write it down in `spec/`.
- **Adults only.** The adult gate (`packages/core/src/check.ts`) is code, on purpose. Don't weaken it.
- **Bazi is a grammar, not fortune-telling.** Don't add claims that it predicts real people.
- **Keep layers independent.** The chart decides inner drives. It must never decide city, job, looks, race or orientation.
- **Emotions that drive animation go through the whitelist** (`apps/web/src/anone.ts`). Never infer animation from free text.
- Lip-sync and animation timing live on the anone.life side. This repo only plays timelines. Please don't send PRs that rebuild that part from anone.life's assets.

## Comments are partly in Chinese

The project started inside a Chinese-speaking team, and many code comments are still in Chinese. English PRs that translate comments are very welcome. Please keep the meaning, since many of those comments explain *why* something is the way it is.

## Licensing

By contributing, you agree that your contributions are licensed under Apache-2.0 (see [LICENSE](LICENSE)). The names and marks in [TRADEMARKS.md](TRADEMARKS.md) are not part of that license.
