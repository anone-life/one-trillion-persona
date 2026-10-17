# anone.life API (optional, paid)

You don't need this. One-Trillion Persona makes characters and chats with them using your own model. The anone.life API adds one thing: **your character borrows an anone.life face and voice, and every line moves and speaks.**

- **Get a key**: sign in at anone.life → [`/console`](https://www.anone.life/console) → *Create a key*. The key is shown once. You can have up to 3.
- **Price**: each line spoken costs **1 point (5 stamps)** from your anone.life account. If speech fails, the stamps are refunded. Each key also has a 50-lines-per-day limit, to stop abuse.
- **Privacy**: your character's persona never leaves your browser. Each request carries one line of dialogue, its emotion, and the face id. anone.life doesn't store the text.

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

### `POST /v1/1t/speak`

Request: `{ "text": "You came back.", "emotion": "happy", "faceId": "24_yui", "voice"?: "ara", "lang"?: "en" }`. The text can be at most 300 characters. An emotion outside the list is treated as `neutral`.

Response:

```json
{ "audio": { "format": "wav", "sampleRate": 24000, "durationMs": 3120, "onsetMs": 30, "base64": "…" },
  "timeline": [ { "atMs": 0, "clip": "thinking_1", "loop": true },
                { "atMs": 30, "clip": "face_hesitant", "startFrame": 4, "loop": true, "fallback": "speaking_1" },
                { "atMs": 3120, "clip": "idle_1", "loop": true } ],
  "emotion": "happy", "usage": { "linesToday": 12, "linesLimit": 50, "pointsCharged": 1 } }
```

To play it, start the audio, then switch to each `clip` at `atMs` (minus however long your player takes to switch). Start each clip at `startFrame / 24` seconds. Expression faces (`face_*`) exist only as transparent `webm` / `hevc.mp4`. If you can only play `mp4`, use `fallback`. `apps/web/src/player.ts` does all of this.

### `GET /v1/1t/usage`

`{ "linesToday": 12, "linesLimit": 50, "day": "2026-10-17" }`

### Errors

| Status | Meaning |
|---|---|
| `401` | Missing, wrong, or revoked key |
| `400` | Bad text, face, or voice |
| `402` | Not enough stamps on the account |
| `429` | This key hit today's 50-line limit |
| `5xx` | Speech synthesis failed. Not charged, not counted |

The faces, clips and voices are anone.life's. Use them through the API, but don't download or re-host them (see [TRADEMARKS.md](../TRADEMARKS.md)).
