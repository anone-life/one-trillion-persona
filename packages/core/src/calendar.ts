// 历法：时区换算、儒略日、节气查表、真太阳时。规则见 spec/bazi-rules.v1.md §1。
import solarTerms from "../../../spec/data/solar-terms.v1.json" with { type: "json" };

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

const TERMS = solarTerms.terms as Record<string, number[]>;

/** 本地钟面时间（年月日时分秒，不带时区）。 */
export interface WallTime {
  year: number; month: number; day: number; hour: number; minute: number; second?: number;
}

const FIXED_OFFSET = /^([+-])(\d{2}):?(\d{2})$/;

/** tz 在 utcMs 这一刻比 UTC 快多少分钟。tz 可以是 IANA 名（Asia/Tokyo）或固定偏移（+08:00）。 */
export function offsetMinutes(tz: string, utcMs: number): number {
  const m = FIXED_OFFSET.exec(tz);
  if (m) return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/** 本地钟面时间 → UTC 毫秒。夏令时切换那一小时里的歧义按第一次出现算。 */
export function wallToUtc(w: WallTime, tz: string): number {
  const naive = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second ?? 0);
  let guess = naive - offsetMinutes(tz, naive) * 60000;
  guess = naive - offsetMinutes(tz, guess) * 60000;
  return guess;
}

/** 公历日期的儒略日数（整数，正午为界）。 */
export function julianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/** 均时差（分钟），NOAA 近似式，误差约 ±1 分钟。 */
export function equationOfTimeMinutes(utcMs: number): number {
  const start = Date.UTC(new Date(utcMs).getUTCFullYear(), 0, 1);
  const n = Math.floor((utcMs - start) / 86400000) + 1;
  const b = (2 * Math.PI * (n - 81)) / 365;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/** 真太阳时的钟面时间：UTC + 经度/15 小时 + 均时差。 */
export function trueSolarWall(utcMs: number, longitude: number): WallTime {
  const ms = utcMs + (longitude / 15) * 3600000 + equationOfTimeMinutes(utcMs) * 60000;
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
  };
}

/** 该时区在 utcMs 所在年份的标准时偏移（去掉夏令时）：取 1 月 1 日和 7 月 1 日两个偏移里小的那个。 */
export function standardOffsetMinutes(tz: string, utcMs: number): number {
  const y = new Date(utcMs).getUTCFullYear();
  return Math.min(offsetMinutes(tz, Date.UTC(y, 0, 1)), offsetMinutes(tz, Date.UTC(y, 6, 1)));
}

/** UTC 毫秒 → 该时区的**标准时**钟面时间（夏令时一律去掉，排日柱、时柱用）。 */
export function utcToStandardWall(utcMs: number, tz: string): WallTime {
  const d = new Date(utcMs + standardOffsetMinutes(tz, utcMs) * 60000);
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
  };
}

/** 十二「节」在 order 里的下标：小寒 0、立春 2、惊蛰 4 …… 大雪 22。 */
const JIE = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

/**
 * 某一刻（UTC 秒）所在的节令：返回「立春所在的年份」和「月支」。
 * 年以立春为界，月以节为界，都按精确时刻比较。
 */
export function solarMonthAt(utcSec: number): { solarYear: number; monthBranch: number } {
  const y = new Date(utcSec * 1000).getUTCFullYear();
  let best: { t: number; year: number; k: number } | null = null;
  for (const yy of [y - 1, y, y + 1]) {
    const row = TERMS[String(yy)];
    if (!row) continue;
    for (const k of JIE) {
      const t = row[k]!;
      if (t <= utcSec && (!best || t > best.t)) best = { t, year: yy, k };
    }
  }
  if (!best) throw new RangeError("moment outside the solar-term table (1899–2101)");
  const monthBranch = (best.k / 2 + 1) % 12; // 小寒→丑(1)，立春→寅(2)…… 大雪→子(0)
  // 小寒那一个月还属于上一个立春年
  const solarYear = best.k === 0 ? best.year - 1 : best.year;
  return { solarYear, monthBranch };
}
