// 骨架 → 人读得懂的样子：id 换成显示名，加上层名和说明；另出一份纯文字。
// 纯文字版给命令行，也是第 3 步塑造师提示词里「这个人现在长什么样」的那一段。
import { MASK_ORDER, TEN_GODS_ZH } from "./data.ts";
import { LAYERS, type Skeleton } from "./skeleton.ts";

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
}

const MASK_LABEL: Record<string, string> = {
  social_face: "Social face", work_mode: "Work mode", private_self: "Private self", inner_drive: "Inner drive",
};

export function describe(k: Skeleton): Described {
  return {
    seed: k.seed,
    rulesVersion: k.rulesVersion,
    inner: {
      asked: k.ask.includes("bazi"),
      pillars: k.chart.pillars,
      source: k.chart.source,
      dayMaster: k.chart.dayMaster,
      strength: k.strength,
      wants: k.drive.wants,
      cost: k.drive.cost,
      breaks: k.drive.break,
      masks: MASK_ORDER.map((pos) => ({
        position: MASK_LABEL[pos]!, name: k.masks[pos].name, god: TEN_GODS_ZH[k.masks[pos].god], line: k.masks[pos].line,
      })),
      typeLean: k.mbtiPrior.map((t) => `${t.type} ${Math.round(t.p * 100)}%`).join(" · "),
    },
    layers: LAYERS.map((l) => ({
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
  };
}

const tag = (asked: boolean) => (asked ? "[you decide]" : "[from the seed]");

export function renderText(k: Skeleton): string {
  const d = describe(k);
  const out: string[] = [];
  out.push(`${d.seed} · rules v${d.rulesVersion}`, "");
  const i = d.inner;
  out.push(`INNER  ${tag(i.asked)}`);
  out.push(`  Chart ${i.pillars} (${i.source === "birth" ? "from a birthday" : "from the seed"}) · day master ${i.dayMaster}`);
  out.push(`  ${i.strength}`);
  out.push(`  Wants:        ${i.wants[0]}`, `                ${i.wants[1]}`);
  out.push(`  The cost:     ${i.cost[0]}`, `                ${i.cost[1]}`);
  out.push(`  Breaks when:  ${i.breaks}`);
  for (const m of i.masks) out.push(`  ${m.position.padEnd(13)} ${m.name} (${m.god}) — ${m.line}`);
  out.push(`  Type lean:    ${i.typeLean}  (a prior, not a test result)`);
  for (const l of d.layers) {
    out.push("", `${l.name.toUpperCase()}  ${tag(l.asked)}`);
    for (const f of l.fields) out.push(`  ${(f.label + ":").padEnd(19)} ${f.valueLabel}${f.pinned ? "  (pinned)" : ""}`);
  }
  return out.join("\n");
}
