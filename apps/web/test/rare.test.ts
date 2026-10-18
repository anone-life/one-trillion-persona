import { test } from "node:test";
import assert from "node:assert/strict";
import { LAYERS, godLabel, validateOverrides } from "@1t-persona/core";
import constraints from "../../../spec/constraints.v1.json" with { type: "json" };
import { RARE } from "../src/rare-data.ts";
import { rareSkeleton } from "../src/rare/skeleton.ts";
import { RARE_CONTEXT } from "../src/rare/context.ts";

// 「奇人」页的每个人都必须是 1T 真能抽出来的组合（step16_rare_gallery.md）
const ALL_FIELDS = LAYERS.flatMap((l) => l.fields.map((f) => `${l.id}.${f.id}`));
type Rule = { why: string; when: Record<string, string[]>; and: Record<string, string[]> };
const hits = (r: Record<string, string[]>, v: Record<string, string>) => Object.entries(r).every(([k, vs]) => vs.includes(v[k]!));

test("奇人：取值都在 enums 里、外在七层字段齐全、不违反层间约束、十神存在、三语齐、都是成年", () => {
  assert.equal(new Set(RARE.map((r) => r.id)).size, RARE.length);
  for (const r of RARE) {
    validateOverrides(r.layers);
    assert.deepEqual(Object.keys(r.layers).sort(), [...ALL_FIELDS].sort(), r.id);
    for (const rule of constraints.forbid as Rule[]) assert.ok(!(hits(rule.when, r.layers) && hits(rule.and, r.layers)), `${r.id}: ${rule.why}`);
    for (const g of r.gods) assert.ok(godLabel(g, "en"), `${r.id}: god ${g}`);
    assert.ok(["masculine", "feminine"].includes(r.layers["body.gender_present"]!), `${r.id}: web only offers man / woman`);
    for (const k of ["name", "hook", "twist", "scene", "first"] as const) for (const l of ["en", "zh", "ja"] as const) assert.ok(r[k][l].trim(), `${r.id}.${k}.${l}`);
  }
});

test("奇人：每个人的生日（或种子）排出来的前两位十神 = 档案里的两个，年龄段对得上（step17）", () => {
  for (const r of RARE) {
    const k = rareSkeleton(r);
    assert.deepEqual(k.reading.top.slice(0, 2), r.gods, r.id);
    assert.equal(k.layers.body!.age_look, r.layers["body.age_look"], r.id);
  }
});

test("奇人：每个人都有初见情境（你是谁 / 关系 / 冲突点）三语齐（step22）", () => {
  for (const r of RARE) {
    const c = RARE_CONTEXT[r.id];
    assert.ok(c, `${r.id}: no context`);
    for (const k of ["you", "relation", "tension"] as const) for (const l of ["en", "zh", "ja"] as const) assert.ok(c[k][l].trim(), `${r.id}.${k}.${l}`);
  }
  assert.equal(Object.keys(RARE_CONTEXT).length, RARE.length);
});
