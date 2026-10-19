// 打包发布时顶替 assets.ts（vite.config.ts）：本机 runs/ 里的东西不打进网站，改从 CDN 取（第 21 步）。
// 要连同本机的一起打包（离线用），设 ONE_T_RARE_ASSETS=1。
// 照片和桌宠抠图从 CDN 取（第 21 步「线上看不到奇人的图」）：开机先取一次 index.json，列在里面的才给地址。
// 取不到（离线、自己部署没有这份）就当没有图——卡片是虚线空框、台上是圆盘，和以前一样。前缀可以用 ONE_T_RARE_BASE 换。
declare const __RARE_BASE__: string;
const runtimeBase = typeof window !== "undefined" ? (window as unknown as { __ONE_T_RARE_BASE__?: string }).__ONE_T_RARE_BASE__ : undefined;
const BASE = (runtimeBase ?? (typeof __RARE_BASE__ === "string" ? __RARE_BASE__ : "")).replace(/\/+$/, "");

interface RareIndex { v: string; photos: string[]; cutouts: string[]; personas?: Record<string, string[]> }
async function loadIndex(): Promise<RareIndex | null> {
  if (!BASE) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3000);
  try {
    const r = await fetch(`${BASE}/index.json`, { signal: ctl.signal, cache: "no-cache" });
    return r.ok ? ((await r.json()) as RareIndex) : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
const index = await loadIndex();
const photos = new Set(index?.photos ?? []), cutouts = new Set(index?.cutouts ?? []);
const url = (name: string) => `${BASE}/${name}?v=${index?.v ?? ""}`;

export const rarePhoto = (id: string): string | null => (photos.has(id) ? url(`${id}.webp`) : null);
export const rareCutout = (id: string): string | null => (cutouts.has(id) ? url(`${id}.cut.webp`) : null);
// 预生成的人设：index 里有这个人这种语言才出「和 TA 聊」；点了才去 CDN 取那一份（线上点奇人不能聊，2026-10-18）
export const hasRarePersona = (id: string, lang: string) => !!index?.personas?.[id]?.includes(lang);
export async function loadRarePersona(id: string, lang: string): Promise<{ persona: string; schedule: Record<string, unknown> }> {
  if (!hasRarePersona(id, lang)) throw new Error(`${id}.${lang}: no persona for this one yet`);
  const get = async (name: string) => { const r = await fetch(url(`persona/${name}`)); if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`); return r.text(); };
  const [persona, schedule] = await Promise.all([get(`${id}.${lang}.persona.txt`), get(`${id}.${lang}.schedule.json`).catch(() => "{}")]);
  return { persona, schedule: JSON.parse(schedule) as Record<string, unknown> };
}
