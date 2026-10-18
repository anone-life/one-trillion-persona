// 导入一个文件：`.anone`（单个角色）或「导出全部」得到的备份（backup.ts）。角色库页和桌宠共用（第 21 步）。
import { readAnone } from "@1t-persona/files";
import { mergeBackup, parseBackup } from "./backup.ts";
import { listCharacters, saveCharacter, writeCharacters } from "./store.ts";

export interface Imported { added: number; updated: number; /** 导进来的角色 id（桌宠导完切到第一个） */ ids: string[] }

export async function importFile(file: File): Promise<Imported> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // .anone 是 zip（PK 开头）；备份是 JSON
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const a = await readAnone(bytes);
    const tagline = /^# .+? · (.+)$/m.exec(a.persona)?.[1] ?? String(a.info.tagline_en ?? "");
    const id = crypto.randomUUID();
    saveCharacter({
      id, name: String(a.info.name), age: Number(a.info.age), location: String(a.info.location ?? ""), tagline,
      relationToUser: /^- The person in front of \w+: (.+?)\.?$/m.exec(a.persona)?.[1] ?? "", persona: a.persona,
      schedule: a.schedule ?? {}, skeleton: a.skeleton ?? null, createdAt: a.manifest.createdAt, chat: [],
      ...(typeof a.info.avatarId === "string" ? { avatarId: a.info.avatarId } : {}),
    });
    return { added: 1, updated: 0, ids: [id] };
  }
  const b = parseBackup(new TextDecoder().decode(bytes));
  const m = mergeBackup(listCharacters(), b.characters);
  if (!writeCharacters(m.characters)) throw new Error("couldn't save (storage full?)");
  return { added: m.added, updated: m.updated, ids: b.characters.map((c) => c.id) };
}
