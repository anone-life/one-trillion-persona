// 「anone.life 的人」（第 23 步）：anone.life 上的四位，带立绘动画。
// 第一次打开（填了 anone.life key 时）把 TA 们的人设部分下载下来，存成本地角色——之后就和自己造的人一样：
// 用你自己的模型聊、人设能改（改的是本地这份，不回传），立绘动画走 /v1/1t/animate（只收情绪、脸、开口时刻）。
// 同一个人每种界面语言一份（和奇人一样），已经在本地的不重新下载，免得冲掉用户改过的人设。
import { anoneReady, type AnoneSettings } from "./anone.ts";
import { deleteCharacter, getCharacter, listCharacters, saveCharacter, type SavedCharacter } from "./store.ts";

type Lang = "en" | "zh" | "ja";
export interface AnonePerson { id: string; name: string; tagline: Record<Lang, string>; gender: "female" | "male" | null; faceId: string; poster?: string; langs: Lang[] }
interface AnonePersonDetail { id: string; faceId: string; info: { name: string; age: number; location: string; tagline: string }; persona: string; schedule: Record<string, unknown> }

export const anoneCharacterId = (id: string, lang: Lang) => `anone-${id}-${lang}`;

async function get<T>(s: AnoneSettings, path: string): Promise<T> {
  const res = await fetch(`${s.base}${path}`, { headers: { authorization: `Bearer ${s.key}` } });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(body.message ?? `anone.life said HTTP ${res.status}`);
  return body;
}

let people: Promise<AnonePerson[]> | null = null;
let peopleKey = "";
/** 四位是谁（要 key）。页面里只取一次。 */
export function listAnonePeople(s: AnoneSettings): Promise<AnonePerson[]> {
  if (peopleKey !== s.key) { people = null; peopleKey = s.key; }
  people ??= get<{ characters: AnonePerson[] }>(s, "/v1/1t/characters").then((r) => r.characters).catch((e) => { people = null; throw e; });
  return people;
}

/**
 * 本地还没有的那几位（按这种语言）下载下来；**anone.life 不再列的人从本地删掉**（连聊天，和点「删除」一样——
 * 2026-10-18 第四位颯换成晴，用户：「四个人！删了篠原颯」）。名单拉成功且不为空才删，拉失败或回空一个都不动。
 * 没 key 什么都不做。返回这次新存 + 删掉了几位（不为 0 就重画）。
 */
export async function syncAnonePeople(s: AnoneSettings, lang: Lang): Promise<number> {
  if (!anoneReady(s)) return 0;
  const list = await listAnonePeople(s);
  let added = 0;
  if (list.length) {
    const listed = new Set(list.map((p) => p.id));
    for (const c of listCharacters()) if (c.anoneId && !listed.has(c.anoneId) && deleteCharacter(c.id)) added++;
  }
  for (const p of list) {
    const L = p.langs.includes(lang) ? lang : (p.langs[0] ?? "en");
    const id = anoneCharacterId(p.id, L);
    if (getCharacter(id)) continue;
    const d = await get<AnonePersonDetail>(s, `/v1/1t/characters/${encodeURIComponent(p.id)}?lang=${L}`);
    const c: SavedCharacter = {
      id, anoneId: p.id, avatarId: d.faceId, name: d.info.name, age: d.info.age, location: d.info.location, tagline: d.info.tagline,
      relationToUser: "", persona: d.persona, schedule: d.schedule ?? {}, skeleton: null, createdAt: new Date().toISOString(), chat: [], lang: L,
      ...(p.poster ? { anonePoster: p.poster } : {}),
    };
    if (saveCharacter(c)) added++;
  }
  return added;
}

const done = new Set<string>();
let running: Promise<number> | null = null;
/** 最近一次没拉成的原因（给界面说清楚「为什么这一组是空的」）；拉成了就清掉。 */
export let lastSyncError = "";
/**
 * 每次打开页面、每把 key、每种语言只成功同步一次（网页、手机、桌宠启动时调，角色库每次打开也调）。
 * 没 key、出错都不算数：页面里刚填上 key、或者网好了，下一次调就会真去拉——
 * 第一版把「没 key 时的 0」也记成做过了，用户在设置里填完 key 回到角色库什么都不出来（冒烟发现）。
 */
export function syncAnonePeopleOnce(s: AnoneSettings, lang: Lang): Promise<number> {
  const k = `${s.base}|${s.key}|${lang}`;
  if (!anoneReady(s) || done.has(k)) return Promise.resolve(0);
  running ??= syncAnonePeople(s, lang).then((n) => { done.add(k); lastSyncError = ""; return n; }, (e: Error) => { lastSyncError = e.message || "failed"; return 0; }).finally(() => { running = null; });
  return running;
}
