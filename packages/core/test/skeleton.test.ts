import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAYERS, Stream, buildSkeleton, chartFromBirth, chartLabel, chartText, formatSeed, layerCount, parseSeed,
} from "../src/index.ts";

const seeds = (n: number): bigint[] => {
  const s = new Stream(20261017n);
  return Array.from({ length: n }, () => s.next64() & ((1n << 60n) - 1n));
};

test("种子号：格式化和解析互逆，容错 I/L/O 和小写", () => {
  for (const v of seeds(200)) assert.equal(parseSeed(formatSeed(v)), v);
  const code = formatSeed(0x123456789abcdefn);
  assert.match(code, /^1T-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.equal(parseSeed(code.toLowerCase()), 0x123456789abcdefn);
  assert.equal(parseSeed("1t-0000-0000-000o"), 0n);
  assert.throws(() => parseSeed("1T-ABC"));
});

test("验收 4：同一种子跑 100 次，骨架一字不差", () => {
  for (const seed of seeds(5)) {
    const first = JSON.stringify(buildSkeleton({ seed }));
    for (let i = 0; i < 100; i++) assert.equal(JSON.stringify(buildSkeleton({ seed })), first);
  }
});

test("验收 5：各层组合数", () => {
  const want: Record<string, number> = {
    bazi: 518400, world: 3072, body: 768, skills: 768, status: 400, signs: 576, drama: 192, glitch: 63,
  };
  for (const [id, n] of Object.entries(want)) assert.equal(layerCount(id), n, id);
  assert.equal(layerCount("bazi") * layerCount("world") * layerCount("body"), 1_223_059_046_400);
});

test("约束后的有效数：八字 × 世界 × 身体 仍然超过一万亿", () => {
  const fields = ["world", "body"].flatMap((id) => LAYERS.find((l) => l.id === id)!.fields.map((f) => ({ layer: id, f })));
  const pick: Record<string, string> = {};
  let valid = 0;
  const walk = (i: number): void => {
    if (i === fields.length) {
      const era = pick["world.era"]!;
      const old = era === "late-qing" || era === "showa";
      const bad = (pick["world.law"] === "wartime" && pick["world.scarcity"] === "abundant")
        || (old && (pick["body.embodiment"] === "virtual-idol" || pick["body.voice"] === "synthetic"));
      if (!bad) valid++;
      return;
    }
    const { layer, f } = fields[i]!;
    for (const v of f.values) { pick[`${layer}.${f.id}`] = v.id; walk(i + 1); }
  };
  walk(0);
  assert.equal(valid, 2_066_688);
  assert.equal(valid * layerCount("bazi"), 1_071_371_059_200);
});

test("验收 6：1,000 个种子——没有禁止组合、全部成年、没有空字段", () => {
  const adult = new Set(["18-22", "23-27", "28-34", "35-44", "45-54", "55-plus"]);
  let redraws = 0;
  for (const seed of seeds(1000)) {
    const k = buildSkeleton({ seed });
    assert.ok(adult.has(k.layers.body!.age_look!), `age ${k.layers.body!.age_look}`);
    for (const layer of LAYERS) for (const f of layer.fields) assert.ok(k.layers[layer.id]![f.id], `${layer.id}.${f.id}`);
    const era = k.layers.world!.era!;
    assert.ok(!(k.layers.world!.law === "wartime" && k.layers.world!.scarcity === "abundant"));
    if (era === "late-qing" || era === "showa") {
      assert.notEqual(k.layers.body!.embodiment, "virtual-idol");
      assert.notEqual(k.layers.body!.voice, "synthetic");
    }
    if (era === "late-qing") assert.ok(!["y2k", "cyber", "idol-packaged", "nightlife-host"].includes(k.layers.signs!.aesthetic!));
    redraws += Object.values(k.attempts).reduce((a, b) => a + b, 0);
    assert.equal(k.mbtiPrior.length, 3);
    assert.ok(Math.abs(k.mbtiPrior.reduce((a, t) => a + t.p, 0) - 1) < 0.01);
  }
  console.log(`# redraws across 1000 seeds: ${redraws}`);
});

test("改一层的抽法不影响别的层：每层的子流互相独立", () => {
  const seed = seeds(1)[0]!;
  const k = buildSkeleton({ seed });
  const withBirth = buildSkeleton({ seed, birth: { wall: { year: 1998, month: 4, day: 12, hour: 7, minute: 30 }, tz: "Asia/Tokyo" } });
  assert.notEqual(withBirth.chart.pillars, k.chart.pillars);
  assert.deepEqual(withBirth.layers.world, k.layers.world); // 换了八字，世界不动
  assert.deepEqual(withBirth.layers.glitch, k.layers.glitch);
});

test("时区和真太阳时", () => {
  const wall = { year: 1998, month: 4, day: 12, hour: 7, minute: 30 };
  assert.equal(chartText(chartFromBirth({ wall, tz: "Asia/Tokyo" })), chartText(chartFromBirth({ wall, tz: "+09:00" })));
  // 上海 1988 年夏令时：钟面 01:30 实为标准时 00:30——去掉夏令时后是子时，不是丑时
  const dst = { year: 1988, month: 7, day: 1, hour: 1, minute: 30 };
  assert.equal(chartFromBirth({ wall: dst, tz: "Asia/Shanghai" }).hour.branch, 0);
  assert.equal(chartFromBirth({ wall: dst, tz: "+08:00" }).hour.branch, 1);
  // 纽约夏令时同理
  assert.equal(chartFromBirth({ wall: { year: 2020, month: 7, day: 1, hour: 1, minute: 30 }, tz: "America/New_York" }).hour.branch, 0);
  // 乌鲁木齐用北京时间但经度 87.6°E：真太阳时晚两个多小时，时柱会变
  const late = { year: 2000, month: 6, day: 1, hour: 9, minute: 0 };
  const std = chartFromBirth({ wall: late, tz: "+08:00" });
  const solar = chartFromBirth({ wall: late, tz: "+08:00", longitude: 87.6 });
  assert.notEqual(std.hour.branch, solar.hour.branch);
});

test("验收 7：1900–2100 的真实日期能覆盖多少个四柱标签", () => {
  const seen = new Set<number>();
  const start = Date.UTC(1900, 0, 1);
  const end = Date.UTC(2100, 11, 31);
  for (let t = start; t <= end; t += 86400000) {
    const d = new Date(t);
    for (let h = 0; h < 24; h += 2) {
      // 每个时辰取中点；子时 23–1 取 0 点，另取 23:30 落到下一天的子时
      for (const [hour, minute] of h === 0 ? [[0, 0], [23, 30]] : [[h, 0]]) {
        const wall = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: hour!, minute: minute! };
        try { seen.add(chartLabel(chartFromBirth({ wall, tz: "+08:00" }))); } catch { /* 超出范围 */ }
      }
    }
  }
  console.log(`# reachable chart labels 1900–2100 (hour midpoints, UTC+8): ${seen.size} / 518400 (${((seen.size / 518400) * 100).toFixed(1)}%)`);
  assert.ok(seen.size > 0);
});
