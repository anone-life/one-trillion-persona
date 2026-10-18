// 显示用的多语言文字（中、日）。只换给人看的字，id 一个不动，所以种子产出和语言无关。
// 词表在 spec/i18n/{zh,ja}.json，按 id 对应英文；缺的条目回落到英文。
import zh from "../../../spec/i18n/zh.json" with { type: "json" };
import ja from "../../../spec/i18n/ja.json" with { type: "json" };
import translation from "../../../spec/translation.v1.json" with { type: "json" };
import { LAYERS, type EnumLayer } from "./skeleton.ts";
import { BIRTHPLACES } from "./places.ts";

export type Lang = "en" | "zh" | "ja";
export const LANGS: Lang[] = ["en", "zh", "ja"];

interface LabelTable {
  layers: Record<string, { name: string; blurb: string; fields: Record<string, { label: string; values: Record<string, string> }> }>;
  gods: Record<string, { name: string; want: string; cost: string; break: string }>;
  masks: Record<string, { label: string; lines: Record<string, string> }>;
  strength: Record<string, string>;
  places: Record<string, string>;
  countries: Record<string, string>;
}
const TABLES: Partial<Record<Lang, LabelTable>> = { zh: zh as LabelTable, ja: ja as LabelTable };

export function labelTable(lang: Lang): LabelTable | undefined {
  return TABLES[lang];
}

/** 枚举层的显示版（层名、说明、字段名、取值名换成该语言；id 不变）。 */
export function localizedLayers(lang: Lang): EnumLayer[] {
  const t = TABLES[lang];
  if (!t) return LAYERS;
  return LAYERS.map((l) => {
    const tl = t.layers[l.id];
    return {
      ...l,
      name: tl?.name ?? l.name,
      blurb: tl?.blurb ?? l.blurb,
      fields: l.fields.map((f) => {
        const tf = tl?.fields[f.id];
        return { ...f, label: tf?.label ?? f.label, values: f.values.map((v) => ({ ...v, label: tf?.values[v.id] ?? v.label })) };
      }),
    };
  });
}

export function placeLabel(id: string, lang: Lang): string {
  const p = BIRTHPLACES.find((x) => x.id === id);
  return TABLES[lang]?.places[id] ?? p?.label ?? id;
}

export function countryLabel(country: string, lang: Lang): string {
  return TABLES[lang]?.countries[country] ?? country;
}

/** 十神的显示文字（名字、想要、代价、崩溃点）；中日查 spec/i18n，英文查 translation.v1.json。 */
export function godLabel(id: string, lang: Lang): { name: string; want: string; cost: string; break: string } | undefined {
  const en = (translation.gods as Record<string, { name: string; want: string; cost: string; break: string }>)[id];
  if (!en) return undefined;
  const tr = TABLES[lang]?.gods[id];
  return { name: tr?.name ?? en.name, want: tr?.want ?? en.want, cost: tr?.cost ?? en.cost, break: tr?.break ?? en.break };
}
