// 排盘与十神权重。规则见 spec/bazi-rules.v1.md。
import {
  BRANCHES, HIDDEN_STEMS, STEMS, TEN_GODS, type TenGod, tenGod,
} from "./data.ts";
import {
  MAX_YEAR, MIN_YEAR, type WallTime, julianDayNumber, solarMonthAt, trueSolarWall, utcToStandardWall, wallToUtc,
} from "./calendar.ts";

/** 六十甲子里的一柱：stem 0–9，branch 0–11。 */
export interface Pillar { stem: number; branch: number }
export interface Chart { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }

/** 四柱标签空间的大小：年柱 60 × 月支 12 × 日柱 60 × 时支 12。 */
export const CHART_LABELS = 60 * 12 * 60 * 12; // 518,400

/** 六十甲子序号（甲子 = 0）。 */
export const cycleIndex = (p: Pillar): number => (((6 * p.stem - 5 * p.branch) % 60) + 60) % 60;
export const pillarAt = (i: number): Pillar => ({ stem: i % 10, branch: i % 12 });
export const pillarText = (p: Pillar): string => STEMS[p.stem]! + BRANCHES[p.branch]!;
export const chartText = (c: Chart): string =>
  [c.year, c.month, c.day, c.hour].map(pillarText).join(" ");

/** 五虎遁：年干定寅月的月干，其余顺推。 */
export const monthStem = (yearStem: number, monthBranch: number): number =>
  ((yearStem % 5) * 2 + 2 + ((monthBranch - 2 + 12) % 12)) % 10;
/** 五鼠遁：日干定子时的时干，其余顺推。 */
export const hourStem = (dayStem: number, hourBranch: number): number =>
  ((dayStem % 5) * 2 + hourBranch) % 10;

export interface BirthInput {
  /** 本地钟面时间 */
  wall: WallTime;
  /** IANA 时区名或固定偏移，如 "Asia/Tokyo"、"+08:00" */
  tz: string;
  /** 出生地经度（东经为正）。给了就用真太阳时排日柱、时柱。 */
  longitude?: number;
}

/**
 * 出生时刻 → 四柱。
 * 年柱、月柱按绝对时刻和节气比；日柱、时柱按当地标准时（夏令时去掉；给了经度就用真太阳时）；23:00 起算下一天（子初换日）。
 */
export function chartFromBirth(input: BirthInput): Chart {
  const utcMs = wallToUtc(input.wall, input.tz);
  const local = input.longitude === undefined ? utcToStandardWall(utcMs, input.tz) : trueSolarWall(utcMs, input.longitude);
  if (local.year < MIN_YEAR || local.year > MAX_YEAR) {
    throw new RangeError(`birth year must be within ${MIN_YEAR}–${MAX_YEAR}`);
  }
  const { solarYear, monthBranch } = solarMonthAt(Math.floor(utcMs / 1000));
  const yearIdx = (((solarYear - 4) % 60) + 60) % 60; // 1984 = 甲子
  const year = pillarAt(yearIdx);
  const month = { stem: monthStem(year.stem, monthBranch), branch: monthBranch };

  let jdn = julianDayNumber(local.year, local.month, local.day);
  if (local.hour >= 23) jdn += 1; // 子初换日
  const day = pillarAt((jdn + 49) % 60); // 2000-01-01 = 戊午（54）

  const hourBranch = Math.floor((local.hour + 1) / 2) % 12;
  const hour = { stem: hourStem(day.stem, hourBranch), branch: hourBranch };
  return { year, month, day, hour };
}

/** 标签序号（0 … 518,399）→ 四柱。随机种子走这条，不经过日期。 */
export function chartFromLabel(label: number): Chart {
  if (!Number.isInteger(label) || label < 0 || label >= CHART_LABELS) throw new RangeError("chart label out of range");
  let n = label;
  const hourBranch = n % 12; n = Math.floor(n / 12);
  const dayIdx = n % 60; n = Math.floor(n / 60);
  const monthBranch = n % 12; n = Math.floor(n / 12);
  const yearIdx = n;
  const year = pillarAt(yearIdx);
  const day = pillarAt(dayIdx);
  return {
    year,
    month: { stem: monthStem(year.stem, monthBranch), branch: monthBranch },
    day,
    hour: { stem: hourStem(day.stem, hourBranch), branch: hourBranch },
  };
}

