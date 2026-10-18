# anone.life API (optional, free)

You don't need this. One-Trillion Persona makes characters and chats with them using your own model. The anone.life API adds one thing: **your character borrows an anone.life face that moves while they speak.**

- **Get a key**: sign in at anone.life → [`/console`](https://www.anone.life/console) → *Create a key*. The key is shown once. You can have up to 3.
- **Price**: free. Each key has a 50-lines-per-day limit, to stop abuse.
- **The voice is yours**: lines are voiced with **your own** TTS key (xAI or OpenAI), called straight from your browser (`apps/web/src/voice.ts`). The xAI voices are the same ones the faces use on anone.life.
- **Privacy**: anone.life never sees your character's persona or what they say. Each request carries only the emotion, the face id, when the voice starts (`onsetMs`) and how long it lasts (`durationMs`). Your browser measures those from the audio (`apps/web/src/audio.ts`). The API refuses a request that includes the text.

## Endpoints

Every request needs `Authorization: Bearer ak_…`. Cross-origin requests are allowed.

### `GET /v1/1t/faces`

```json
{ "faces": [{ "id": "24_yui", "label": "Face 02", "gender": "female", "voice": "ara",
              "base": "https://…/avatar/24_yui", "poster": "…/poster.jpg",
              "formats": ["webm", "hevc.mp4", "mp4"],
              "clips": { "idle": ["idle_1"], "thinking": ["thinking_1"], "speaking": ["speaking_1"], "faces": ["face_hesitant"] } }],
  "emotions": ["neutral", "happy", "shy", "surprised", "sad", "thoughtful"] }
```

### `POST /v1/1t/animate`

Request: `{ "emotion": "happy", "faceId": "24_yui", "onsetMs": 30, "durationMs": 3120 }`. `durationMs` is 1–90000 and `onsetMs` must be smaller. An emotion outside the list is treated as `neutral`. **A request with a `text` field is refused (400).**

Response:

```json
{ "timeline": [ { "atMs": 0, "clip": "thinking_1", "loop": true },
                { "atMs": 30, "clip": "face_hesitant", "startFrame": 4, "loop": true, "fallback": "speaking_1" },
                { "atMs": 3120, "clip": "idle_1", "loop": true } ],
  "emotion": "happy", "face": "24_yui", "usage": { "linesToday": 12, "linesLimit": 50, "pointsCharged": 0 } }
```

To play it, start your audio, then switch to each `clip` at `atMs` (minus however long your player takes to switch). Start each clip at `startFrame / 24` seconds. Expression faces (`face_*`) exist only as transparent `webm` / `hevc.mp4`. If you can only play `mp4`, use `fallback`. `apps/web/src/player.ts` does all of this.

For the mouth to open when the voice does, measure `onsetMs` the same way anone.life does: trim leading silence to 30 ms, then take the first 5 ms window whose mean absolute level is at least 0.01 (24 kHz, 16-bit mono PCM). `apps/web/src/audio.ts` does this.

Without a TTS key, the app sends an estimated duration with `onsetMs: 0` and the face moves silently.

### `POST /v1/1t/speak` (old)

Older versions of this app sent the text and got anone.life's voice back. It still works for now, but it is going away: use `/animate`.

### `GET /v1/1t/usage`

`{ "linesToday": 12, "linesLimit": 50, "day": "2026-10-17" }`

### Errors

| Status | Meaning |
|---|---|
| `401` | Missing, wrong, or revoked key |
| `400` | Bad face or timing, or the request included `text` |
| `429` | This key hit today's 50-line limit |

The faces, clips and voices are anone.life's. Use them through the API, but don't download or re-host them (see [TRADEMARKS.md](../TRADEMARKS.md)).
