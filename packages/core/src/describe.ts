// 骨架 → 人读得懂的样子：id 换成显示名，加上层名和说明；另出一份纯文字。
// 纯文字版给命令行，也是第 3 步塑造师提示词里「这个人现在长什么样」的那一段。
import { MASK_ORDER, TEN_GODS_ZH } from "./data.ts";
import { type Lang, labelTable, localizedLayers } from "./labels.ts";
import { type Skeleton } from "./skeleton.ts";

export interface DescribedField { id: string; label: string; value: string; valueLabel: string; pinned: boolean }
export interface DescribedLayer { id: string; name: string; blurb: string; asked: boolean; fields: DescribedField[] }

export interface Described {
  seed: string;
  rulesVersion: number;
  inner: {
    asked: boolean;
    pillars: string;
    source: "seed" | "birth";
    dayMaster: string;
    strength: string;
    wants: string[];
    cost: string[];
    breaks: string;
    masks: { position: string; name: string; god: string; line: string }[];
    typeLean: string;
  };
  layers: DescribedLayer[];
  /** 用户整层删掉的层（不在 layers 里） */
  removed: { id: string; name: string }[];
  /** 给了生日才有 */
  birth?: { line: string; age: number; storyYear: number };
}

/** 「Born 1998-04-12 07:30 in New York · 28 in 2026」 */
export function birthLine(k: Skeleton): string | undefined {
  const b = k.birth;
  if (!b) return undefined;
  return `Born ${b.wall} in ${b.place?.label ?? b.tz} · ${b.age} years old in ${b.storyYear}`;
}

const MASK_LABEL: Record<string, string> = {
  social_face: "Social face", work_mode: "Work mode", private_self: "Private self", inner_drive: "Inner drive",
};

/** 骨架 → 显示用的描述。lang 只换给人看的字（默认英文）；给模型看的提示词一律用英文版。 */
export function describe(k: Skeleton, lang: Lang = "en"): Described {
  const t = labelTable(lang);
  const top = k.reading.top;
  const godText = (g: string, key: "want" | "cost" | "break") => t?.gods[g]?.[key];
  const d: Described = {
    seed: k.seed,
    rulesVersion: k.rulesVersion,
    inner: {
      asked: k.ask.includes("bazi"),
      pillars: k.chart.pillars,
      source: k.chart.source,
      dayMaster: k.chart.dayMaster,
      strength: t?.strength[k.reading.strength] ?? k.strength,
      wants: k.drive.wants.map((w, i) => godText(top[i]!, "want") ?? w),
      cost: k.drive.cost.map((c, i) => godText(top[i]!, "cost") ?? c),
      breaks: godText(top[0]!, "break") ?? k.drive.break,
      masks: MASK_ORDER.map((pos) => {
        const god = k.masks[pos].god;
        return {
          position: t?.masks[pos]?.label ?? MASK_LABEL[pos]!,
          name: t?.gods[god]?.name ?? k.masks[pos].name,
          god: TEN_GODS_ZH[god],
          line: t?.masks[pos]?.lines[god] ?? k.masks[pos].line,
        };
      }),
      typeLean: k.mbtiPrior.map((t) => `${t.type} ${Math.round(t.p * 100)}%`).join(" · "),
    },
    removed: localizedLayers(lang).filter((l) => (k.removed ?? []).includes(l.id)).map((l) => ({ id: l.id, name: l.name })),
    layers: localizedLayers(lang).filter((l) => !(k.removed ?? []).includes(l.id)).map((l) => ({
      id: l.id,
      name: l.name,
      blurb: l.blurb,
      asked: k.ask.includes(l.id),
      fields: l.fields.map((f) => {
        const value = k.layers[l.id]![f.id]!;
        return {
          id: f.id, label: f.label, value,
          valueLabel: f.values.find((v) => v.id === value)!.label,
          pinned: `${l.id}.${f.id}` in k.overrides,
        };
      }),
    })),
    ...(k.birth ? { birth: { line: birthLine(k)!, age: k.birth.age, storyYear: k.birth.storyYear } } : {}),
  };
  return d;
}

const tag = (asked: boolean) => (asked ? "[you decide]" : "[from the seed]");

export function renderText(k: Skeleton): string {
  const d = describe(k);
  const out: string[] = [];
  out.push(`${d.seed} · rules v${d.rulesVersion}`, "");
  const i = d.inner;
  if (d.birth) out.push(d.birth.line, "");
  out.push(`INNER  ${tag(i.asked)}`);
  out.push(`  Chart ${i.pillars} (${i.source === "birth" ? "from a birthday" : "from the seed"}) · day master ${i.dayMaster}`);
  out.push(`  ${i.strength}`);
  out.push(`  Wants:        ${i.wants[0]}`, `                ${i.wants[1]}`);
  out.push(`  The cost:     ${i.cost[0]}`, `                ${i.cost[1]}`);
  out.push(`  Breaks when:  ${i.breaks}`);
  for (const m of i.masks) out.push(`  ${m.position.padEnd(13)} ${m.name} (${m.god}) — ${m.line}`);
  out.push(`  Type lean:    ${i.typeLean}  (a prior, not a test result)`);
  if (d.removed.length) out.push("", `LEFT OUT BY THE USER — don't write anything about these: ${d.removed.map((r) => r.name).join(", ")}`);
  for (const l of d.layers) {
    out.push("", `${l.name.toUpperCase()}  ${tag(l.asked)}`);
    for (const f of l.fields) out.push(`  ${(f.label + ":").padEnd(19)} ${f.valueLabel}${f.pinned ? "  (pinned)" : ""}`);
  }
  return out.join("\n");
}
