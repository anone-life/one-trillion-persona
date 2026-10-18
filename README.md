<p align="center"><b>English</b> · <a href="README.zh-CN.md">中文</a></p>

<h1 align="center">One-Trillion Persona</h1>

<p align="center"><b>Every seed is someone.</b> Meet 100 strangers you'll meet only once, or roll one of a trillion more.<br>Talk to them in your browser, on your phone, or on your desktop.</p>

<p align="center">
  <a href="https://www.anone.life/1t/"><img alt="Try it in your browser" src="https://img.shields.io/badge/%E2%96%B6%20Try%20it-in%20your%20browser-b8442f?style=for-the-badge"></a>
  <a href="https://github.com/anone-life/one-trillion-persona/releases/latest"><img alt="Desktop app for Windows and macOS" src="https://img.shields.io/badge/Desktop%20app-Windows%20%C2%B7%20macOS-1b1a17?style=for-the-badge"></a>
  <a href="#use-it-in-sillytavern"><img alt="Exports SillyTavern cards" src="https://img.shields.io/badge/Exports-SillyTavern%20cards-9c8449?style=for-the-badge"></a>
</p>

<p align="center"><img src="docs/assets/demo.gif" width="800" alt="Pick one of the hundred, they speak first, you answer, and they show up on your desktop"></p>

<p align="center"><sub>Nothing to install. Bring your own model key. あのね open source 01, from the team behind <a href="https://www.anone.life/?f=1t">anone.life</a>.</sub></p>

## Once in a Lifetime: 100 strangers you'll meet only once

Every layer of them is an ordinary choice. What makes them rare is how the layers rub against each other: an elevator girl who trades stocks at lunch, a warehouse worker whose physics papers three universities have read, a cartoon raccoon who teaches lock-picking to four thousand viewers.

<p align="center"><img src="docs/assets/rare-grid.jpg" alt="Twelve of the hundred strangers"></p>

Each one starts at a first meeting, in their own era and city, and speaks first:

> "You said you think you saw him. In English I can make that 'I saw him' or 'I'm not sure.' Pick the one you can sleep with."
> — **Fung Suk-ying**, court interpreter, Hong Kong, 1898

> "Bike's eighty dollars. Don't read the board, it isn't finished. Or read it, if you like. Three universities have, and none of them knows it was me."
> — **Gurdeep Sandhu**, warehouse worker, Fremont, 2026

