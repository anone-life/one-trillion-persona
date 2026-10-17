import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BIRTHPLACES, ConstraintError, ERA_PRESENT, Stream, ageBandFor, buildSkeleton, chartFromBirth, chartText, checkAge,
  offsetMinutes, placeById, rebuildSkeleton,
} from "../src/index.ts";

const seeds = (n: number): bigint[] => {
  const s = new Stream(20261018n);
  return Array.from({ length: n }, () => s.next64() & ((1n << 60n) - 1n));
};
const wall = { year: 1998, month: 4, day: 12, hour: 7, minute: 30 };

test("出生地表：id 不重复，每个时区都认得", () => {
  assert.equal(new Set(BIRTHPLACES.map((p) => p.id)).size, BIRTHPLACES.length);
  for (const p of BIRTHPLACES) assert.doesNotThrow(() => offsetMinutes(p.tz, Date.UTC(2000, 0, 1)), p.id);
});

test("时区跟出生地走：同一个钟面时间，纽约和东京排出的时柱不同；和直接给 tz 一致", () => {
  const ny = placeById("newyork")!, tk = placeById("tokyo")!;
  const a = buildSkeleton({ seed: 1n, birth: { wall, tz: ny.tz, place: { id: ny.id, label: ny.label } } });
  const b = buildSkeleton({ seed: 1n, birth: { wall, tz: tk.tz } });
  assert.notEqual(a.chart.pillars, b.chart.pillars);
  assert.equal(a.chart.pillars, chartText(chartFromBirth({ wall, tz: "America/New_York" })));
  assert.equal(a.birth?.place?.id, "newyork");
});

test("给了生日：年代让人成年，年龄段按岁数钉死，岁数写进骨架", () => {
  for (const seed of seeds(300)) {
    const k = buildSkeleton({ seed, birth: { wall, tz: "Asia/Tokyo" } });
    const age = ERA_PRESENT[k.layers.world!.era!]! - 1998;
    assert.ok(age >= 18 && age <= 90, `${k.seed} era ${k.layers.world!.era} → ${age}`);
    assert.equal(k.birth!.age, age);
    assert.equal(k.layers.body!.age_look, ageBandFor(age));
    assert.deepEqual(checkAge(age, k), []);
    assert.equal(checkAge(age + 1, k).length, 1);
  }
});

test("种子给的年代对不上时换成 2026；用户钉了对不上的年代就报约束错误", () => {
  const k = buildSkeleton({ seed: 5n, birth: { wall, tz: "Asia/Tokyo" }, overrides: { "world.city": "kyoto" } });
  assert.ok(["2026", "2010s", "near-future", "alternate-history", "in-network-virtual"].includes(k.layers.world!.era!));
  assert.equal(k.layers.world!.city, "kyoto");
  assert.throws(() => buildSkeleton({ seed: 5n, birth: { wall, tz: "Asia/Tokyo" }, overrides: { "world.era": "late-qing" } }), ConstraintError);
  assert.throws(() => buildSkeleton({ seed: 5n, birth: { wall, tz: "Asia/Tokyo" }, overrides: { "body.age_look": "18-22" } }), ConstraintError);
});

test("2010 年出生：2026 年只有 16 岁 → 绝不出未成年", () => {
  for (const seed of seeds(200)) {
    const k = buildSkeleton({ seed, birth: { wall: { ...wall, year: 2010 }, tz: "Asia/Seoul" } });
    assert.ok(k.birth!.age >= 18, `${k.seed}: ${k.birth!.age}`);
    assert.equal(k.layers.world!.era, "near-future");
  }
  assert.throws(() => buildSkeleton({ seed: 1n, birth: { wall: { ...wall, year: 2040 }, tz: "Asia/Seoul" } }), ConstraintError);
});

test("重建骨架：生日、岁数、八字都沿用", () => {
  const k = buildSkeleton({ seed: 9n, birth: { wall, tz: "Europe/London", place: { id: "london", label: "London" } }, overrides: { "world.city": "paris" } });
  const r = rebuildSkeleton(k, { ...k.overrides, "body.voice": "low" });
  assert.equal(r.chart.label, k.chart.label);
  assert.deepEqual(r.birth, k.birth);
  assert.equal(r.layers.world!.city, "paris");
});

test("不给生日：产出和以前一样（没有 birth 字段）", () => {
  const k = buildSkeleton({ seed: 9n });
  assert.equal(k.birth, undefined);
  assert.equal(k.chart.source, "seed");
});
