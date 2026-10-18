# One-Trillion Persona

**Every seed is someone.** Roll a stranger nobody has met. Shape them in a few lines of chat with Elise, our character designer. Keep them as a file you own, take them into SillyTavern, or give them a face and a voice.

<p align="center"><b><a href="https://www.anone.life/1t/">Try it in your browser →</a></b><br><sub>Nothing to install. Bring your own model key.</sub></p>

<p align="center"><img src="docs/assets/demo.gif" width="400" alt="Pick what to decide, talk to Elise, get a persona, then chat with it"></p>

- **Characters that don't melt into the model.** Each one wants something, pays for it, and can say no, in rules the model can follow.
- **Type a few lines, get a whole person.** No blank page, no JSON. In one test, about 90 words of chat became a 13,000-character persona.

> あのね open source 01. Made by the team behind [anone.life](https://www.anone.life).

## The problem

We went through a full year of r/SillyTavernAI (2025-10-17 to 2026-10-16, 13,054 posts) and pulled out the 2,690 that complain about how chats with characters turn out. A model sorted each post; a person spot-checked the sorting (83% correct). Here is who fixes what:

| Who fixes it | Share of complaints |
|---|---|
| 1T Persona | 11% |
| 1T Persona, in part | 21% |
| 1T Persona + anone.life | 11% |
| anone.life | 10% |
| anone.life, in part | 11% |
| Not ours to fix (the model got worse, prices) | 18% |
| None of the above | 18% |

Three things stand out:

- **64%** of the complaints are things 1T Persona and anone.life fix, fully or in part. Only 18% is truly out of our hands.
- **32% of the people who blame the model** (291 of 921 posts) are really describing a prompt problem: breaking character, speaking for them, being too nice. That's the part 1T Persona writes.
- **Refusals and censorship nearly doubled**, from 6.7% to 12.5% of complaints in the last nine months. That's why anone.life runs on open models, for adults only.

This counts people who post, not every player. The full table, row by row, is in [docs/DESIGN.md §0](docs/DESIGN.md); rerun it with `tools/st_pain_survey.ts`.

## The 1T Persona method

**Not a better prompt template. A method for building a person.** Most tools describe a character with adjectives, and adjectives melt into the model. 1T Persona builds a person the way personality psychology describes one: motives, what they cost, and what the person does in each situation. Bazi gives the motives a grammar; seven outer layers give the person a world.

| The complaint | What 1T Persona does instead |
|---|---|
| Every character sounds the same, and agrees too easily | One motive with two sides: what they want, what it costs them, and what would break them |
| They stop being themselves: after a while, they break character | "She's stubborn" is an adjective, and a model forgets it in a few turns. "Push her, and she walks out" is a rule, and a model can play it |
| Good characters are hard to find, or to write | One seed, eight layers, about 2 × 10²⁴ different people |
| Stock phrases and repetition | Each person's own rules of speech and tone, instead of the model's stock voice |

And around it:

- **Shape a character by talking.** You don't fill in a form. Elise asks what she needs, pushes back when two things don't fit, and wraps up when she has enough.
- **Same birthday and seed, same person.** Seeds look like `1T-4T2Q-P57W-JBPQ`. Share the seed and the birthday, and anyone gets the same skeleton. Pin one field and nothing else moves.
- **Your files, your model.** Bring any OpenAI-compatible API, including a local one. Characters stay in your browser and export as plain files.

## Why "one trillion"?

The three core layers of a person, multiplied together:

| Layer | What it decides | Combinations |
|---|---|---|
| Inner life | drives, temperament, how they love and fight | 518,400 |
| World | era, city, social rules, economy | 3,072 |
| Body | form, apparent age, how they present, voice | 768 |

518,400 × 3,072 × 768 ≈ **1.22 trillion**, about 1.07 trillion after removing combinations that don't make sense. That's where the name comes from — but "one trillion" is just our name for *very big*. The real scale:

- **The seven outer layers alone** (world, body, skills, standing, signs, drama, one small quirk): about **4 × 10¹⁸** valid combinations, roughly the number of grains of sand on Earth.
- **Add the inner life** (× 518,400 charts): about **2 × 10²⁴**, roughly the number of stars in the observable universe.

These count combinations, not proven-different people. On the first screen you choose which layers you want to decide yourself, and the count updates live.

The inner-life layer uses the **Four Pillars (Bazi)** calendar as a *character grammar*: a compact, centuries-old vocabulary for how drives combine and conflict. **It is not fortune-telling.** It never decides city, job, looks, race or orientation, and it predicts nothing about real people. In the web app you give each character a birthday (date, time and birthplace). The birthplace sets the time zone, and the birthday also sets their age.

### The theory behind the layers

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/layers-dark.svg">
  <img alt="One inner life (Bazi) surrounded by seven outer layers" src="docs/assets/layers-light.svg">
</picture>

One inner life, seven outer layers. The split follows McAdams and Pals' integrative model of personality: motives, culture, body, social roles, self-presentation and life story are different levels, and none can be read off another. The four faces come from Mischel and Shoda's if–then signatures. A person stays consistent in *what they do in which situation*, not in one label. Want, price and breaking point come from the same motive, so the tension is built in. **[Read the full design, with references and what we don't claim →](docs/DESIGN.md)**

## Play it

The web app speaks **English, 中文 and 日本語** (switch at the top right). Elise talks to you in that language, and the persona is written in it.

**Online:** open **[www.anone.life/1t](https://www.anone.life/1t/)**. It's this repository, built as a static page and hosted by anone.life. Your model key and your characters stay in your browser (in that site's local storage); nothing is uploaded. The hosted copy counts page opens anonymously. If you'd rather not go through anone.life at all, run it yourself:

```bash
git clone <this repo> && cd one-trillion-persona
npm install          # Node 23.6+
npm run web          # open http://localhost:5190
```

Go to **Model**, enter an OpenAI-compatible base URL, a key, and a model name. (Local servers that need no key work too.) Then:

1. **New**: say whether they're a man or a woman, fill in their birthday, birthplace and where they live now (all required), choose which layers to decide yourself, then roll.
2. **Meet the stranger.** Change anything you don't like; options that wouldn't fit (an era the birthday rules out, say) are greyed out. Don't want a layer at all? Remove skills, standing, signs, drama or the quirk, and bring it back any time.
3. **Talk to Elise.** Press *I'm done* whenever you like.
4. **Read the persona**, then talk to them, download the `.anone` file, or export a SillyTavern card. If a reply feels off, press **Tell Elise** under it: she changes one or two sections of the persona, and you can retry from that line or undo.

Everything is stored in your browser. Clearing site data deletes it, so keep the `.anone` file as your backup. You can import it again later.

## Use it in SillyTavern

Click **SillyTavern card (.json)** on the result page and import it in SillyTavern.

- When SillyTavern asks, **import the embedded lorebook**. The four faces live there and trigger on keywords.
- The card is about 4K tokens. With a reasoning model, raise **Response length** so the reply isn't cut off after the thinking.

## Optional: give them a face and a voice

You don't need this. Everything above works without it.

With a free [anone.life](https://www.anone.life) API key, your character can borrow one of anone.life's animated faces. Add your own TTS key (xAI or OpenAI) and each reply is spoken aloud, lip-synced, with an expression that matches the line. Get the anone.life key at anone.life → `/console`, then paste both keys under **Model**. Your persona and your character's lines never reach anone.life: your browser voices each line with your TTS provider, and anone.life only gets the emotion, the face id, and when the voice starts and stops. Details: [docs/ANONE_API.md](docs/ANONE_API.md).

## On your desktop

The desktop app puts your character on your desktop: a see-through window on the left of the screen, always on top, with them standing in it. Move the mouse to the bottom to type; replies appear just below them and fade a few seconds after they finish. Clicks on the empty space go through to whatever is behind. Drag with ✥ in the corner; ⋯ (or right-click them) switches characters, opens settings, or hides the window.

It's the same web app, packed in Electron and running from your computer (nothing loads from our servers). Your browser and the app keep separate storage, so bring your characters over: **Library → Export all** in the web app, then drop the file on the desktop app (no keys go in that file; enter them again in the app). Build it yourself with `cd apps/desktop && npm install && npm run pack`, or see [apps/desktop/README.md](apps/desktop/README.md).

The app isn't signed yet. On macOS, right-click → **Open** the first time; on Windows, **More info → Run anyway**.

## Command line

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

Code: [Apache-2.0](LICENSE). The names あのね / Anone / anone.life, the あのね marks, Elise, and the faces and voices served by the anone.life API are **not** covered by that license. See [TRADEMARKS.md](TRADEMARKS.md).
