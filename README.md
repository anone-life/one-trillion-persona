# One-Trillion Persona

**One seed, one person.** Talk for a few minutes, get a character who acts like *somebody*: consistent, reproducible, and yours.

<p align="center"><img src="docs/assets/demo.gif" width="400" alt="Pick what to decide, talk to Elise, get a persona, then chat with it"></p>

Most character cards are a vibe and a list of adjectives. They fall flat after twenty messages. One-Trillion Persona starts from a **birthday and a seed**. The birthday fixes who someone is underneath (what drives them, what they'll pay for it, what breaks them); the seed fills in their world and body, then lets you shape the rest by **chatting with Elise, the designer**. You come out with a long, structured `persona.txt` that works in any front-end, including SillyTavern.

> あのね open source 01. Made by the team behind [anone.life](https://www.anone.life).

## Why it's different

- **Shape a character by talking.** You don't fill in a form. Elise asks what she needs, pushes back when two things don't fit, and wraps up when she has enough. A few dozen words from you can become a 10K+ character persona.
- **Behaviour, not adjectives.** Every persona has *What drives them*, *Four faces* (how they act when happy, cornered, hurt, close) and *If… then…* rules. Those are what keep a character in character on message 200.
- **Same birthday and seed, same person.** Seeds look like `1T-4T2Q-P57W-JBPQ`. Share the seed and the birthday, and anyone gets the same skeleton. Pin one layer (the city, the job, the body) and nothing else moves.
- **Your files, your model.** Bring any OpenAI-compatible API, including a local one. Characters stay in your browser and export as plain files.

## Why "one trillion"?

The three core layers of a person, multiplied together:

| Layer | What it decides | Combinations |
|---|---|---|
| Inner life | drives, temperament, how they love and fight | 518,400 |
| World | era, city, social rules, economy | 3,072 |
| Body | form, apparent age, how they present, voice | 768 |

518,400 × 3,072 × 768 ≈ **1.22 trillion**, about 1.07 trillion after removing combinations that don't make sense. Five optional layers (skills, status, signs, drama, and one small quirk) push the total far past that. On the first screen you choose which layers you want to decide yourself, and the count updates live.

The inner-life layer uses the **Four Pillars (Bazi)** calendar as a *character grammar*: a compact, well-studied system for describing how drives combine and conflict. **It is not fortune-telling.** It never decides city, job, looks, race or orientation, and it predicts nothing about real people. In the web app you give each character a birthday (date, time and birthplace). The birthplace sets the time zone, and the birthday also sets their age.

## Play it

```bash
git clone <this repo> && cd one-trillion-persona
npm install          # Node 23.6+
npm run web          # open http://localhost:5190
```

Go to **Model**, enter an OpenAI-compatible base URL, a key, and a model name. (Local servers that need no key work too.) Then:

1. **New**: fill in their birthday, birthplace and where they live now (all required), choose which layers to decide yourself, then roll.
2. **Talk to Elise.** Press *I'm done* whenever you like.
3. **Read the persona**, then talk to them, download the `.anone` file, or export a SillyTavern card.

Everything is stored in your browser. Clearing site data deletes it, so keep the `.anone` file as your backup. You can import it again later.

## Use it in SillyTavern

Click **SillyTavern card (.json)** on the result page and import it in SillyTavern.

- When SillyTavern asks, **import the embedded lorebook**. The four faces live there and trigger on keywords.
- The card is about 4K tokens. With a reasoning model, raise **Response length** so the reply isn't cut off after the thinking.

## Optional: give them a face and a voice (anone.life, paid)

You don't need this. Everything above works without it.

With an [anone.life](https://www.anone.life) API key, your character can borrow one of anone.life's animated faces and a voice. Each reply is spoken aloud, lip-synced, with an expression that matches the line. Get a key at anone.life → `/console`, then paste it under **Model**. Each spoken line costs 1 point (5 stamps) from your anone.life account. Your persona never leaves your browser: each request sends only one line, its emotion, and the face id. Details: [docs/ANONE_API.md](docs/ANONE_API.md).

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
