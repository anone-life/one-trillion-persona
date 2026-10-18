// 打包发布时顶替 assets.ts（vite.config.ts）：不把本机的预生成人设和照片打进网站，奇人页就只能看、不出「和 TA 聊」。
// 要连同它们一起打包，设 ONE_T_RARE_ASSETS=1。第 20 步。
export const rarePhoto = (_id: string): string | null => null;
export const rareCutout = (_id: string): string | null => null;
export const hasRarePersona = (_id: string, _lang: string) => false;
export async function loadRarePersona(id: string, lang: string): Promise<{ persona: string; schedule: Record<string, unknown> }> {
  throw new Error(`${id}.${lang}: not included in this build`);
}
