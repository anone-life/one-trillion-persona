// 「导出全部 / 导入」：把角色和聊天从一个地方搬到另一个地方（浏览器 → 桌宠，或换一台电脑）。第 21 步。
// 桌宠里的存储和浏览器的是两份，第一次打开桌宠是空的，靠这个文件搬过去。
// **文件里不放任何 key**（模型、TTS、anone.life）——key 不跨应用搬，到了那边重新填。
import type { SavedCharacter } from "./store.ts";

export const BACKUP_FORMAT = "1t-persona-backup";

export interface Backup { format: typeof BACKUP_FORMAT; version: 1; exportedAt: string; characters: SavedCharacter[] }

export function makeBackup(characters: SavedCharacter[], now = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), characters };
}

/** 读一个备份文件。格式不对就抛，抛出的话是给人看的。 */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("not a 1T Persona backup (not JSON)"); }
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || b.version !== 1 || !Array.isArray(b.characters)) throw new Error("not a 1T Persona backup");
  for (const c of b.characters) {
    if (!c || typeof c.id !== "string" || typeof c.name !== "string" || typeof c.persona !== "string" || !Array.isArray(c.chat)) {
      throw new Error("backup has a character without id, name, persona or chat");
    }
  }
  return b as Backup;
}

/**
 * 合并：同一个 id 的，聊天更长的那份赢（搬过来的通常是更新的那份，但两边都聊过时别把多的那边冲掉）；
 * 一样长就用导入的。返回合并后的列表和这次新增 / 更新了几个。
 */
export function mergeBackup(existing: SavedCharacter[], incoming: SavedCharacter[]): { characters: SavedCharacter[]; added: number; updated: number } {
  const byId = new Map(existing.map((c) => [c.id, c]));
  let added = 0, updated = 0;
  for (const c of incoming) {
    const old = byId.get(c.id);
    if (!old) { byId.set(c.id, c); added++; continue; }
    if (c.chat.length >= old.chat.length) { byId.set(c.id, c); updated++; }
  }
  return { characters: [...byId.values()], added, updated };
}
