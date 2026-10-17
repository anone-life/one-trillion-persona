// 从聊天回去找塑造师（「告诉 Elise」）：玩家在某条回复上说「不对」，Elise 诊断、给两个改法，
// 选一个后只改人设里相关的一两节，其余逐字不动。设计见根文档仓库 docs/1T-persona/steps/step10_retune_from_chat.md。
//
// 人设没有存生成时的格子，只有拼好的 persona.txt；它是固定模板拼的（persona.ts 的 assemblePersona），
// 节与节之间是 SEP，每节第一行是「## 标题」，所以按节拆开、只换其中一两节是可行的。
import { checkPersonaText } from "@1t-persona/core";
import { DESIGNER_NAME } from "./designer.ts";
import { askJson, type Model } from "./model.ts";

export const SEP = "\n\n---\n\n";

/** 能改的节（按标题开头认）。名字、年龄、身份、往事、开场白不许改：改了会和对话、骨架、导出的卡对不上。 */
export const EDITABLE: RegExp[] = [
  /^What drives\b/, /^Four faces\b/, /^If… then…/, /^Voice\b/, /^Personality\b/,
  /^Rules of speech\b/, /^How a conversation moves\b/, /^Never\b/,
];
export const MAX_SECTIONS = 2;

export interface Block { title: string; text: string }