Eight eras, sixteen cities. Eleven are cartoons, eight are virtual idols, and fourteen are only a voice. **[Meet all 100 →](https://www.anone.life/1t/#/rare)** Or read three of them right here, no key needed: [`examples/`](examples/).

## Three places to meet them

<p align="center"><img src="docs/assets/surfaces.jpg" alt="The same character in a browser, on a phone, and standing on a desktop"></p>

- **In your browser.** Open [www.anone.life/1t](https://www.anone.life/1t/). Nothing to install. Your model key and your characters stay in your browser.
- **On your phone.** The same address. The chat goes full-screen over their picture.
- **On your desktop.** A small always-on-top window for Windows and macOS: they stand at the edge of your screen and answer under their feet. [Download the app](https://github.com/anone-life/one-trillion-persona/releases/latest).

Each place keeps its own characters. To bring them along, use **Mine → Export all** and open the file in the other place.

## Or make your own

**Not a better prompt template. A method for building a person.** Roll a stranger nobody has met, then shape them in a few lines of chat with Elise, our character designer. She asks what she needs, pushes back when two things don't fit, and wraps up when she has enough. In one test, about 90 words of chat became a 13,000-character persona.

1. **New**: say whether they're a man or a woman, fill in their birthday, birthplace and where they live now, choose which layers to decide yourself, then roll.
2. **Meet the stranger.** Change anything you don't like; options that wouldn't fit (an era the birthday rules out, say) are greyed out. Remove skills, standing, signs, drama or the quirk if you don't want them.
3. **Talk to Elise.** Press *I'm done* whenever you like.
4. **Read the persona**, then talk to them, download the `.anone` file, or export a SillyTavern card. If a reply feels off, press **Not like them? Adjust the persona** under it: she changes one or two sections of the persona, and you can retry from that line or undo.

Everything is stored in your browser. Clearing site data deletes it, so keep the `.anone` file as your backup.

## Why they don't melt into the model

Most tools describe a character with adjectives, and adjectives melt into the model. 1T Persona builds a person the way personality psychology describes one: motives, what they cost, and what the person does in each situation.

| The complaint | What 1T Persona does instead |
|---|---|
| Every character sounds the same, and agrees too easily | One motive with two sides: what they want, what it costs them, and what would break them |
| They stop being themselves: after a while, they break character | "She's stubborn" is an adjective, and a model forgets it in a few turns. "Push her, and she walks out" is a rule, and a model can play it |
| Good characters are hard to find, or to write | One seed, eight layers, about 2 × 10²⁴ different people |
| Stock phrases and repetition | Each person's own rules of speech and tone, instead of the model's stock voice |

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/layers-dark.svg">
  <img alt="One inner life (Bazi) surrounded by seven outer layers" src="docs/assets/layers-light.svg">
</picture>

One inner life, seven outer layers. The split follows McAdams and Pals' integrative model of personality; the four faces come from Mischel and Shoda's if–then signatures. A person stays consistent in *what they do in which situation*, not in one label. **[Read the full design, with references and what we don't claim →](docs/DESIGN.md)**

- **Same birthday and seed, same person.** Seeds look like `1T-4T2Q-P57W-JBPQ`. Share the seed and the birthday, and anyone gets the same skeleton.
- **Your files, your model.** Bring any OpenAI-compatible API, including a local one.

### Why "one trillion"?

Inner life (518,400) × world (3,072) × body (768) ≈ **1.07 trillion** valid combinations, which gave the project its name. Add the other outer layers and it's about **2 × 10²⁴**, roughly the number of stars in the observable universe. These count combinations, not proven-different people.

The inner-life layer uses the **Four Pillars (Bazi)** calendar as a *character grammar*: a compact, centuries-old vocabulary for how drives combine and conflict. **It is not fortune-telling.** It never decides city, job, looks, race or orientation, and it predicts nothing about real people.

### What role-players say goes wrong

We read a year of r/SillyTavernAI (13,054 posts) and sorted the 2,690 that complain about how character chats turn out. **64%** are things 1T Persona and anone.life fix, fully or in part; **32%** of the posts that blame the model are really describing a prompt problem (breaking character, speaking for the user, being too nice). Full table: [docs/DESIGN.md §0](docs/DESIGN.md); rerun it with `tools/st_pain_survey.ts`.

## Use it in SillyTavern

Click **SillyTavern card (.json)** on the result page, or take one from [`examples/`](examples/), and import it in SillyTavern.

- When SillyTavern asks, **import the embedded lorebook**. The four faces live there and trigger on keywords.
- The card is about 4K tokens. With a reasoning model, raise **Response length** so the reply isn't cut off after the thinking.

<details>
<summary><b>Optional: give them a face and a voice</b></summary>

You don't need this. Everything above works without it.

With a free [anone.life](https://www.anone.life/?f=1t) API key, your character can borrow one of anone.life's animated faces. Add your own TTS key (xAI or OpenAI) and each reply is spoken aloud, lip-synced, with an expression that matches the line. Get the anone.life key at anone.life → `/console`, then paste both keys under **Model**. Your persona and your character's lines never reach anone.life: your browser voices each line with your TTS provider, and anone.life only gets the emotion, the face id, and when the voice starts and stops. Details: [docs/ANONE_API.md](docs/ANONE_API.md).
</details>

<details>
<summary><b>Run it yourself</b></summary>

The hosted copy at anone.life/1t is this repository built as a static page. It counts page opens anonymously; nothing else is uploaded. If you'd rather not go through anone.life at all:

```bash
git clone https://github.com/anone-life/one-trillion-persona.git && cd one-trillion-persona
npm install          # Node 23.6+
npm run web          # open http://localhost:5190
```

Go to **Model** and enter an OpenAI-compatible base URL, a key and a model name (local servers that need no key work too).

The hundred strangers' cards are in this repository; their pictures and pre-written personas are not. `npm run web` shows the cards without them. A build (`npm run web:build`, and the desktop app) fetches them from anone.life's CDN; set `ONE_T_RARE_BASE` to point somewhere else, or leave it empty to fetch nothing.

The desktop app is the same web app packed in Electron, running from your computer. Build it with `cd apps/desktop && npm install && npm run pack`, or see [apps/desktop/README.md](apps/desktop/README.md). It isn't signed yet: on macOS, right-click → **Open** the first time; on Windows, **More info → Run anyway**.
</details>

<details>
<summary><b>Command line</b></summary>

```bash
npm run 1t -- roll                                    # a random person
npm run 1t -- roll --seed 1T-4T2Q-P57W-JBPQ           # the same person, every time
npm run 1t -- roll --birth "1998-04-12 07:30" --tz Asia/Tokyo
npm run 1t -- roll --ask bazi,world --set world.city=tokyo
npm run 1t -- layers                                  # every layer and value
npm run 1t -- design                                  # talk to Elise in the terminal
npm run 1t -- export <character folder>               # .anone + SillyTavern card
npm run 1t -- inspect <file.anone>
```

The CLI reads `OPENAI_BASE_URL`, `OPENAI_API_KEY` and `ONE_T_MODEL`.
</details>

## Rules

- **Adults only.** Every character is 18 or over. This is checked in code, not just asked for in a prompt, and imported files are checked too.
- **You're talking to an AI.** Characters are fiction made by a model.

## For developers

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md). The rules that turn a seed into a person are written down and versioned in [`spec/`](spec/).

```bash
npm test
npm run typecheck
npm run web:build
```

## License

Code: [Apache-2.0](LICENSE). The characters in [`examples/`](examples/) and the pictures in `docs/assets/` are [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (see [NOTICE](NOTICE)). The names あのね / Anone / anone.life, the あのね marks, Elise, and the faces and voices served by the anone.life API are **not** covered by either license. See [TRADEMARKS.md](TRADEMARKS.md).
