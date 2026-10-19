# Architecture

One-Trillion Persona is a small npm workspace. The independent app runs on your machine or in your browser, with your chosen model or optional hosted rare-character chat. anone.life also provides animation APIs and an account-backed Encounters surface.

```
packages/core      seed → skeleton. Deterministic Four Pillars, 7 enumerated layers, constraints, seed codes, the adult gate.
packages/designer  Elise, the designer chat; persona.txt + schedule.json generation. Talks to any OpenAI-compatible API.
packages/files     .anone read/write (zip, browser-safe); SillyTavern Character Card V2 export.
packages/cli       `1t-persona roll | design | export | inspect | layers`
apps/web           the web app (Vite, no framework); #/pet is the desktop view
apps/desktop       the desktop app: an Electron shell around apps/web (not an npm workspace, so Electron isn't installed by default)
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

See [ANONE_API.md](ANONE_API.md). The web app voices each line with the user's own TTS key (`voice.ts`), trims the leading silence and measures when the voice starts (`audio.ts`), then sends only the emotion, face id, onset and duration to anone.life. It *plays* the timeline that comes back: which clip to show, when, and from which frame. Deciding that timeline (which expression face, which frame to cut in so the mouth opens on time) happens on anone.life's side and is not part of this repository. The line itself is not sent to the animation endpoint. Hosted chat and explicit transcript handoff are separate APIs that do receive conversation text.

## Desktop (`apps/desktop`, `apps/web/src/pet.ts`)

The shell is a transparent, frameless, always-on-top window that serves the built web app from `app://1t/` (inside the app, never from a server) and opens `#/pet`. The page does the work; the shell only exposes four things through `preload.js` as `window.onetPet`: turn click-through on or off, start and stop following the cursor (dragging with ✥), and window commands for the page's ⋯ menu (always on top, move back, hide, quit). The page reads the pixel under the mouse (images and anone.life's clips are loaded with CORS for this) and lets clicks through wherever the character is transparent. Replies go through `talk.ts`, the same code the chat page uses.


## Account history and handoff

`site-mode.ts` distinguishes the main site's `/encounters` path from the independent app. `store.ts` uses an in-memory account view there, loaded by `account-history.ts` from `/v1/1t/rare/history`; the independent app keeps its existing local library. Main-site language follows the explicit URL and then `companion.lang`; independent-app language remains `1t.lang` or the browser language.

An explicit transfer stages only rare-character transcripts and source identities, then claims a short-lived token after sign-in. Custom characters and model keys are excluded; local originals remain. The service stores account conversations by rare ID and original conversation language. Account chat requests carry the account ID, history version and retry ID; the server provides the authoritative context. UI language changes do not move a saved conversation to another language bucket.

The four anone.life characters use `/v1/1t/handoff` to append the full ten-turn original transcript to the corresponding main-site conversation. Repeated imports are deduplicated. Older summary-based handoffs can be upgraded without replacing existing main-site history. Server storage and animation implementation remain outside this public repository.
