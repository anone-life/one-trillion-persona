// 奇人 → 1T 骨架：外在七层全部钉住；内心按 births.ts 里的生日排盘（清末的人超出历法表，用种子排盘）。
// 生日 / 种子是 tools/rare_births.ts 找出来的，保证排盘前两位十神 = 档案里的两个（第 17 步）。
import { BIRTHPLACES, buildSkeleton, parseSeed, type Skeleton } from "@1t-persona/core";
import type { Rare } from "../rare-data.ts";
import { RARE_BIRTHS } from "./births.ts";

export function rareSkeleton(r: Rare): Skeleton {
  const b = RARE_BIRTHS[r.id];
  if (!b) throw new Error(`${r.id}: no birth — run tools/rare_births.ts`);
  if ("seed" in b) return buildSkeleton({ seed: parseSeed(b.seed), ask: [], overrides: r.layers });
  const [y, mo, d] = b.date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = b.time.split(":").map(Number) as [number, number];
  const place = BIRTHPLACES.find((p) => p.id === b.place)!;
  return buildSkeleton({
    seed: BigInt(1000 + Number(r.id)), ask: [],
    birth: { wall: { year: y, month: mo, day: d, hour: hh, minute: mm }, tz: place.tz, place: { id: place.id, label: `${place.label}, ${place.country}` } },
    overrides: r.layers,
  });
}
