import { test } from "node:test";
import assert from "node:assert/strict";
import oracle from "./fixtures/oracle-pillars.json" with { type: "json" };
import solarTerms from "../../../spec/data/solar-terms.v1.json" with { type: "json" };
import {
  CHART_LABELS, chartFromBirth, chartFromLabel, chartLabel, chartText, readChart,
} from "../src/bazi.ts";
import { tenGod } from "../src/data.ts";

type Case = [number, number, number, number, number, string];
const cases = oracle.cases as Case[];

const run = ([year, month, day, hour, minute]: Case) =>
  chartText(chartFromBirth({ wall: { year, month, day, hour, minute }, tz: oracle.tz }));

test("验收 2：20 个挑过的边界时刻和参照库一致", () => {
  for (const c of cases.slice(0, 20)) assert.equal(run(c), c[5], `case ${c.slice(0, 5).join("-")}`);
});

// 两个库的节气时刻最多差 55 秒（tools/gen_solar_terms.py 的输出）。落在这段缝里的时刻，
// 月柱（立春前后还有年柱）取决于用哪家的节气——我们用 sxtwl，参照库是 lunar_python。
const TERM_GAP_SECONDS = 60;
const JIE_TIMES = Object.values(solarTerms.terms as Record<string, number[]>).flatMap((row) => row.filter((_, i) => i % 2 === 0));

test("验收 3：10,000 个随机时刻和参照库一致（不一致的只能是节气那几十秒的缝）", () => {
  const bad = cases.slice(20).filter((c) => run(c) !== c[5]);
  const unexplained = bad.filter((c) => {
    const [year, month, day, hour, minute] = c;
    const t = Date.UTC(year, month - 1, day, hour - 8, minute) / 1000;
    const nearJie = JIE_TIMES.some((j) => Math.abs(j - t) <= TERM_GAP_SECONDS);
    const sameDayHour = run(c).split(" ").slice(2).join(" ") === c[5].split(" ").slice(2).join(" ");
    return !(nearJie && sameDayHour);
  });
  assert.equal(unexplained.length, 0, `unexplained: ${JSON.stringify(unexplained.slice(0, 10).map((c) => [c, run(c)]))}`);
  assert.ok(bad.length <= 50, `too many term-gap mismatches: ${bad.length}`);
  console.log(`# term-gap mismatches: ${bad.length} / ${cases.length - 20}`);
});

test("标签和四柱一一对应", () => {
  for (const label of [0, 1, 12345, 518399, 271828]) assert.equal(chartLabel(chartFromLabel(label)), label);
  assert.equal(CHART_LABELS, 518400);
});

test("十神：甲日主", () => {
  assert.equal(tenGod(0, 0), "companion");
  assert.equal(tenGod(0, 1), "rob_wealth");
  assert.equal(tenGod(0, 2), "eating_god");
  assert.equal(tenGod(0, 3), "hurting_officer");
  assert.equal(tenGod(0, 4), "indirect_wealth");
  assert.equal(tenGod(0, 5), "direct_wealth");
  assert.equal(tenGod(0, 6), "seven_killings");
  assert.equal(tenGod(0, 7), "direct_officer");
  assert.equal(tenGod(0, 8), "indirect_resource");
  assert.equal(tenGod(0, 9), "direct_resource");
});

test("读盘：权重和为 1、同一盘结果稳定", () => {
  const c = chartFromLabel(271828);
  const r = readChart(c);
  const sum = Object.values(r.gods).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 0.001);
  assert.equal(r.top.length, 3);
  assert.deepEqual(readChart(c), r);
});
