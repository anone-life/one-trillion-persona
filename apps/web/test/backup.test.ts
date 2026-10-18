import { test } from "node:test";
import assert from "node:assert/strict";
import { BACKUP_FORMAT, makeBackup, mergeBackup, parseBackup } from "../src/backup.ts";
import type { SavedCharacter } from "../src/store.ts";

const mk = (id: string, chat: number): SavedCharacter => ({
  id, name: id, age: 30, location: "", tagline: "", relationToUser: "", persona: `# ${id}`, schedule: {}, skeleton: null,
  createdAt: "2026-10-18T00:00:00.000Z", chat: Array.from({ length: chat }, (_, i) => ({ role: i % 2 ? "user" as const : "assistant" as const, content: `${i}` })),
});

test("备份：只有角色和聊天，读回来一样；不是备份的文件给人看得懂的错", () => {
  const b = makeBackup([mk("a", 2)], new Date("2026-10-18T01:02:03Z"));
  assert.equal(b.format, BACKUP_FORMAT);
  assert.deepEqual(Object.keys(b).sort(), ["characters", "exportedAt", "format", "version"]);
  assert.deepEqual(parseBackup(JSON.stringify(b)), b);
  assert.throws(() => parseBackup("not json"), /not a 1T Persona backup/);
  assert.throws(() => parseBackup(JSON.stringify({ format: "other", version: 1, characters: [] })), /not a 1T Persona backup/);
  assert.throws(() => parseBackup(JSON.stringify({ ...b, characters: [{ id: "x" }] })), /without id, name, persona or chat/);
});

test("合并：新的加进来；同一个人聊天多的那份赢，一样长用导入的", () => {
  const here = [mk("a", 5), mk("b", 2)];
  const incoming = [mk("a", 3), { ...mk("b", 2), name: "B2" }, mk("c", 1)];
  const r = mergeBackup(here, incoming);
  assert.equal(r.added, 1);
  assert.equal(r.updated, 1);
  const byId = new Map(r.characters.map((c) => [c.id, c]));
  assert.equal(byId.get("a")!.chat.length, 5, "这边聊得多，不被冲掉");
  assert.equal(byId.get("b")!.name, "B2", "一样长用导入的");
  assert.ok(byId.has("c"));
});
