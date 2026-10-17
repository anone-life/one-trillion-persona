# Rules v1

`rulesVersion: 1` · frozen 2026-10-17. Any change to the numbers or tables below is a new rules version; old seeds keep resolving under the version recorded in their skeleton.

Bazi here is a **generative grammar for fictional characters**, not fortune-telling and not a claim about real people.

## 1. Calendar

| Item | v1 rule |
|---|---|
| Supported range | 1900-01-01 – 2100-12-31 (local date) |
| Input | Local wall time + IANA time zone (`Asia/Tokyo`) or fixed offset (`+09:00`); optional birth longitude |
| Daylight saving | Always removed. Day and hour pillars use local **standard** time (the smaller of the zone's 1 Jan / 1 Jul offsets that year). |
| Year pillar | Changes at the exact moment of 立春 (Start of Spring), not on Lunar New Year. 1984 = 甲子. |
| Month pillar | Changes at the exact moment of each of the 12 节 (jie) terms. Month stem from the year stem (五虎遁). |
| Day pillar | From the Julian Day Number: index = (JDN + 49) mod 60, so 2000-01-01 = 戊午. |
| Day boundary | **23:00** (子初换日): from 23:00 the day pillar is the next day's. |
| Hour pillar | Two-hour branches, 23:00–01:00 = 子. Hour stem from the day stem (五鼠遁). |
| True solar time | Used only when longitude is given: UTC + longitude/15 h + equation of time (NOAA approximation, about ±1 min). |
| Solar terms | Looked up in `data/solar-terms.v1.json` (UTC seconds, 1899–2101), generated offline from sxtwl and cross-checked against lunar_python (max disagreement 55 s). |

Births within about a minute of a jie term can land in a different month depending on the ephemeris. This is a known boundary, not a bug.

## 2. Random seeds don't pick a date

A seed draws a **chart label** directly: year pillar (60) × month branch (12) × day pillar (60) × hour branch (12) = **518,400** labels, all valid and equally likely. Month and hour stems follow from the year and day stems. A birthday goes through §1 instead.

Real dates 1900–2100 reach 515,060 of the 518,400 labels (99.4%, measured at hour midpoints in UTC+8).

## 3. Ten Gods and weights

Stems, branches, elements and hidden stems use the standard tables (`packages/core/src/data.ts`).

**Creative weights, not measurements:**

| Source | Weight |
|---|---|
| Visible stem (year, month, hour) | 1.0 |
| Hidden stems: main / middle / residual qi | 1.0 / 0.5 / 0.3 |
| Month branch (月令) | × 2 |
| Day master itself | not counted |

- Weights are normalised to a distribution that sums to 1.
- **Support** = Companion + Rob Wealth + Direct Resource + Indirect Resource. ≥ 0.45 → strong, ≤ 0.30 → weak, otherwise balanced.
- **Top gods**: the three heaviest (ties broken in the fixed order of `TEN_GODS`).

## 4. Masks, drive, MBTI prior

- **Four masks.** Each pillar's dominant god sets one mask: year → social face, month → work mode, day → private self (day branch only, since the day stem is the self), hour → inner drive. On a tie, the visible stem wins for the year and hour pillars.
- **Drive.** wants = the top two gods' wants; cost = the top two gods' costs; break = the top god's break.
- **MBTI** is an output prior only. The formula is in `translation.v1.json` → `mbtiRule`. It reports the top three types and never an exact type.

All text lives in `translation.v1.json`.

## 5. The other seven layers

- Enumerations live in `enums.v1.json`. World 3,072 · Body 768 · Skills 768 · Standing 400 · Signs 576 · Drama 192 · Quirk 63 (plus an optional custom line, not counted).
- Forbidden combinations: `constraints.v1.json`. All layers are drawn, then the rules are checked in order; on the first hit, the **latest layer in that rule whose field the user did not pin** is re-drawn from its own sub-stream (attempt + 1, max 50), and the check repeats. If every field in the rule is pinned, it is an error that names the rule.
- Pinned values (`overrides`, e.g. `world.city=tokyo`) are applied after the layer is drawn, so the stream is consumed the same way and other fields of that layer don't move.
- Age is always 18 or over: every `age_look` value is adult.

**Counting.** Bazi × World × Body = 518,400 × 3,072 × 768 = **1,223,059,046,400** nominal configurations. With the v1 constraints, **1,071,371,059,200** are valid, still over one trillion. All eight layers give about 2.6 × 10²⁴ nominal configurations. These count addresses, not provably different people.

## 6. Seeds

- Code: `1T-XXXX-XXXX-XXXX`, 12 Crockford base32 characters = 60 bits. Parsing is case-insensitive and reads I/L as 1 and O as 0.
- PRNG: splitmix64, computed with BigInt, so it is identical on every platform.
- Each layer draws from its own stream: `seed XOR fnv1a64("1t-persona|v1|<layer>|<attempt>")`. Changing one layer's enum, or re-drawing it, never moves another layer. A birthday replaces only the bazi layer.
