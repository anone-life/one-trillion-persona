import { test } from "node:test";
import assert from "node:assert/strict";
import { closingLine, isLimited, isSpent, turnsLeft, TURN_LIMIT } from "../src/limit.ts";
import type { SavedCharacter } from "../src/store.ts";

const mk = (extra: Partial<SavedCharacter>, users: number, lastIsHer = true): SavedCharacter => {
  const chat: SavedCharacter["chat"] = [{ role: "assistant", content: "你来了。" }];
  for (let i = 0; i < users; i++) { chat.push({ role: "user", content: `${i}` }); chat.push({ role: "assistant", content: "嗯" }); }
  if (!lastIsHer) chat.pop();
  return { id: "x", name: "由衣", age: 31, location: "", tagline: "", relationToUser: "", persona: "", schedule: {}, skeleton: null, createdAt: "", chat, lang: "zh", ...extra };
};

test("10 回合：只限 anone.life 的人；数他发的句数（开场白不算）；第 10 句回完才算用完", () => {
  assert.equal(TURN_LIMIT, 10);
  const yui = (n: number, her = true) => mk({ anoneId: "24_yui" }, n, her);
  assert.equal(turnsLeft(yui(0)), 10);
  assert.equal(turnsLeft(yui(8)), 2);
  assert.equal(isSpent(yui(9)), false);
  assert.equal(isSpent(yui(10, false)), false, "第 10 句发出去、还没回：不算");
  assert.equal(isSpent(yui(10)), true);
  assert.equal(turnsLeft(yui(12)), 0);
  const rare = mk({ rareId: "01" }, 30);
  assert.equal(isLimited(rare), false);
  assert.equal(isSpent(rare), false);
  assert.equal(turnsLeft(mk({}, 30)), Infinity);
  assert.match(closingLine(yui(10)), /anone\.life/);
  assert.match(closingLine(mk({ anoneId: "99_new", lang: "ja" }, 10)), /anone\.life/, "不认识的人用通用的那句");
});
