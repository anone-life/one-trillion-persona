import { test } from "node:test";
import assert from "node:assert/strict";
import { ConstraintError, LAYERS, Stream, buildSkeleton, describe } from "@1t-persona/core";
import constraints from "../../../spec/constraints.v1.json" with { type: "json" };
import { run } from "../src/main.ts";

const SEED = "1T-3F9A-77C2-K8QX";

test("验收 1：随机、给种子、给生日都能出结果；同一种子两次一字不差", () => {
  assert.equal(run(["roll"]).code, 0);
  const a = run(["roll", "--seed", SEED]);
  assert.equal(a.code, 0);
  assert.equal(run(["roll", "--seed", SEED]).out, a.out);
  assert.match(a.out, /^1T-3F9A-77C2-K8QX · rules v1/);
  const b = run(["roll", "--seed", SEED, "--birth", "1998-04-12 07:30", "--tz", "+08:00"]);
  assert.match(b.out, /Chart 戊寅 丙辰 己丑 戊辰 \(from a birthday\)/);
  const j = JSON.parse(run(["roll", "--seed", SEED, "--json", "--ask", "bazi,skills"]).out);
  assert.deepEqual(j.ask, ["bazi", "skills"]);
});

const rand = new Stream(42n);
const fields = LAYERS.flatMap((l) => l.fields.map((f) => ({ path: `${l.id}.${f.id}`, values: f.values.map((v) => v.id) })));
const rules = constraints.forbid as unknown as { when: Record<string, string[]>; and: Record<string, string[]> }[];
const violates = (k: ReturnType<typeof buildSkeleton>) => rules.some((r) =>
  [r.when, r.and].every((cond) => Object.entries(cond).every(([p, vals]) => {
    const [layer, field] = p.split(".") as [string, string];
    return vals.includes(k.layers[layer]![field]!);
  })));

test("验收 2：1,000 组随机指定值——指定的全部保留、没有禁止组合", () => {
  let ok = 0;
  let conflicts = 0;
  for (let i = 0; i < 1000; i++) {
    const seed = rand.next64() & ((1n << 60n) - 1n);
    const overrides: Record<string, string> = {};
    for (let n = 1 + rand.int(3); n > 0; n--) {
      const f = fields[rand.int(fields.length)]!;
      overrides[f.path] = f.values[rand.int(f.values.length)]!;
    }
    try {
      const k = buildSkeleton({ seed, overrides });
      for (const [p, v] of Object.entries(overrides)) {
        const [layer, field] = p.split(".") as [string, string];
        assert.equal(k.layers[layer]![field], v, p);
      }
      assert.ok(!violates(k));
      ok++;
    } catch (e) {
      assert.ok(e instanceof ConstraintError, String(e)); // 只允许是「两个指定值本身冲突」
      conflicts++;
    }
  }
  console.log(`# overrides: ${ok} ok, ${conflicts} pinned-vs-pinned conflicts`);
  assert.ok(ok > 950);
});

test("验收 3：两个指定值冲突时报错，信息里有原因", () => {
  const r = () => run(["roll", "--set", "world.era=late-qing", "--set", "body.embodiment=virtual-idol"]);
  assert.throws(r, (e: Error) => e instanceof ConstraintError && /internet era/.test(e.message));
  assert.throws(() => run(["roll", "--set", "world.city=atlantis"]), /not a value of world.city/);
  assert.throws(() => run(["roll", "--ask", "bazi,feelings"]), /unknown layer "feelings"/);
});

test("验收 4：只指定 world.city 时，其余各层和不指定时完全相同", () => {
  const seedRand = new Stream(7n);
  for (let i = 0; i < 200; i++) {
    const seed = seedRand.next64() & ((1n << 60n) - 1n);
    const plain = buildSkeleton({ seed });
    const pinned = buildSkeleton({ seed, overrides: { "world.city": "tokyo" } });
    for (const l of LAYERS) {
      if (l.id === "world") {
        const { city: _a, ...restA } = plain.layers.world!;
        const { city: _b, ...restB } = pinned.layers.world!;
        assert.deepEqual(restB, restA);
      } else assert.deepEqual(pinned.layers[l.id], plain.layers[l.id], l.id);
    }
    assert.equal(pinned.chart.pillars, plain.chart.pillars);
  }
});

test("指定值逼着更早的一层重抽：钉 body.embodiment=virtual-idol 时，时代不会落在清末、昭和", () => {
  const seedRand = new Stream(9n);
  for (let i = 0; i < 300; i++) {
    const seed = seedRand.next64() & ((1n << 60n) - 1n);
    const k = buildSkeleton({ seed, overrides: { "body.embodiment": "virtual-idol" } });
    assert.ok(!["late-qing", "showa"].includes(k.layers.world!.era!));
  }
});

test("验收 5：10,000 个骨架 < 2 秒", () => {
  const seedRand = new Stream(11n);
  const t0 = performance.now();
  for (let i = 0; i < 10000; i++) buildSkeleton({ seed: seedRand.next64() & ((1n << 60n) - 1n) });
  const ms = performance.now() - t0;
  console.log(`# 10,000 skeletons in ${ms.toFixed(0)} ms`);
  assert.ok(ms < 2000);
});

test("可读版：每个字段都有显示名，钉住的有标记", () => {
  const d = describe(buildSkeleton({ seed: 1n, overrides: { "world.city": "kyoto" } }));
  for (const l of d.layers) for (const f of l.fields) assert.ok(f.valueLabel && f.label);
  assert.equal(d.layers.find((l) => l.id === "world")!.fields.find((f) => f.id === "city")!.pinned, true);
});
