// 打包发布时顶替 assets.ts（vite.config.ts）：本机的预生成人设不打进网站（奇人页只能看、不出「和 TA 聊」）；
// 要连同人设一起打包，设 ONE_T_RARE_ASSETS=1。第 20 步。
// 照片和桌宠抠图从 CDN 取（第 21 步「线上看不到奇人的图」）：开机先取一次 index.json，列在里面的才给地址。
// 取不到（离线、自己部署没有这份）就当没有图——卡片是虚线空框、台上是圆盘，和以前一样。前缀可以用 ONE_T_RARE_BASE 换。
declare const __RARE_BASE__: string;
const BASE = (typeof __RARE_BASE__ === "string" ? __RARE_BASE__ : "").replace(/\/+$/, "");

interface RareIndex { v: string; photos: string[]; cutouts: string[] }
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
export const hasRarePersona = (_id: string, _lang: string) => false;
export async function loadRarePersona(id: string, lang: string): Promise<{ persona: string; schedule: Record<string, unknown> }> {
  throw new Error(`${id}.${lang}: not included in this build`);
}
