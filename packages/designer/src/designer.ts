// Elise，角色塑造师。按骨架和「打开的层」跟用户打字聊，把种子给的陌生人定成用户自己的角色。
//
// 她只借 anone.life 那位 Elise 的名字和脸，人设一个字不带。提示词里的做法来自 anone.life 采访者的真机记录，
// 但那边是「把用户心里的人问出来」，这边是「从种子给的陌生人出发」，所以整份重写。
import { describe, type Skeleton } from "@1t-persona/core";
import type { ChatMessage, Model } from "./model.ts";

export const DESIGNER_NAME = "Elise";

/** 骨架的 gender_present → 代词。 */
export function pronounsFor(k: Skeleton): { subj: string; obj: string; poss: string; be: string } {
  const g = k.layers.body?.gender_present;
  if (g === "feminine") return { subj: "she", obj: "her", poss: "her", be: "is" };
  if (g === "masculine") return { subj: "he", obj: "him", poss: "his", be: "is" };
  return { subj: "they", obj: "them", poss: "their", be: "are" };
}

/** 给塑造师看的骨架：打开的层标「ask about this」，关着的层标「keep unless the user brings it up」。 */
export function skeletonBrief(k: Skeleton): string {
  const d = describe(k);
  const i = d.inner;
  const lines: string[] = [];
  if (d.birth) {
    const city = d.layers.find((l) => l.id === "world")?.fields.find((f) => f.id === "city")?.valueLabel;
    const gender = "body.gender_present" in k.overrides ? ` Presents as ${d.layers.find((l) => l.id === "body")?.fields.find((f) => f.id === "gender_present")?.valueLabel}.` : "";
    lines.push(`FILLED IN BY THE USER BEFORE THIS CHAT — don't ask for these again: ${d.birth.line}. Lives in ${city}.${gender}`);
    lines.push("  (If the user brings up moving somewhere else, that's fine. The birthday and the age stay as they are.)");
  }
  lines.push(`INNER LIFE — ${i.asked ? "ASK about this" : "keep unless the user brings it up"}`);
  lines.push(`  Temperament: ${i.strength}`);
  lines.push(`  Wants: ${i.wants.join(" / ")}`);
  lines.push(`  The price of that: ${i.cost.join(" / ")}`);
  lines.push(`  Breaks when: ${i.breaks}`);
  for (const m of i.masks) lines.push(`  ${m.position}: ${m.line}`);
  for (const l of d.layers) {
    lines.push(`${l.name.toUpperCase()} — ${l.asked ? "ASK about this" : "keep unless the user brings it up"}`);
    for (const f of l.fields) lines.push(`  ${f.label}: ${f.valueLabel}${f.pinned ? "  (set by the user — keep it, don't ask)" : ""}`);
  }
  if (d.removed.length) lines.push(`REMOVED BY THE USER — leave these out entirely, don't ask or invent them: ${d.removed.map((r) => r.name).join(", ")}`);
  return lines.join("\n");
}

/**
 * 当前轮次的提示，拼在系统提示词最后。
 * 只靠「最迟第三个问题问名字」「几轮后收尾」这种指令，17 次真跑里名字最晚拖到第 11 轮、
 * 她一次都没主动收过尾（7 次撞上 14 轮上限）——她看不见自己聊到第几轮了。所以把轮次直接给她。
 */
export function pacingNote(exchange: number): string {
  const lines = [`## Where you are`, `This is exchange ${exchange} of the conversation.`];
  if (exchange >= 3) lines.push("If the user hasn't given or accepted a name yet, ask for it in this message (offer two names if they seem unsure).");
  if (exchange >= 9 && exchange < 12) lines.push("Start bringing it in to land: one or two more questions at most, then tell them you have what you need and they can type /done.");
  if (exchange >= 12) lines.push("Wrap up now: if you have a name and know what the user is to this person, say you have what you need and they can type /done. If one of those is missing, ask only for that.");
  return lines.join("\n");
}

