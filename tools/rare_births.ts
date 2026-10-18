// 给「奇人」页的每个人找一个生日：在 TA 的年代和年龄段允许的年份里，按天、按两小时一档搜，
// 找到排盘后前两位十神正好是档案里那两个（顺序也对）的时刻。结果写进 apps/web/src/rare/births.ts。
// 出生年份早于 1900（例如清末：故事年 1905，28–34 岁要生在 1870 年代）超出 1T 的历法表（1900–2100），
// 这种人改用「种子排盘」：1T 不给生日时由种子抽一个四柱，这里找一个抽出来正好是这两个十神的种子。
//   node tools/rare_births.ts
// 设计见根文档仓库 docs/1T-persona/steps/step17_rare_100.md。
import fs from "node:fs/promises";
import { BIRTHPLACES, ERA_PRESENT, ageBandFor, ageInEra, buildSkeleton, chartFromBirth, readChart } from "@1t-persona/core";
import { RARE } from "../apps/web/src/rare-data.ts";

const BAND: Record<string, [number, number]> = { "18-22": [18, 22], "23-27": [23, 27], "28-34": [28, 34], "35-44": [35, 44], "45-54": [45, 54], "55-plus": [55, 70] };
// 世界层的城市 → 出生地（时区）。不在出生地表里的：湾区用旧金山；无名港口借香港的时区（档案里不写真名，只为排盘）。
const PLACE_OF: Record<string, string> = { "fremont-sf": "sanfrancisco", "unnamed-port": "hongkong" };

type Birth = { date: string; time: string; place: string } | { seed: string };
const out: Record<string, Birth> = {};
const pad = (n: number) => String(n).padStart(2, "0");
for (const r of RARE) {
  const era = r.layers["world.era"]!, band = r.layers["body.age_look"]!;
  const [lo, hi] = BAND[band]!;
  const present = ERA_PRESENT[era]!;
  const placeId = PLACE_OF[r.layers["world.city"]!] ?? r.layers["world.city"]!;
  const place = BIRTHPLACES.find((p) => p.id === placeId);
  if (!place) throw new Error(`${r.id}: no birthplace for ${placeId}`);
  let found: { date: string; time: string } | undefined;
  if (present - hi - 1 < 1900) {
    for (let s = 1; s < 200000; s++) {
      const k = buildSkeleton({ seed: BigInt(s), overrides: r.layers });
      if (k.reading.top[0] === r.gods[0] && k.reading.top[1] === r.gods[1]) { out[r.id] = { seed: k.seed }; process.stdout.write(`${r.id} seed ${k.seed}\n`); break; }
    }
    if (!out[r.id]) throw new Error(`${r.id}: no seed gives ${r.gods.join(" + ")}`);
    continue;
  }
  // 从年龄段中间的那一年往两边找，同一个人每次跑结果一样
  const years: number[] = [];
  for (let d = 0; d <= hi - lo + 1; d++) for (const y of [present - Math.round((lo + hi) / 2) - d, present - Math.round((lo + hi) / 2) + d]) if (!years.includes(y)) years.push(y);
  search: for (const year of years) {
    for (let m = 1; m <= 12; m++) for (let day = 1; day <= 28; day++) for (let hour = 1; hour < 24; hour += 2) {
      const wall = { year, month: m, day, hour, minute: 30 };
      const age = ageInEra(wall, era);
      if (age < lo || age > hi || ageBandFor(age) !== band) continue;
      const top = readChart(chartFromBirth({ wall, tz: place.tz })).top;
      if (top[0] === r.gods[0] && top[1] === r.gods[1]) { found = { date: `${year}-${pad(m)}-${pad(day)}`, time: `${pad(hour)}:30` }; break search; }
    }
  }
  if (!found) throw new Error(`${r.id}: no birthday gives ${r.gods.join(" + ")} in ${era}/${band}`);
  // 用真正的造人函数复核：外在七层全部钉住，年代、年龄段对得上，内心前两位是这两个十神
  const [y, mo, d] = found.date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = found.time.split(":").map(Number) as [number, number];
  const k = buildSkeleton({ seed: BigInt(1000 + Number(r.id)), birth: { wall: { year: y, month: mo, day: d, hour: hh, minute: mm }, tz: place.tz, place: { id: place.id, label: `${place.label}, ${place.country}` } }, overrides: r.layers });
  if (k.reading.top[0] !== r.gods[0] || k.reading.top[1] !== r.gods[1]) throw new Error(`${r.id}: recheck failed`);
  out[r.id] = { ...found, place: place.id };
  process.stdout.write(`${r.id} ${found.date} ${found.time} ${place.id}\n`);
}

const body = `// 由 tools/rare_births.ts 生成，别手改。每人一个生日：排盘后前两位十神 = 档案里的两个，年代、年龄段对得上。\nexport const RARE_BIRTHS: Record<string, { date: string; time: string; place: string } | { seed: string }> = ${JSON.stringify(out, null, 2)};\n`;
await fs.writeFile("apps/web/src/rare/births.ts", body);
console.log(`${Object.keys(out).length} births → apps/web/src/rare/births.ts`);