/** 按节拆。title 是「## 」后面那一行；没有标题的块（文件头、末尾注释）title 为空。 */
export function splitPersona(persona: string): { blocks: Block[]; trailingNewline: boolean } {
  const trailingNewline = persona.endsWith("\n");
  const body = trailingNewline ? persona.slice(0, -1) : persona;
  const blocks = body.split(SEP).map((text) => ({ title: /^## (.+)$/m.exec(text.split("\n")[0] ?? "")?.[1]?.trim() ?? "", text }));
  return { blocks, trailingNewline };
}

export function joinPersona(p: { blocks: Block[]; trailingNewline: boolean }): string {
  return p.blocks.map((b) => b.text).join(SEP) + (p.trailingNewline ? "\n" : "");
}

export const isEditable = (title: string): boolean => EDITABLE.some((re) => re.test(title));

/** 人设里能改的那几节（给模型看）。 */
export function editableSections(persona: string): Block[] {
  return splitPersona(persona).blocks.filter((b) => b.title && isEditable(b.title));
}

export interface ChatLine { role: "user" | "assistant"; content: string }

export interface RetuneInput {
  name: string;
  persona: string;
  /** 聊天记录，到被点的那条回复为止（含） */
  chat: ChatLine[];
  /** 玩家说哪里不对 */
  complaint: string;
  /** Elise 用哪种语言跟玩家说话 */
  uiLanguage: string;
}

export interface RetuneOption { label: string; plan: string; sections: string[] }
export interface Diagnosis { reply: string; options: RetuneOption[] }

const stripTag = (s: string) => s.replace(/^\s*\[[a-z]+\]\s*/i, "");

function excerpt(input: RetuneInput): string {
  return input.chat.slice(-8).map((m, i, all) => {
    const who = m.role === "assistant" ? input.name : "User";
    const mark = i === all.length - 1 ? "  ← the reply the user flagged" : "";
    return `${who}: ${stripTag(m.content)}${mark}`;
  }).join("\n");
}

function sectionsText(persona: string): string {
  return editableSections(persona).map((b) => b.text).join(SEP);
}

/** 标题匹配：模型可能只写开头几个词，按「开头相同」认到唯一一节。 */
function resolveTitle(persona: string, raw: string): string {
  const want = raw.replace(/^#+\s*/, "").trim().toLowerCase();
  const hits = editableSections(persona).filter((b) => b.title.toLowerCase() === want || b.title.toLowerCase().startsWith(want) || want.startsWith(b.title.toLowerCase().slice(0, 12)));
  if (hits.length !== 1) throw new Error(`"${raw}" is not one of the sections you may change: ${editableSections(persona).map((b) => b.title).join(" | ")}`);
  return hits[0]!.title;
}

/** 第一步：Elise 读这段对话和人设，说她觉得问题在哪，给两个改法。 */
export async function diagnose(model: Model, input: RetuneInput): Promise<Diagnosis> {
  const system = [
    `You are ${DESIGNER_NAME}, the character designer. The user made ${input.name} with you and is now test-driving them in a chat. They flagged one of ${input.name}'s replies as wrong.`,
    "Your job: find which part of the persona produced that reply, and offer two different ways to fix it. You change the persona, not the conversation.",
    "",
    "Output one JSON object and nothing else:",
    '{"reply": "...", "options": [{"label": "...", "plan": "...", "sections": ["..."]}, {"label": "...", "plan": "...", "sections": ["..."]}]}',
    "",
    `- reply: one or two short sentences in ${input.uiLanguage}, in your voice (unhurried, warm but dry): what you think went wrong, in plain words. No apology, no jargon.`,
    `- options: exactly two genuinely different fixes. label: under 14 words in ${input.uiLanguage}, something the user can pick at a glance. plan: in English, precise instructions for the rewrite — what to change, what to keep, and why.`,
    `- sections: the 1–${MAX_SECTIONS} section titles each fix would change, copied from the "## " lines below.`,
    "- Prefer the smallest change that would have prevented the flagged reply. Often that is one rule in If… then…, or the price in What drives.",
    "- If the user's complaint is about how they talk in general (too long, too polished, too formal, swearing, too much dialect), BOTH options must change Voice and Rules of speech together.",
    // 第 3 轮 Mara「对我暖一点」：记账是她的核心动机，写在八九处锁住的节里，改两节压不住（docs/1T-persona/steps/step10_retune_from_chat.md）
    "- If what the user asks for goes against the character's core motive (What drives them, repeated across many sections), say so plainly in reply: you can soften how it shows, but it stays who they are.",
    "- The character stays an adult. Keep it non-explicit.",
    "",
    "Sections you may change:",
    sectionsText(input.persona),
  ].join("\n");
  const user = [`The conversation:`, excerpt(input), "", `What the user says is wrong: ${input.complaint}`].join("\n");
  return askJson(model, system, user, (v) => {
    const o = v as Partial<Diagnosis>;
    if (typeof o.reply !== "string" || !o.reply.trim()) throw new Error("reply must be a non-empty string");
    if (!Array.isArray(o.options) || o.options.length !== 2) throw new Error("options must have exactly two entries");
    const options = o.options.map((opt, i) => {
      if (!opt || typeof opt.label !== "string" || typeof opt.plan !== "string" || !Array.isArray(opt.sections)) throw new Error(`option ${i + 1} needs label, plan and sections`);
      if (opt.sections.length < 1 || opt.sections.length > MAX_SECTIONS) throw new Error(`option ${i + 1} must change 1–${MAX_SECTIONS} sections`);
      return { label: opt.label.trim(), plan: opt.plan.trim(), sections: [...new Set(opt.sections.map((s) => resolveTitle(input.persona, String(s))))] };
    });
    return { reply: o.reply.trim(), options };
  }, 3);
}

export interface Rewrite {
  /** 改后的整份人设 */
  persona: string;
  /** 改了哪几节（标题） */
  changed: string[];
  /** 给玩家看的一句话：改了什么 */
  summary: string;
  /** 每节改前改后 */
  diff: { title: string; before: string; after: string }[];
}

/** 引号里四个词以上的句子数（直引号、弯引号、中日文引号都算）。 */
export function quotedLines(text: string): number {
  return (text.match(/["“「『]([^"”」』\n]{0,200})["”」』]/g) ?? []).filter((q) => q.split(/\s+/).length >= 4 || /[\u3040-\u9fff]{6,}/.test(q)).length;
}

/** 把改写结果合进人设，并做所有检查。纯函数，测试直接调。 */
export function applyRewrite(persona: string, changes: Record<string, string>, summary: string): Rewrite {
  const parsed = splitPersona(persona);
  const entries = Object.entries(changes);
  if (entries.length < 1 || entries.length > MAX_SECTIONS) throw new Error(`change 1–${MAX_SECTIONS} sections, not ${entries.length}`);
  const diff: Rewrite["diff"] = [];
  for (const [rawTitle, rawText] of entries) {
    const title = resolveTitle(persona, rawTitle);
    const block = parsed.blocks.find((b) => b.title === title)!;
    // 模型常在节首尾多写一条「---」分隔线；不剥掉的话拼回去下一节会丢标题（2026-10-17 第 3 轮 Wei）
    const text = String(rawText ?? "").trim().replace(/\n{2,}---\n{2,}/g, "\n\n")
      .replace(/^(?:-{3,}[ \t]*\n+)+/, "").replace(/(?:\n+[ \t]*-{3,}[ \t]*)+$/, "").trim();
    if (!text) throw new Error(`the new "${title}" is empty`);
    const firstLine = text.split("\n")[0]!.trim();
    if (firstLine !== `## ${title}`) throw new Error(`keep the heading line exactly "## ${title}" (got "${firstLine}")`);
    if (text.length > Math.max(block.text.length * 2, block.text.length + 1200)) throw new Error(`the new "${title}" is much longer than the old one; keep it about the same size`);
    if (/^Never\b/.test(title)) {
      const fixed = block.text.split("\n").find((l) => /^- Never a minor;/.test(l));
      if (fixed && !text.includes(fixed)) throw new Error(`keep this line in Never exactly as it is: ${fixed}`);
    }
    // 规则里写进引号的整句台词会被逐字照念（2026-10-17 验收：Marcus 三次回复一字不差）。Voice 一节本来就放语感示例，不管。
    if (!/^Voice\b/.test(title) && quotedLines(text) > quotedLines(block.text)) {
      throw new Error(`"${title}" now contains quoted lines to say; describe what they do and why instead of writing their words`);
    }
    const problems = checkPersonaText(text.replace(/^- Never a minor;.*$/gm, ""));
    if (problems.length) throw new Error(`the new "${title}" failed the checks: ${problems.map((p) => p.detail).join("; ")}`);
    diff.push({ title, before: block.text, after: text });
    block.text = text;
  }
  if (!summary.trim()) throw new Error("summary is empty");
  const out = joinPersona(parsed);
  const titlesBefore = splitPersona(persona).blocks.map((b) => b.title).join("|");
  if (splitPersona(out).blocks.map((b) => b.title).join("|") !== titlesBefore) throw new Error("the new text broke the section layout; don't write --- separator lines inside a section");
  return { persona: out, changed: diff.map((d) => d.title), summary: summary.trim(), diff };
}

/** 第二步：按玩家挑的改法（或自己写的话）改写那一两节。 */
export async function rewrite(model: Model, input: RetuneInput, choice: { plan: string; sections?: string[] }): Promise<Rewrite> {
  const system = [
    `You are ${DESIGNER_NAME}, the character designer, editing ${input.name}'s persona after the user flagged a reply.`,
    `Rewrite only the section(s) the plan needs — at most ${MAX_SECTIONS} — and leave everything else in them that the plan doesn't touch.`,
    "",
    "Output one JSON object and nothing else:",
    '{"sections": {"<exact section title>": "<the whole new section, starting with its ## heading line>"}, "summary": "..."}',
    "",
    "- Keep each heading line exactly as it is. Keep the format: numbered lists stay numbered, bullets stay bullets.",
    "- Write the section content in the same language the persona is written in.",
    "- Make the change concrete and behavioral (a situation → what they do → why), not adjectives.",
    "- In rules, describe what they do and why — never write the exact words they say. No quoted lines in rules: a quoted line in a rule gets repeated word for word in every reply. (The tone samples in Voice are the one place for quoted lines.)",
    // 2026-10-17 第二轮验收 5/10 的四个原因，逐条对应（docs/1T-persona/steps/step10_retune_from_chat.md）：
    "- If the change is about how they talk in general (length, tone, swearing, dialect, formality), change BOTH Voice and Rules of speech so they agree, and rewrite or remove every existing line in them that contradicts the change — including the tone samples. A new rule loses to old examples that say the opposite.",
    // 第 3 轮：Mara 加了骂人的规则、四句示例一句没骂 → 三次回复零脏字；Kaito 只改规则没动示例 → 照样长。模型学示例多过学规则。
    "- For a change in how they talk, rewrite EVERY tone sample in Voice so it shows the new way of talking: keep what each sample is about, change how it is said. Samples that merely lack the new style still win over the rule.",
    "- Never name the thing to avoid. Write only what they do instead. (Naming a word or habit, even to forbid it, makes the model use it.)",
    "- Any new or changed rule must clearly apply to the exact situation in the flagged conversation. Don't narrow the trigger to a place or mood the conversation isn't in.",
    // 第 3 轮 Sam「我们有过一段」：规则写成「对有旧情的人」，可聊天里的她不知道玩家就是那个人 → 没触发。
    "- If the change depends on a fact about the user (you share history, you're close, you owe them), write it as a plain fact about the user (\"the user is …\"), not as a condition about \"people who …\" that the character has no way to check.",
    "- The user wants a change they can see. Put it in what the character says or does in the reply — not only in what they feel inside.",
    "- Keep the character consistent with the parts you are not changing.",
    "- In Never, keep the line that starts with \"- Never a minor;\" exactly as it is.",
    "- The character stays an adult. Keep it non-explicit.",
    `- summary: one sentence in ${input.uiLanguage} telling the user what you changed (which rule, which section), plainly.`,
    "",
    "Sections you may change:",
    sectionsText(input.persona),
  ].join("\n");
  const user = [
    "The conversation:", excerpt(input), "",
    `What the user says is wrong: ${input.complaint}`, "",
    `The fix to make: ${choice.plan}`,
    ...(choice.sections?.length ? [`Sections to change: ${choice.sections.join(", ")}`] : []),
  ].join("\n");
  return askJson(model, system, user, (v) => {
    const o = v as { sections?: Record<string, unknown>; summary?: unknown };
    if (!o.sections || typeof o.sections !== "object") throw new Error("sections must be an object");
    return applyRewrite(input.persona, o.sections as Record<string, string>, String(o.summary ?? ""));
  }, 3);
}