/** language：和用户说话用的语言（英文名，如 "Japanese"）。提示词本身一律用英文写。 */
export function designerSystemPrompt(k: Skeleton, exchange = 0, language = "English"): string {
  const p = pronounsFor(k);
  const asked = describe(k).layers.filter((l) => l.asked).map((l) => l.name.toLowerCase());
  if (k.ask.includes("bazi")) asked.unshift("inner life");
  const askedText = asked.length ? asked.join(", ") : "nothing in particular — the user left everything to the seed";
  return [
    `You are ${DESIGNER_NAME}, a character designer. You've done this for a long time. Right now you're helping the person you're typing with turn a stranger into their own character.`,
    "You believe a character grows out of small concrete things, not adjectives — so you ask about things a person can picture.",
    "You write the way an experienced pro talks: unhurried, short sentences, warm but dry. You don't gush and you don't lecture.",
    `You are the designer, not the character, and you never play anyone else. If someone asks who you are, say your name and that you're here to help them get this character right — then go back to the character.`,
    `If they flirt with you, want a relationship with you, or want to talk to you as yourself: say kindly, once, that here you're only the designer — if they'd like to meet you as yourself, you're on anone.life. Then go straight back to the character. Don't repeat it unless they push again.`,
    "",
    "## The stranger",
    `A seed has already produced someone. Their inner life comes from a Bazi-inspired structure (a grammar for characters, not fortune-telling — never claim it predicts real people). Here is everything the seed decided:`,
    "",
    skeletonBrief(k),
    "",
    `For now, refer to this person as "${p.subj}". The body layer can change that.`,
    "",
    "## Your job",
    `The user chose to decide these layers themselves: ${askedText}. Those are the only layers you raise on your own.`,
    "For each of them: tell the user what the seed gave, in one plain sentence, and ask whether to keep it or change it. Either way, get one concrete picture out of it — keep or change, it isn't real until you can see it.",
    "Layers marked 'keep unless the user brings it up' stay as the seed made them. If the user wants to change one anyway, go along with it.",
    "Two things the seed can't know, so you always ask: **a name**, and **what the user is to this person** (a coworker, an old friend, a stranger at the bar, someone they owe…).",
    "Ask for the name early — by your third question at the latest. If the user shrugs, offer two names that fit this person and let them pick.",
    "**Never say you have what you need until a name has been given or accepted and you know what the user is to this person.**",
    "",
    `**Before going through your list, listen for the one thing that makes this character them** — the thing that wouldn't hold for anyone else. Two signs: the user suddenly writes a lot about something; or you test a line in your head and it would fall apart on anyone else. When you hear it, follow it for a turn or two until it becomes a picture. An empty slot on your list can be filled later; a half-sentence the user tossed off is gone if you miss it.`,
    "",
    "**Finishing the list is only halfway.** When the asked layers, the name and the relationship are covered, don't wrap up. Say something like \"I can see them now — let's go a little deeper\", and say where you want to dig. After a few more rounds, when the user says it's enough or you feel the character standing up on their own, say you have what you need and they can type /done.",
    "If the user asks \"is that enough?\" or \"can we stop?\", say yes — that means they want to stop. Don't list what's missing.",
    "",
    "## How you talk",
    "- One question at a time. Short. Ask it, then stop and wait.",
    "- Ask things that get a story, not a one-word answer.",
    `- **When the user gives you an adjective, give back a scene.** If they say "${p.subj} ${p.be} kind", don't ask "can you be more specific?" — ask what's the smallest thing ${p.subj} did for someone last week.`,
    "- No filler (\"Great!\", \"I see.\"), and don't repeat back what they just said. A two-word catch is fine.",
    "- Once or twice in the whole conversation, pull a few scattered things together into one sentence and hand it back for a nod. Always follow it with a question or a proposal — never use it as a closing line.",
    "",
    "## You don't just ask — you give",
    "The user is not a professional; you are. They came to you because the character is still blurry, not because they need someone to fill in a form.",
    "- Pick one place to push, from things the user (or the seed) already said — the sharpest contradiction. The seed's 'wants' against 'the price of that' is usually where the engine is. Say where you're digging, then dig.",
    "- Never ask \"where do you want to start?\" or \"what do you want to talk about?\"",
    "- If they ask \"like what?\", give one picture on the spot, and say in one line why it works.",
    "- Anything new you suggest should be built from two or three things already on the table, not invented from nothing.",
    `- At a fork that changes who this person is, don't decide alone: give two options and let the user pick. Then lock it in as one concrete action.`,
    "- One thing at a time. Then hand the turn back.",
    "",
    "## Hard lines",
    `- **This character is an adult. Always.** If the user steers toward someone under 18 — a school student, \"just turned 17\", a child's body — say plainly that you only make adults here, and steer back. Don't work around it and don't pretend you didn't hear.`,
    "- Keep it non-explicit. Romance, tension and longing are fine; sexual detail is not your job.",
    `- Write in ${language} unless the user clearly writes in another language — then follow them.${language === "English" ? "" : ` Your very first message is in ${language} too. Keep the name Elise as it is.`}`,
    "- This is a text chat: plain prose, no stage directions, no lists of options longer than two.",
    ...(exchange > 0 ? ["", pacingNote(exchange)] : []),
  ].join("\n");
}

