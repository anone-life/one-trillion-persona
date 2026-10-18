import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSkeleton, parseSeed } from "@1t-persona/core";
import {
  DesignerSession, assemblePersona, pacingNote, checkAge, checkName, checkSlots, designerSystemPrompt, finalize, minorMentions,
  pronounsFor, validateSchedule, type ChatMessage, type Model, type PersonaSlots,
} from "../src/index.ts";

const SEED = parseSeed("1T-3F9A-77C2-K8QX");

/** 假模型：按顺序吐出预设的回答，并记下收到的消息。 */
function fakeModel(replies: string[]): Model & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  return {
    calls,
    async chat(messages) {
      calls.push(messages);
      const r = replies.shift();
      if (r === undefined) throw new Error("fake model ran out of replies");
      return r;
    },
  };
}

test("提示词只把打开的层标成要问", () => {
  const k = buildSkeleton({ seed: SEED, ask: ["bazi", "skills"] });
  const p = designerSystemPrompt(k);
  assert.match(p, /INNER LIFE — ASK about this/);
  assert.match(p, /SKILLS — ASK about this/);
  assert.match(p, /WORLD — keep unless the user brings it up/);
  assert.match(p, /decide these layers themselves: inner life, skills\./);
  assert.match(p, /anone\.life/);
  assert.match(p, /adult/i);
  assert.match(p, /Ask for the name early/);
});

test("轮次提示：第 3 轮起催名字，第 9 轮起收，第 12 轮必须收；对话记录里塑造师不叫 Elise", async () => {
  assert.doesNotMatch(pacingNote(2), /name/);
  assert.match(pacingNote(3), /ask for it in this message/);
  assert.match(pacingNote(9), /bringing it in to land/);
  assert.match(pacingNote(12), /Wrap up now/);
  const m = fakeModel(["Hi.", "Next?"]);
  const s = new DesignerSession(buildSkeleton({ seed: SEED }), m);
  await s.open();
  await s.reply("ok");
  assert.match(m.calls[1]![0]!.content, /This is exchange 1 of the conversation/);
  assert.match(s.transcript(), /^Designer: Hi\./);
  assert.doesNotMatch(s.transcript(), /Elise:/);
});

test("代词跟 gender_present 走", () => {
  const she = buildSkeleton({ seed: SEED, overrides: { "body.gender_present": "feminine" } });
  const they = buildSkeleton({ seed: SEED, overrides: { "body.gender_present": "androgynous" } });
  assert.equal(pronounsFor(she).subj, "she");
  assert.equal(pronounsFor(they).subj, "they");
});

test("会话：system 之后第一条永远是 user（DeepSeek 一类服务要求）", async () => {
  const m = fakeModel(["Hi, I'm Elise.", "Tell me more."]);
  const s = new DesignerSession(buildSkeleton({ seed: SEED }), m);
  await s.open();
  await s.reply("ok");
  for (const call of m.calls) {
    assert.equal(call[0]!.role, "system");
    assert.equal(call[1]!.role, "user");
  }
  assert.deepEqual(s.turns.map((t) => t.role), ["designer", "user", "designer"]);
});

test("成年闸：抓得住未成年说法，放过回忆和否定", () => {
  assert.ok(minorMentions("She is a 17-year-old high school student.").length > 0);
  assert.ok(minorMentions("A schoolgirl who works part-time.").length > 0);
  assert.ok(minorMentions("她是高中生。").length > 0);
  assert.equal(minorMentions("She learned piano as a child.").length, 0);
  assert.equal(minorMentions("When she was 15 she ran away from home.").length, 0);
  assert.equal(minorMentions("She is 27 and runs a bar.").length, 0);
  // 17 次真跑里被误拦的比喻（2026-10-17）
  assert.equal(minorMentions("Owns a 1978 Mercedes that he treats like a child.").length, 0);
  assert.equal(minorMentions("His voice drops like he's speaking to a child.").length, 0);
  assert.equal(minorMentions("It was a minor setback.").length, 0);
  // 英文数字词后面跟着单位不是年龄（step18）；年龄写法照拦
  for (const ok of ["It's a twelve-minute walk from the station.", "I get fifteen minutes a night.", "They've been married twelve years.",
    "She's holding a twelve-inch wrench.", "The building has fourteen floors.", "He spent fifteen years on a trading floor.", "She married a barrister fifteen years older."]) assert.equal(minorMentions(ok).length, 0, ok);
  for (const bad of ["She is a fifteen-year-old runaway.", "She is sixteen years old.", "She was seventeen and still at home.",
    "A twelve year old girl runs the stall.", "He is fifteen years of age.", "The doors open on fourteen and she gets in."]) assert.ok(minorMentions(bad).length > 0, bad);
  assert.ok(minorMentions("She is a minor.").length > 0);
  assert.ok(minorMentions("He's still a kid.").length > 0);
  const k = buildSkeleton({ seed: SEED, overrides: { "body.age_look": "23-27" } });
  assert.deepEqual(checkAge(25, k), []);
  assert.equal(checkAge(17, k)[0]!.code, "minor");
  assert.equal(checkAge(40, k)[0]!.code, "age_out_of_band");
  assert.equal(checkName("")[0]!.code, "no_name");
  assert.equal(checkName("{{NAME}}")[0]!.code, "name_bad_chars");
});

