import { test } from "node:test";
import assert from "node:assert/strict";
import en from "../src/locales/en.ts";
import zh from "../src/locales/zh.ts";
import ja from "../src/locales/ja.ts";

const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

test("界面词表：中日两份和英文的键一样，占位符一样", () => {
  for (const [name, d] of [["zh", zh], ["ja", ja]] as const) {
    assert.deepEqual(Object.keys(d).sort(), Object.keys(en).sort(), name);
    for (const k of Object.keys(en) as (keyof typeof en)[]) assert.equal(ph(d[k]), ph(en[k]), `${name} ${k}`);
  }
});

test("「不是算命」和「只做成年人」的声明三种语言都在", () => {
  assert.match(en["start.note"], /not fortune-telling/);
  assert.match(zh["start.note"], /不是算命/);
  assert.match(ja["start.note"], /占いではありません/);
  assert.match(en["start.note"], /adults/);
  assert.match(zh["start.note"], /成年人/);
  assert.match(ja["start.note"], /成人/);
});
