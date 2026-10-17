import { test } from "node:test";
import assert from "node:assert/strict";
import enums from "../../../spec/enums.v1.json" with { type: "json" };
import translation from "../../../spec/translation.v1.json" with { type: "json" };
import { BIRTHPLACES, LANGS, buildSkeleton, describe, labelTable, localizedLayers } from "../src/index.ts";

test("spec/i18n：中日两份覆盖每一个层、字段、取值、十神、场合、身强弱、出生地、国家", () => {
  for (const lang of ["zh", "ja"] as const) {
    const t = labelTable(lang)!;
    for (const l of enums.layers) {
      assert.ok(t.layers[l.id]?.name && t.layers[l.id]?.blurb, `${lang} ${l.id}`);
      for (const f of l.fields) {
        assert.ok(t.layers[l.id]!.fields[f.id]?.label, `${lang} ${l.id}.${f.id}`);
        for (const v of f.values) assert.ok(t.layers[l.id]!.fields[f.id]!.values[v.id], `${lang} ${l.id}.${f.id}.${v.id}`);
      }
    }
    for (const g of Object.keys(translation.gods)) for (const k of ["name", "want", "cost", "break"] as const) assert.ok(t.gods[g]?.[k], `${lang} ${g}.${k}`);
    for (const [pos, m] of Object.entries(translation.masks)) {
      assert.ok(t.masks[pos]?.label, `${lang} mask ${pos}`);
      for (const g of Object.keys(m.lines)) assert.match(t.masks[pos]!.lines[g]!, /^[^:：]+[:：]/, `${lang} ${pos}.${g} keeps the "setting:" prefix`);
    }
    for (const s of Object.keys(translation.strength)) assert.ok(t.strength[s], `${lang} strength ${s}`);
    for (const p of BIRTHPLACES) { assert.ok(t.places[p.id], `${lang} place ${p.id}`); assert.ok(t.countries[p.country], `${lang} country ${p.country}`); }
  }
});

test("语言只换显示：同一个种子三种语言的骨架一模一样，id 不变", () => {
  const k = buildSkeleton({ seed: 123456789n, birth: { wall: { year: 1998, month: 4, day: 12, hour: 7, minute: 30 }, tz: "Asia/Tokyo" } });
  const ids = (lang: (typeof LANGS)[number]) => describe(k, lang).layers.map((l) => l.fields.map((f) => `${l.id}.${f.id}=${f.value}`)).flat();
  assert.deepEqual(ids("zh"), ids("en"));
  assert.deepEqual(ids("ja"), ids("en"));
  assert.notEqual(describe(k, "zh").inner.wants[0], describe(k, "en").inner.wants[0]);
  assert.deepEqual(describe(k, "en").inner.wants, k.drive.wants);
  assert.equal(localizedLayers("ja").length, enums.layers.length);
});