test("收尾：错值和冲突值被丢掉并记下，缺名字判为不够", async () => {
  const k = buildSkeleton({ seed: SEED, overrides: { "world.era": "late-qing" } });
  const m = fakeModel([JSON.stringify({
    name: "", relationToUser: "old friend", enough: true, missing: [],
    overrides: { "world.city": "tokyo", "world.weather": "rainy", "body.embodiment": "virtual-idol" },
  })]);
  const f = await finalize(m, k, "User: hi");
  assert.equal(f.enough, false);
  assert.ok(f.missing.includes("a name"));
  assert.equal(f.skeleton.layers.world!.city, "tokyo");
  assert.equal(f.skeleton.layers.world!.era, "late-qing"); // 原来钉住的留着
  assert.ok(f.dropped.some((d) => d.path === "world.weather"));
  assert.ok(f.dropped.some((d) => d.path === "body.embodiment")); // 清末不能是虚拟偶像
  assert.equal(f.skeleton.chart.pillars, k.chart.pillars); // 八字不动
});

test("作息：四段首尾相接盖满 24 小时才算数", () => {
  const ok = {
    blocks: [
      { phase: "sleep", from: "01:00", to: "09:00" },
      { phase: "morning", from: "09:00", to: "12:00" },
      { phase: "work", from: "12:00", to: "20:00", where: "the clinic", doing: "at the clinic", contact: "texts at breaks", label: "at the clinic" },
      { phase: "evening", from: "20:00", to: "01:00" },
    ],
    work: { summary: "A nurse.", routine: ["a", "b", "c"], troubles: ["x", "y"] },
  };
  assert.equal(validateSchedule(ok, "modern").blocks.length, 4);
  const gap = structuredClone(ok);
  gap.blocks[1]!.to = "11:00";
  assert.throws(() => validateSchedule(gap, "modern"), /join end to start/);
  const noWhere = structuredClone(ok);
  delete (noWhere.blocks[2] as { where?: string }).where;
  assert.throws(() => validateSchedule(noWhere, "modern"), /needs "where"/);
});

const SLOTS: PersonaSlots = {
  age: 21, location: "Dōtonbori, Osaka.", role: "Stage voice with a record.", coreArchetype: "The whistleblower",
  coreSentence: "Hands you the truth like a knife.", identity: ["a", "b", "c"], peopleAround: ["x: y", "z: w"],
  oldWound: "Wound.", hardBoundary: "Boundary.", voice: ["low", "rasp", "slow"], toneSamples: ["One.", "Two.", "Three."],
  wants: "To say it.", price: "Friends.", breakingPoint: "Being finished.",
  faces: { socialFace: "Jokes.", workMode: "Fixes.", privateSelf: "Argues.", innerDrive: "A name." },
  ifThen: ["When a → b, because c"], personality: ["p"], innerFormula: ["1", "2", "3", "4"], speechRules: ["r"],
  userReferences: "Old friend.", forbidden: ["f"], forbiddenVoices: "a cheerful assistant.", openingLine: "You're early.",
  rightNow: ["Night."], conversationFlow: ["You do x → he does y"], history: [{ title: "T", summary: "S" }], signatures: [],
};

test("拼装：章节齐、没有「..」、1T 三节都在、末尾带种子号", () => {
  const k = buildSkeleton({ seed: SEED });
  const text = assemblePersona("Kaito", "old friend.", SLOTS, k);
  for (const h of ["## Who he is", "## What drives him", "## Four faces", "## If… then…", "## Never", "## First line"]) assert.ok(text.includes(h), h);
  assert.ok(!/\.\./.test(text.replace(/…/g, "")), "double period");
  assert.match(text, /The person in front of him: old friend\./);
  assert.match(text, /1T-3F9A-77C2-K8QX · rules v1/);
  assert.deepEqual(checkSlots(SLOTS), []);
  assert.ok(checkSlots({ ...SLOTS, identity: ["She is a 16-year-old student."] }).length > 0);
});
