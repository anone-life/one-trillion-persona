// 界面语言：英、中、日。第一次按浏览器语言选，之后记在 localStorage「1t.lang」。
// 词表在 locales/；层名、取值名这些在 spec/i18n/（经 @1t-persona/core 的 describe / localizedLayers 取）。
import type { Lang } from "@1t-persona/core";
import en from "./locales/en.ts";
import zh from "./locales/zh.ts";
import ja from "./locales/ja.ts";

export type Key = keyof typeof en;
const DICTS: Record<Lang, Record<Key, string>> = { en, zh, ja };

export const LANG_OPTIONS: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" }, { id: "zh", label: "中文" }, { id: "ja", label: "日本語" },
];

/** 给模型看的语言名（写进提示词）。 */
export const LANG_NAME: Record<Lang, string> = { en: "English", zh: "Simplified Chinese", ja: "Japanese" };

function detect(): Lang {
  try {
    const saved = localStorage.getItem("1t.lang");
    if (saved === "en" || saved === "zh" || saved === "ja") return saved;
  } catch { /* 存储不可用就按浏览器语言 */ }
  const nav = (navigator.language || "en").toLowerCase();
  return nav.startsWith("zh") ? "zh" : nav.startsWith("ja") ? "ja" : "en";
}

let current: Lang = detect();
document.documentElement.lang = current === "zh" ? "zh-CN" : current;

export const lang = (): Lang => current;

export function setLang(l: Lang): void {
  current = l;
  document.documentElement.lang = l === "zh" ? "zh-CN" : l;
  try { localStorage.setItem("1t.lang", l); } catch { /* 记不住也能用 */ }
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const s = DICTS[current][key] ?? en[key];
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** 把几项连成一串：英文用逗号，中日用顿号。 */
export const joinList = (items: string[]): string => items.join(current === "en" ? ", " : "、");

/** 大数字：英文 K / million / billion / trillion；中文 万 / 亿 / 万亿；日文 万 / 億 / 兆。超过 10^15 用科学记数。 */
export function fmtCount(n: number): string {
  const sup = (e: number) => `10${String(e).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]).join("")}`;
  const trim = (x: number, d: number) => x.toFixed(d).replace(/\.0+$/, "");
  if (n >= 1e15) { const e = Math.floor(Math.log10(n)); return `${(n / 10 ** e).toFixed(1)} × ${sup(e)}`; }
  if (current === "en") {
    if (n < 1e4) return n.toLocaleString("en-US");
    if (n < 1e6) return (n / 1e3).toFixed(0) + "K";
    if (n < 1e9) return trim(n / 1e6, 1) + " million";
    if (n < 1e12) return trim(n / 1e9, 1) + " billion";
    return trim(n / 1e12, 1) + " trillion";
  }
  const [wan, yi, zhao] = current === "zh" ? ["万", "亿", "万亿"] : ["万", "億", "兆"];
  if (n < 1e4) return n.toLocaleString("en-US");
  if (n < 1e8) return trim(n / 1e4, 1) + wan;
  if (n < 1e12) return trim(n / 1e8, 1) + yi;
  return trim(n / 1e12, 1) + zhao;
}

/** 刻度尺上的四个标记。 */
export function scaleTicks(): [number, string][] {
  if (current === "zh") return [[4, "1万"], [8, "1亿"], [12, "1万亿"], [24, "10²⁴"]];
  if (current === "ja") return [[4, "1万"], [8, "1億"], [12, "1兆"], [24, "10²⁴"]];
  return [[4, "10K"], [8, "100M"], [12, "1 trillion"], [24, "10²⁴"]];
}
