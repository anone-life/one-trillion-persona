/// <reference types="vite/client" />
// 奇人的本机资产：预生成的人设（tools/rare_pregen.ts → runs/rare-pregen/）、聊天背景照片（tools/rare_images.ts → runs/rare-img/）
// 和桌宠用的透明抠图（tools/rare_cutout.py → runs/rare-img/<id>.cut.webp，第 21 步）。
// runs/ 不进 git：克隆仓库的人没有这两样，glob 是空的，页面上就不出「和 TA 聊」、台上不放照片。第 20 步。
const PERSONA = import.meta.glob("../../../../runs/rare-pregen/*.persona.txt", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const SCHEDULE = import.meta.glob("../../../../runs/rare-pregen/*.schedule.json", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const PHOTO = import.meta.glob(["../../../../runs/rare-img/*.webp", "!../../../../runs/rare-img/*.cut.webp"], { query: "?url", import: "default", eager: true }) as Record<string, string>;
const CUTOUT = import.meta.glob("../../../../runs/rare-img/*.cut.webp", { query: "?url", import: "default", eager: true }) as Record<string, string>;
// 人工验收的照片立牌选择优先于旧 cut 文件；没有本机报告时保持原来的选择方式。
const REPORT = import.meta.glob("../../../../runs/rare-img/cutout.json", { import: "default", eager: true }) as Record<string, Record<string, { display?: string }>>;
const photoOnly = new Set(Object.values(REPORT).flatMap(report => Object.entries(report).filter(([, entry]) => entry.display === "photo").map(([id]) => id)));

const byName = <T>(files: Record<string, T>) => new Map(Object.entries(files).map(([k, v]) => [k.slice(k.lastIndexOf("/") + 1), v]));
const personas = byName(PERSONA), schedules = byName(SCHEDULE), photos = byName(PHOTO), cutouts = byName(CUTOUT);

export const rarePhoto = (id: string): string | null => photos.get(`${id}.webp`) ?? null;
/** 桌宠用的透明抠图；抠得不好（深色衣服融进夜景）的没有这张，桌宠改放照片立牌。 */
export const rareCutout = (id: string): string | null => photoOnly.has(id) ? null : cutouts.get(`${id}.cut.webp`) ?? null;
export const hasRarePersona = (id: string, lang: string) => personas.has(`${id}.${lang}.persona.txt`);
export async function loadRarePersona(id: string, lang: string): Promise<{ persona: string; schedule: Record<string, unknown> }> {
  const p = personas.get(`${id}.${lang}.persona.txt`);
  if (!p) throw new Error(`${id}.${lang}: not pre-generated — run tools/rare_pregen.ts`);
  const s = schedules.get(`${id}.${lang}.schedule.json`);
  return { persona: await p(), schedule: s ? (JSON.parse(await s()) as Record<string, unknown>) : {} };
}
