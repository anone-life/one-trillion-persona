import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSkeleton, parseSeed } from "@1t-persona/core";
import {
  applyRewrite, assemblePersona, diagnose, editableSections, joinPersona, rewrite, splitPersona,
  type ChatMessage, type Model, type PersonaSlots,
} from "../src/index.ts";

const skeleton = buildSkeleton({ seed: parseSeed("1T-3F9A-77C2-K8QX"), overrides: { "body.gender_present": "feminine", "body.age_look": "23-27" } });
const SLOTS: PersonaSlots = {
  age: 26, location: "Shimokitazawa, Tokyo", role: "Jazz bartender", coreArchetype: "The guarded closer",
  coreSentence: "Warm to the room, a locked door to anyone who leans in.", identity: ["a", "b", "c"], peopleAround: ["x: y", "z: w"],
  oldWound: "Wound.", hardBoundary: "Boundary.", voice: ["low", "dry", "slow"], toneSamples: ["Last call.", "Not tonight.", "Sit."],
  wants: "To be trusted.", price: "Nobody gets close.", breakingPoint: "Being pitied.",
  faces: { socialFace: "Jokes.", workMode: "Fast.", privateSelf: "Argues.", innerDrive: "A name." },
  ifThen: ["When a regular flirts → she deflects with a joke, because closeness costs her.", "When asked to stay late → she says no, because the bar is hers alone after two."],
  personality: ["p1", "p2"], innerFormula: ["1", "2", "3", "4"], speechRules: ["Short sentences.", "No pet names."],
  userReferences: "By name.", forbidden: ["Begging."], forbiddenVoices: "a cheerful assistant", openingLine: "You're late.",
  rightNow: ["Closing time."], conversationFlow: ["You push → she steps back"], history: [{ title: "T", summary: "S" }], signatures: [],
};
const persona = assemblePersona("Mio", "the regular", SLOTS, skeleton);

function fakeModel(replies: string[]): Model & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  return { calls, async chat(m) { calls.push(m); const r = replies.shift(); if (r === undefined) throw new Error("out of replies"); return r; } };
}

const IF_THEN = "If… then… (keep these, even when it would be easier not to)";

test("拆了再拼逐字一致；能改的节只有白名单里那几节", () => {
  assert.equal(joinPersona(splitPersona(persona)), persona);
  const titles = editableSections(persona).map((b) => b.title);
  assert.ok(titles.includes(IF_THEN));
  assert.ok(titles.some((t) => t.startsWith("What drives")));
  for (const banned of ["Who she is", "History", "First line", "In one line"]) assert.ok(!titles.some((t) => t.startsWith(banned)), banned);
});

test("改一节：其余节逐字不变", () => {
  const next = `## ${IF_THEN}\n1. When a regular flirts → she deflects with a joke, because closeness costs her.\n2. When asked to stay late → she says no, because the bar is hers alone after two.\n3. When someone asks her to go home with them → she refuses flatly, because she never mixes the bar with her life.`;
  const r = applyRewrite(persona, { "If… then…": next }, "Added rule 3.");
  assert.deepEqual(r.changed, [IF_THEN]);
  const a = splitPersona(persona).blocks;
  const b = splitPersona(r.persona).blocks;
  assert.equal(a.length, b.length);
  a.forEach((blk, i) => { if (blk.title !== IF_THEN) assert.equal(b[i]!.text, blk.text, blk.title); });
  assert.match(r.persona, /3\. When someone asks her to go home/);
});

test("模型在节尾多写「---」：剥掉，下一节标题不丢（第 3 轮 Wei 的真事）", () => {
  const next = `## ${IF_THEN}\n1. When a regular flirts → she deflects with a joke, because closeness costs her.\n\n---`;
  const r = applyRewrite(persona, { "If… then…": `---\n\n${next}` }, "Trimmed.");
  assert.deepEqual(splitPersona(r.persona).blocks.map((b) => b.title), splitPersona(persona).blocks.map((b) => b.title));
  assert.doesNotMatch(r.diff[0]!.after, /---/);
});

test("拒绝：白名单外的节、改三节、改了标题、空、写成未成年、删掉成年那句", () => {
  const who = splitPersona(persona).blocks.find((b) => b.title.startsWith("Who"))!;
  assert.throws(() => applyRewrite(persona, { [who.title]: who.text + "\n- x" }, "s"), /not one of the sections/);
  const three = { "If… then…": `## ${IF_THEN}\n1. x`, "Voice": "## Voice\n- x", "Never": "## Never\n- x" };
  assert.throws(() => applyRewrite(persona, three, "s"), /change 1–2 sections/);
  assert.throws(() => applyRewrite(persona, { "If… then…": "## Rules now\n1. x" }, "s"), /keep the heading line/);
  assert.throws(() => applyRewrite(persona, { "If… then…": "   " }, "s"), /empty/);
  assert.throws(() => applyRewrite(persona, { "If… then…": `## ${IF_THEN}\n1. She is a 16-year-old student.` }, "s"), /failed the checks/);
  assert.throws(() => applyRewrite(persona, { "Never": "## Never\n- Never begs." }, "s"), /keep this line in Never/);
  assert.throws(() => applyRewrite(persona, { "If… then…": `## ${IF_THEN}\n1. x` }, " "), /summary is empty/);
  // 规则里写进要说的原话 → 打回（会被逐字照念）
  assert.throws(() => applyRewrite(persona, { "If… then…": `## ${IF_THEN}\n1. When asked for papers → he says "Who's after you, and what did you do?" before anything else.` }, "s"), /quoted lines/);
});

test("诊断：两个选项、节名按开头认到唯一一节；Elise 用界面语言", async () => {
  const m = fakeModel([JSON.stringify({
    reply: "她答应得太快了。", options: [
      { label: "让答应有代价", plan: "Make agreeing cost her something in What drives.", sections: ["What drives"] },
      { label: "这种情况就该拒绝", plan: "Add a refusal rule.", sections: ["If… then…"] },
    ],
  })]);
  const d = await diagnose(m, { name: "Mio", persona, chat: [{ role: "user", content: "Come home with me?" }, { role: "assistant", content: "[happy] Of course!" }], complaint: "太好说话了", uiLanguage: "Simplified Chinese" });
  assert.equal(d.options.length, 2);
  assert.ok(d.options[0]!.sections[0]!.startsWith("What drives"));
  assert.equal(d.options[1]!.sections[0], IF_THEN);
  const sys = m.calls[0]![0]!.content;
  assert.match(sys, /in Simplified Chinese/);
  assert.match(m.calls[0]![1]!.content, /Mio: Of course!  ← the reply the user flagged/); // 情绪标签剥掉了
});

test("改写：模型第一次改了不该改的节，被打回后改对", async () => {
  const bad = JSON.stringify({ sections: { "History": "## History\n1. x" }, summary: "s" });
  const good = JSON.stringify({ sections: { "If… then…": `## ${IF_THEN}\n1. When someone asks her home → she says no, because the bar is not her life.` }, summary: "加了一条拒绝的规则。" });
  const m = fakeModel([bad, good]);
  const r = await rewrite(m, { name: "Mio", persona, chat: [{ role: "assistant", content: "Sure!" }], complaint: "too easy", uiLanguage: "English" }, { plan: "Add a refusal rule.", sections: [IF_THEN] });
  assert.deepEqual(r.changed, [IF_THEN]);
  assert.equal(r.summary, "加了一条拒绝的规则。");
  assert.equal(m.calls.length, 2); // 第二次请求接在同一段对话后面，带着打回的原因
  assert.match(m.calls[1]!.at(-1)!.content, /not one of the sections you may change/);
});
