// 种子 → 角色骨架。规则见 spec/bazi-rules.v1.md。
import enums from "../../../spec/enums.v1.json" with { type: "json" };
import constraints from "../../../spec/constraints.v1.json" with { type: "json" };
import translation from "../../../spec/translation.v1.json" with { type: "json" };
import {
  type BirthInput, CHART_LABELS, type ChartReading, type MaskPosition, chartFromBirth, chartFromLabel,
  chartLabel, chartText, readChart,
} from "./bazi.ts";
import { STEMS, TEN_GODS, type TenGod } from "./data.ts";
import { formatSeed, layerStream, parseSeed } from "./seed.ts";

export const RULES_VERSION = 1;
const MAX_ATTEMPTS = 50;

export interface EnumField { id: string; label: string; values: { id: string; label: string }[] }
export interface EnumLayer { id: string; name: string; blurb: string; fields: EnumField[] }
export const LAYERS = enums.layers as EnumLayer[];
export const LAYER_ORDER = LAYERS.map((l) => l.id);

/** 每层的组合数（八字单独算）。 */
export function layerCount(id: string): number {
  if (id === "bazi") return CHART_LABELS;
  const l = LAYERS.find((x) => x.id === id);
  if (!l) throw new Error(`unknown layer ${id}`);
  return l.fields.reduce((a, f) => a * f.values.length, 1);
}

type LayerValues = Record<string, string>; // field id → value id
interface Rule { when: Record<string, string[]>; and: Record<string, string[]>; why: string }
const RULES = constraints.forbid as unknown as Rule[];

/** 用户钉住的字段：「层.字段」→ 值 id。 */
export type Overrides = Record<string, string>;

/** 用户指定的值和约束冲突、又没有可以重抽的一边时抛出。 */
export class ConstraintError extends Error {
  readonly rule?: string;
  constructor(message: string, rule?: string) { super(message); this.name = "ConstraintError"; this.rule = rule; }
}

const valueOf = (picked: Record<string, LayerValues>, path: string): string | undefined => {
  const [layer, field] = path.split(".") as [string, string];
  return picked[layer]?.[field];
};

function matches(cond: Record<string, string[]>, picked: Record<string, LayerValues>): boolean {
  return Object.entries(cond).every(([path, vals]) => {
    const v = valueOf(picked, path);
    return v !== undefined && vals.includes(v);
  });
}

function firstViolation(picked: Record<string, LayerValues>): Rule | null {
  for (const r of RULES) if (matches(r.when, picked) && matches(r.and, picked)) return r;
  return null;
}

/** 校验用户指定的值：层、字段、值都必须存在。 */
export function validateOverrides(overrides: Overrides): void {
  for (const [path, value] of Object.entries(overrides)) {
    const [layerId, fieldId] = path.split(".");
    const layer = LAYERS.find((l) => l.id === layerId);
    if (!layer) throw new ConstraintError(`unknown layer "${layerId}" (layers: ${LAYER_ORDER.join(", ")})`);
    const field = layer.fields.find((f) => f.id === fieldId);
    if (!field) throw new ConstraintError(`unknown field "${path}" (fields: ${layer.fields.map((f) => `${layer.id}.${f.id}`).join(", ")})`);
    if (!field.values.some((v) => v.id === value)) {
      throw new ConstraintError(`"${value}" is not a value of ${path} (values: ${field.values.map((v) => v.id).join(", ")})`);
    }
  }
}

function drawLayer(seed: bigint, layer: EnumLayer, attempt: number, overrides: Overrides): LayerValues {
  const s = layerStream(seed, RULES_VERSION, layer.id, attempt);
  const out: LayerValues = {};
  // 先照常把每个字段都抽一遍（保证子流的消耗和不指定时一样），再盖上用户指定的值
  for (const f of layer.fields) out[f.id] = f.values[s.int(f.values.length)]!.id;
  for (const f of layer.fields) {
    const pinned = overrides[`${layer.id}.${f.id}`];
    if (pinned !== undefined) out[f.id] = pinned;
  }
  return out;
}

/**
 * 抽七层，满足约束。
 * 撞到禁止组合时，重抽这条规则里「最晚的、而且相关字段没被用户钉住」的那一层；两边都钉住就报错。
 */
function drawLayers(seed: bigint, overrides: Overrides): { picked: Record<string, LayerValues>; attempts: Record<string, number> } {
  const attempts: Record<string, number> = Object.fromEntries(LAYER_ORDER.map((id) => [id, 0]));
  for (;;) {
    const picked: Record<string, LayerValues> = {};
    for (const layer of LAYERS) picked[layer.id] = drawLayer(seed, layer, attempts[layer.id]!, overrides);
    const rule = firstViolation(picked);
    if (!rule) return { picked, attempts };
    const free = [...Object.keys(rule.when), ...Object.keys(rule.and)].filter((p) => !(p in overrides));
    if (free.length === 0) {
      const pins = [...Object.keys(rule.when), ...Object.keys(rule.and)].map((p) => `${p}=${overrides[p]}`).join(" + ");
      throw new ConstraintError(`${pins} can't go together: ${rule.why}`, rule.why);
    }
    const target = free.map((p) => p.split(".")[0]!).sort((x, y) => LAYER_ORDER.indexOf(y) - LAYER_ORDER.indexOf(x))[0]!;
    attempts[target]! += 1;
    if (attempts[target]! > MAX_ATTEMPTS) throw new ConstraintError(`layer ${target} could not satisfy the constraints`);
  }
}