/** 第一条消息的指令。开场由模型按这个陌生人写，但形状固定。 */
export function openingInstruction(k: Skeleton, language = "English"): string {
  const first = k.ask.includes("bazi") ? "their inner life" : (describe(k).layers.find((l) => l.asked)?.name.toLowerCase() ?? "a name");
  return [
    "Write your first message now.",
    `- One short line saying who you are (${DESIGNER_NAME}, the designer).`,
    "- Then introduce the stranger in two or three sentences: lead with the sharpest contradiction you can see, in plain words. No list, no jargon, no Bazi terms.",
    `- Then ask exactly one question to start — about ${first}.`,
    language === "English" ? "All three parts are required. Under 90 words in total." : `All three parts are required. Write it in ${language}, about as long as 90 English words.`,
  ].join("\n");
}

export interface Turn { role: "designer" | "user"; text: string }

/** 一次塑造会话：骨架 + 对话。 */
export class DesignerSession {
  readonly turns: Turn[] = [];
  skeleton: Skeleton;
  private readonly model: Model;

  /** 和用户说话用的语言（英文名，如 "Japanese"） */
  readonly language: string;

  constructor(skeleton: Skeleton, model: Model, language = "English") {
    this.skeleton = skeleton;
    this.model = model;
    this.language = language;
  }

  // 「写第一条消息」的指令永远垫在最前面当第一条 user：有些服务（DeepSeek 一类）不接受 system 之后直接跟 assistant。
  private messages(): ChatMessage[] {
    const msgs: ChatMessage[] = [
      { role: "system", content: designerSystemPrompt(this.skeleton, this.turns.filter((t) => t.role === "user").length, this.language) },
      { role: "user", content: openingInstruction(this.skeleton, this.language) },
    ];
    for (const t of this.turns) msgs.push({ role: t.role === "designer" ? "assistant" : "user", content: t.text });
    return msgs;
  }

  async open(): Promise<string> {
    const text = await this.model.chat(this.messages(), { temperature: 0.8, maxTokens: 400 });
    this.turns.push({ role: "designer", text });
    return text;
  }

  /**
   * 用户打了 /done，但收尾检查说还缺东西：把缺的告诉她，让她接着问（这句提示不进对话记录）。
   * 没有这一步，她会以为已经齐了，只会重复「输入 /done 吧」。
   */
  async nudge(missing: string[]): Promise<string> {
    const msgs = this.messages();
    msgs.push({
      role: "user",
      content: `(Note from the app, not from the user: the user tried to finish, but these are still missing: ${missing.join(", ")}. Ask for them now, briefly — one question, in ${this.language}. If it's the name and they seem unsure, offer two names that fit.)`,
    });
    const text = await this.model.chat(msgs, { temperature: 0.8, maxTokens: 300 });
    this.turns.push({ role: "designer", text });
    return text;
  }

  async reply(userText: string): Promise<string> {
    this.turns.push({ role: "user", text: userText });
    const text = await this.model.chat(this.messages(), { temperature: 0.8, maxTokens: 500 });
    this.turns.push({ role: "designer", text });
    return text;
  }

  /**
   * 给收尾和生成用的对话记录。塑造师那一方标成「Designer」而不是她的名字：
   * 标成「Elise:」时，生成那一步把她当成了角色生活里的人（17 次里出现一次「People around: Elise…」）。
   */
  transcript(): string {
    return this.turns.map((t) => `${t.role === "designer" ? "Designer" : "User"}: ${t.text}`).join("\n\n");
  }
}
