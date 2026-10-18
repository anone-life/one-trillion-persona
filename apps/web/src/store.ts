// 浏览器本地存储。读写都包 try/catch：隐私模式、清了站点数据、配额满了都会抛，页面照样能用，只是存不住。
import type { Skeleton } from "@1t-persona/core";
import type { Schedule, Turn } from "@1t-persona/designer/browser";

export interface SavedCharacter {
  id: string;
  name: string;
  age: number;
  location: string;
  tagline: string;
  relationToUser: string;
  persona: string;
  schedule: Schedule | Record<string, unknown>;
  skeleton: Skeleton | null;
  createdAt: string;
  /** 选的 anone.life 脸（套名，来自 /v1/1t/faces）。没选就是纯文字。 */
  avatarId?: string;
  /** 人设和聊天用的语言；旧角色没有这一项，按英文算 */
  lang?: "en" | "zh" | "ja";
  /** 「告诉 Elise」改之前的那一版人设（撤销用，只留一份） */
  previousPersona?: string;
  /** 「告诉 Elise」改过几次、每次改了什么 */
  retunes?: { at: string; complaint: string; changed: string[]; summary: string }[];
  /** 「anone.life 的人」那四位：anone.life 上的角色 id（第 23 步，第一次启动时下载的；人设能改，改的是本地这份） */
  anoneId?: string;
  /** 那四位的海报图（anone.life CDN 上的，角色库卡片用） */
  anonePoster?: string;
  /** 从「奇人」页开聊的：奇人编号（台上放 TA 的照片，不挑 anone.life 的脸）。第 20 步 */
  rareId?: string;
  /** 聊天页的开关（第 22 步）：动作描写、播音、情境卡展开。每个角色各记各的。 */
  prefs?: { actions?: boolean; voice?: boolean; ctxOpen?: boolean; voiceId?: string };
  /** 和她的打字聊天记录 */
  chat: { role: "user" | "assistant"; content: string }[];
}

const KEY = "1t.characters.v1";
const DRAFT = "1t.draft.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const listCharacters = (): SavedCharacter[] => read<SavedCharacter[]>(KEY, []);
export const getCharacter = (id: string) => listCharacters().find((c) => c.id === id) ?? null;
export function saveCharacter(c: SavedCharacter): boolean {
  const all = listCharacters().filter((x) => x.id !== c.id);
  return write(KEY, [c, ...all]);
}
export function deleteCharacter(id: string): boolean {
  try { localStorage.removeItem(`1t.photo.${id}`); } catch { /* 自建角色的照片（photo.ts），没有也无害 */ }
  return write(KEY, listCharacters().filter((x) => x.id !== id));
}

/** 进行中的塑造（刷新不丢）：骨架 + 对话。 */
export interface Draft { skeleton: Skeleton; turns: Turn[] }
export const loadDraft = () => read<Draft | null>(DRAFT, null);
export const saveDraft = (d: Draft | null) => (d ? write(DRAFT, d) : (() => { try { localStorage.removeItem(DRAFT); } catch { /* 存不了就算了 */ } return true; })());

/** 整个角色库一次写回（导入备份时用，backup.ts 的 mergeBackup 算好合并结果）。 */
export const writeCharacters = (all: SavedCharacter[]): boolean => write(KEY, all);
