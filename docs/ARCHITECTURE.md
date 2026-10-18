# Architecture

One-Trillion Persona is a small npm workspace. Everything here runs on your machine or in your browser, with the model you choose. The one optional exception is the anone.life API, which adds faces and voices.

```
packages/core      seed → skeleton. Deterministic Four Pillars, 7 enumerated layers, constraints, seed codes, the adult gate.
packages/designer  Elise, the designer chat; persona.txt + schedule.json generation. Talks to any OpenAI-compatible API.
packages/files     .anone read/write (zip, browser-safe); SillyTavern Character Card V2 export.
packages/cli       `1t-persona roll | design | export | inspect | layers`
apps/web           the web app (Vite, no framework)
spec/              the rules, versioned: bazi-rules, enums, constraints, translation table, solar-term data
tools/             dev-only scripts (data generation, acceptance runs)
```

## Seed → skeleton (`packages/core`)

- A seed is `1T-XXXX-XXXX-XXXX`: 12 Crockford base32 characters, 60 bits.
- Each layer draws from its own splitmix64 sub-stream. Changing or pinning one layer never moves another.
- The inner life (Bazi layer) comes either from a chart label drawn by the seed (518,400 labels) or from a birthday. A birthday is converted with exact solar-term boundaries, the 23:00 day boundary, no daylight saving time, and optional true solar time. A birthday also sets the era and the exact age ([`spec/bazi-rules.v1.md`](../spec/bazi-rules.v1.md) §7). The web app always asks for a birthday and a birthplace; the CLI's `--birth` is optional.
- Every rule is written down in [`spec/bazi-rules.v1.md`](../spec/bazi-rules.v1.md). The same seed always gives the same person under the same `rulesVersion`.
- Bazi × World × Body = 1.22 trillion nominal combinations. After constraints, 1.07 trillion are valid.

## Designer → persona (`packages/designer`)

- Elise only raises the layers you switched on. She is told which exchange she is on, so she asks for a name early and wraps up on time.
- After you finish, a small extraction step pulls out the name, the relationship, and any seed values you changed. Each value is checked against the enums and the constraints.
- The persona is written in four passes: who they are; what drives them (wants, the price, the breaking point, four faces, *If… then…* rules); how they talk; their past and right now.
- The adult gate is code, not just a prompt line. The age must fall inside the skeleton's adult age band, and the text is checked for minor or school-student wording.

## Files (`packages/files`)

- **`.anone`** is a zip with these entries: `mimetype` (stored, `application/x-anone`), `manifest.json` (sha256 of every file), and the `character/` files `info.json`, `persona.txt`, `schedule.json` and `seed.json`. It is the same format anone.life reads. On import the package is treated as untrusted input: hashes must match, only known paths are accepted, sizes are capped, the age must be 18 or over, and the persona text passes the adult gate.
- **SillyTavern card** (V2 JSON). The persona goes in `description`. The four faces become four keyword-triggered lorebook entries. `extensions.world` is pre-set so the lorebook is linked as soon as you import the card.

## Optional: faces and voices (`apps/web/src/anone.ts`, `player.ts`)

See [ANONE_API.md](ANONE_API.md). The web app voices each line with the user's own TTS key (`voice.ts`), trims the leading silence and measures when the voice starts (`audio.ts`), then sends only the emotion, face id, onset and duration to anone.life. It *plays* the timeline that comes back: which clip to show, when, and from which frame. Deciding that timeline (which expression face, which frame to cut in so the mouth opens on time) happens on anone.life's side and is not part of this repository. The line itself never goes to anone.life.
