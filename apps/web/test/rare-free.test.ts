// 一期一会免费试聊（第 28 步）：照 /quota 回的数，判这一轮能不能聊、怎么付、卡住时给哪几个按钮。
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RareQuota } from "../src/rare-free.ts";
import type { SavedCharacter } from "../src/store.ts";

// i18n 一加载就写 <html lang>：给它一个假的 document（这里只测判断，不画界面）
(globalThis as { document?: unknown }).document ??= { documentElement: {} };
const { rareCard, rareStatus } = await import("../src/rare-free.ts");

const c = (extra: Partial<SavedCharacter> = {}): SavedCharacter => ({ id: "x", name: "她", age: 30, location: "", tagline: "", relationToUser: "", persona: "", schedule: {}, skeleton: null, createdAt: "", chat: [], lang: "zh", rareId: "01", ...extra });
const limits = { trialTurns: 3, memberPeople: 2, memberDailyTurns: 20, ipDailyCap: 60, pointsPerTurn: 1, stampsPerTurn: 5 };
const q = (extra: Partial<RareQuota>): RareQuota => ({ signedIn: false, trialLeft: 0, ipLeft: 60, member: null, balance: null, limits, ...extra });
const member = (m: Partial<NonNullable<RareQuota["member"]>>) => ({ people: [], mine: false, canPick: true, leftToday: 0, ...m });
const noop = { refresh() {}, pick() {}, stamps() {}, ownApi() {}, open() {} };
const anone = { base: "https://www.anone.life", key: "" };

test("试聊：还有就聊；用完没登录 → trial_over；IP 封顶 → ip_daily_limit；还没问到额度先让服务器定", () => {
  assert.deepEqual(rareStatus(c(), null, false), { ok: true, pay: "default", hint: "" });
  const ok = rareStatus(c(), q({ trialLeft: 2 }), false);
  assert.equal(ok.ok, true);
  assert.equal(rareStatus(c(), q({ trialLeft: 2, ipLeft: 0 }), false).ok ? "" : (rareStatus(c(), q({ trialLeft: 2, ipLeft: 0 }), false) as { code: string }).code, "ip_daily_limit");
  assert.deepEqual(rareStatus(c(), q({}), false), { ok: false, code: "trial_over" });
});

test("会员：我的人按每天剩几轮；不是我的、能挑 → choose，点了挑就 pick；开了邮票且够 → stamps，不够 → insufficient_stamps", () => {
  assert.equal((rareStatus(c(), q({ signedIn: true, member: member({ mine: true, leftToday: 5 }) }), false) as { pay: string }).pay, "default");
  assert.deepEqual(rareStatus(c(), q({ signedIn: true, member: member({ mine: true, leftToday: 0 }) }), false), { ok: false, code: "member_daily_limit" });
  assert.deepEqual(rareStatus(c(), q({ signedIn: true, member: member({}) }), false), { ok: false, code: "choose" });
  assert.equal((rareStatus(c(), q({ signedIn: true, member: member({}) }), true) as { pay: string }).pay, "pick");
  assert.equal((rareStatus(c({ prefs: { stamps: true } }), q({ signedIn: true, balance: 3, member: member({ canPick: false }) }), false) as { pay: string }).pay, "stamps");
  assert.deepEqual(rareStatus(c({ prefs: { stamps: true } }), q({ signedIn: true, balance: 0, member: member({ canPick: false }) }), false), { ok: false, code: "insufficient_stamps" });
});

test("卡片：没登录给注册 + 我注册好了 + 自己的 API；能挑给「设为我的一位」；2 位满了给邮票（5 张一轮）", () => {
  const over = rareCard("trial_over", c(), q({}), anone, noop);
  assert.equal(over.choices.length, 3);
  assert.equal(over.choices[0]!.primary, true);
  const pick = rareCard("choose", c(), q({ signedIn: true, balance: 2, member: member({}) }), anone, noop);
  assert.equal(pick.choices.length, 3, "挑 / 邮票 / 自己的 API");
  const full = rareCard("choose", c(), q({ signedIn: true, balance: 2, member: member({ canPick: false, people: ["02", "03"] }) }), anone, noop);
  assert.equal(full.choices.length, 2, "邮票 / 自己的 API（不能换人）");
  assert.match(full.choices[0]!.label, /10/, "余额 2 分显示 10 张");
  assert.match(full.choices[0]!.label, /5/);
});