/** 四柱 → 标签序号，chartFromLabel 的逆。 */
export function chartLabel(c: Chart): number {
  return ((cycleIndex(c.year) * 12 + c.month.branch) * 60 + cycleIndex(c.day)) * 12 + c.hour.branch;
}

// ── 十神权重 ───────────────────────────────────────────────────────────────

/** 创作用权重（不是测出来的）：透干 1.0；藏干 本气/中气/余气 1.0/0.5/0.3；月支整体 ×2。日主不计。 */
export const WEIGHTS = { visibleStem: 1, hidden: [1, 0.5, 0.3], monthBranchFactor: 2 } as const;

export type GodWeights = Record<TenGod, number>;

const zeroWeights = (): GodWeights => Object.fromEntries(TEN_GODS.map((g) => [g, 0])) as GodWeights;

/** 一柱里各十神的原始权重（未归一化）。dayPillar 为真时跳过天干（日主本身）。 */
function pillarGods(dm: number, p: Pillar, opts: { dayPillar?: boolean; monthPillar?: boolean } = {}): GodWeights {
  const w = zeroWeights();
  if (!opts.dayPillar) w[tenGod(dm, p.stem)] += WEIGHTS.visibleStem;
  const factor = opts.monthPillar ? WEIGHTS.monthBranchFactor : 1;
  HIDDEN_STEMS[p.branch]!.forEach((s, i) => { w[tenGod(dm, s)] += WEIGHTS.hidden[i]! * factor; });
  return w;
}

export type Strength = "strong" | "balanced" | "weak";
export type MaskPosition = "social_face" | "work_mode" | "private_self" | "inner_drive";

export interface ChartReading {
  dayMaster: number;
  /** 十神权重分布，和为 1，四舍五入到 4 位小数 */
  gods: GodWeights;
  /** 权重前三，按权重降序（同分按 TEN_GODS 顺序） */
  top: TenGod[];
  /** 比劫 + 印 的占比 */
  support: number;
  strength: Strength;
  /** 四柱各自的主导十神 → 四面具 */
  masks: Record<MaskPosition, TenGod>;
}

/** 一柱的主导十神：权重最高；同分时天干优先（年、时柱），日柱只看地支。 */
function dominant(w: GodWeights, tieFirst?: TenGod): TenGod {
  let best: TenGod = TEN_GODS[0];
  let bestW = -1;
  for (const g of TEN_GODS) {
    const v = w[g] + (g === tieFirst ? 1e-9 : 0);
    if (v > bestW) { best = g; bestW = v; }
  }
  return best;
}

export function readChart(c: Chart): ChartReading {
  const dm = c.day.stem;
  const parts = {
    year: pillarGods(dm, c.year),
    month: pillarGods(dm, c.month, { monthPillar: true }),
    day: pillarGods(dm, c.day, { dayPillar: true }),
    hour: pillarGods(dm, c.hour),
  };
  const total = zeroWeights();
  for (const p of Object.values(parts)) for (const g of TEN_GODS) total[g] += p[g];
  const sum = TEN_GODS.reduce((a, g) => a + total[g], 0);
  const gods = zeroWeights();
  for (const g of TEN_GODS) gods[g] = Math.round((total[g] / sum) * 10000) / 10000;

  const top = [...TEN_GODS].sort((a, b) => total[b] - total[a] || TEN_GODS.indexOf(a) - TEN_GODS.indexOf(b)).slice(0, 3);
  const support = Math.round(((total.companion + total.rob_wealth + total.direct_resource + total.indirect_resource) / sum) * 10000) / 10000;
  const strength: Strength = support >= 0.45 ? "strong" : support <= 0.3 ? "weak" : "balanced";

  const masks: Record<MaskPosition, TenGod> = {
    social_face: dominant(parts.year, tenGod(dm, c.year.stem)),
    work_mode: dominant(parts.month),
    private_self: dominant(parts.day),
    inner_drive: dominant(parts.hour, tenGod(dm, c.hour.stem)),
  };
  return { dayMaster: dm, gods, top, support, strength, masks };
}