/** 层名：bazi 加上七个枚举层。 */
export const ALL_LAYERS = ["bazi", ...LAYER_ORDER];
/** 默认问的三层＝一万亿套餐。 */
export const DEFAULT_ASK = ["bazi", "world", "body"];

export interface Skeleton {
  rulesVersion: number;
  seed: string;
  chart: {
    source: "seed" | "birth";
    label: number;
    pillars: string;
    dayMaster: string;
  };
  reading: ChartReading;
  drive: { wants: string[]; cost: string[]; break: string };
  masks: Record<MaskPosition, { god: TenGod; name: string; line: string }>;
  strength: string;
  mbtiPrior: { type: string; p: number }[];
  layers: Record<string, LayerValues>;
  /** 每层抽了几次（>0 表示被约束打回重抽过） */
  attempts: Record<string, number>;
  /** 塑造师要问的层（用户在第一屏打开的那几层） */
  ask: string[];
  /** 用户钉住的字段 */
  overrides: Overrides;
}

type GodInfo = { name: string; want: string; cost: string; break: string; mbti: Record<"EI" | "NS" | "TF" | "JP", number> };
const GODS = translation.gods as Record<TenGod, GodInfo>;
const MASKS = translation.masks as Record<MaskPosition, { label: string; lines: Record<TenGod, string> }>;

function mbtiPrior(r: ChartReading): { type: string; p: number }[] {
  const axis = { EI: 0.5, NS: 0.5, TF: 0.5, JP: 0.5 };
  for (const g of TEN_GODS) for (const k of Object.keys(axis) as (keyof typeof axis)[]) axis[k] += r.gods[g] * GODS[g].mbti[k];
  for (const k of Object.keys(axis) as (keyof typeof axis)[]) axis[k] = Math.min(0.95, Math.max(0.05, axis[k]));
  const types: { type: string; p: number }[] = [];
  for (const a of ["E", "I"]) for (const b of ["N", "S"]) for (const c of ["F", "T"]) for (const d of ["J", "P"]) {
    const p = (a === "I" ? axis.EI : 1 - axis.EI) * (b === "S" ? axis.NS : 1 - axis.NS)
      * (c === "T" ? axis.TF : 1 - axis.TF) * (d === "P" ? axis.JP : 1 - axis.JP);
    types.push({ type: a + b + c + d, p });
  }
  types.sort((x, y) => y.p - x.p || (x.type < y.type ? -1 : 1));
  const top = types.slice(0, 3);
  const sum = top.reduce((a, t) => a + t.p, 0);
  return top.map((t) => ({ type: t.type, p: Math.round((t.p / sum) * 1000) / 1000 }));
}

export interface SkeletonInput {
  seed: bigint;
  /** 给了生日就用生日排盘；不给就从种子抽一个四柱标签 */
  birth?: BirthInput;
  /** 塑造师要问的层，默认 bazi、world、body */
  ask?: string[];
  /** 钉住的字段，如 { "world.city": "tokyo" } */
  overrides?: Overrides;
  /** 沿用已有骨架的八字（改其他层、重建骨架时用，不重新排盘） */
  keepChart?: { label: number; source: "seed" | "birth" };
}

export function buildSkeleton(input: SkeletonInput): Skeleton {
  const { seed } = input;
  const chart = input.keepChart
    ? chartFromLabel(input.keepChart.label)
    : input.birth
    ? chartFromBirth(input.birth)
    : chartFromLabel(layerStream(seed, RULES_VERSION, "bazi").int(CHART_LABELS));
  const reading = readChart(chart);

  const overrides = input.overrides ?? {};
  validateOverrides(overrides);
  const ask = input.ask ?? DEFAULT_ASK;
  for (const id of ask) if (!ALL_LAYERS.includes(id)) throw new ConstraintError(`unknown layer "${id}" (layers: ${ALL_LAYERS.join(", ")})`);
  const { picked, attempts } = drawLayers(seed, overrides);

  const [g1, g2] = reading.top as [TenGod, TenGod];
  const masks = Object.fromEntries(
    (Object.keys(reading.masks) as MaskPosition[]).map((pos) => {
      const god = reading.masks[pos];
      return [pos, { god, name: GODS[god].name, line: MASKS[pos].lines[god] }];
    }),
  ) as Skeleton["masks"];

  return {
    rulesVersion: RULES_VERSION,
    seed: formatSeed(seed),
    chart: {
      source: input.keepChart?.source ?? (input.birth ? "birth" : "seed"),
      label: chartLabel(chart),
      pillars: chartText(chart),
      dayMaster: STEMS[reading.dayMaster]!,
    },
    reading,
    drive: {
      wants: [GODS[g1].want, GODS[g2].want],
      cost: [GODS[g1].cost, GODS[g2].cost],
      break: GODS[g1].break,
    },
    masks,
    strength: (translation.strength as Record<string, string>)[reading.strength]!,
    mbtiPrior: mbtiPrior(reading),
    layers: picked,
    attempts,
    ask: ALL_LAYERS.filter((id) => ask.includes(id)),
    overrides,
  };
}

/** 改了某些层之后重建骨架：种子、八字、要问的层都沿用，只换钉住的值。 */
export function rebuildSkeleton(k: Skeleton, overrides: Overrides): Skeleton {
  return buildSkeleton({
    seed: parseSeed(k.seed), ask: k.ask, overrides, keepChart: { label: k.chart.label, source: k.chart.source },
  });
}
