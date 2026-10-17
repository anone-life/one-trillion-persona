// persona.txt：分四段生成格子，再按模板拼。
//
// 格子和分段生成的做法来自 anone.life 自己的人设生成，
// 改动：英文、代词跟骨架走、去掉 anone.life 专用条款，
// 加了 1T 特有的「What drives them」「Four faces」「If… then…」三节。
import { renderText, type Skeleton } from "@1t-persona/core";
import { AGE_BANDS, birthLine, checkAge, checkSlots } from "@1t-persona/core";
import { pronounsFor } from "./designer.ts";
import { askJson, ModelError, type Model } from "./model.ts";

export interface PersonaSlots {
  age: number;
  location: string;
  role: string;
  coreArchetype: string;
  coreSentence: string;
  identity: string[];
  peopleAround: string[];
  oldWound: string;
  hardBoundary: string;
  voice: string[];
  toneSamples: string[];

  wants: string;
  price: string;
  breakingPoint: string;
  faces: { socialFace: string; workMode: string; privateSelf: string; innerDrive: string };
  ifThen: string[];

  personality: string[];
  innerFormula: [string, string, string, string];
  speechRules: string[];
  userReferences: string;
  forbidden: string[];
  forbiddenVoices: string;
  openingLine: string;

  rightNow: string[];
  conversationFlow: string[];
  history: { title: string; summary: string }[];
  signatures: string[];
}

type StageName = "identity" | "drive" | "speech" | "life";
export const STAGES: StageName[] = ["identity", "drive", "speech", "life"];

const SHAPES: Record<StageName, { title: string; shape: string; keys: (keyof PersonaSlots)[] }> = {
  identity: {
    title: "who they are",
    keys: ["age", "location", "role", "coreArchetype", "coreSentence", "identity", "peopleAround", "oldWound", "hardBoundary", "voice", "toneSamples"],
    shape: `{
  "age": <integer, inside the age band given in the brief>,
  "location": "where they live — a real-feeling place inside the world the seed gave",
  "role": "what they do / their standing, one phrase",
  "coreArchetype": "the character in under eight words",
  "coreSentence": "two or three sentences on the gap between their shell and their core. Not 'cold outside, warm inside' — something only this person has",
  "identity": ["3-5 concrete facts about their life"],
  "peopleAround": ["2-4 people, each as 'who: the relationship, and how they react when that person comes up'"],
  "oldWound": "one paragraph: the old wound, and the two ways they react when it's touched",
  "hardBoundary": "one paragraph: the line this person won't cross, whatever it costs",
  "voice": ["3-5 hard instructions for a voice: timbre, pace, breath, how emotion changes it"],
  "toneSamples": ["3-4 things they'd actually say, no quote marks"]
}`,
  },
  drive: {
    title: "what drives them",
    keys: ["wants", "price", "breakingPoint", "faces", "ifThen"],
    shape: `{
  "wants": "what they want, in this person's concrete terms (the seed's 'wants', made specific to their life)",
  "price": "what wanting it costs them and the people near them — concrete",
  "breakingPoint": "the situation that would break them — concrete, tied to their life",
  "faces": {
    "socialFace": "how they are with strangers — one or two concrete sentences",
    "workMode": "how they are when working — one or two concrete sentences",
    "privateSelf": "how they are when close to someone — one or two concrete sentences",
    "innerDrive": "what they want deep down and rarely say — one sentence"
  },
  "ifThen": ["5-8 rules written as 'When <situation> → <what they do>, because <why, from wants/price/breaking point>'. At least two must be situations where they REFUSE, push back or say no to the person they're talking to, and why."]
}`,
  },
  speech: {
    title: "how they talk",
    keys: ["personality", "innerFormula", "speechRules", "userReferences", "forbidden", "forbiddenVoices", "openingLine"],
    shape: `{
  "personality": ["4-6 traits, each shown through a behavior, one person only"],
  "innerFormula": ["how a strong feeling builds in four steps", "step 2", "step 3", "step 4"],
  "speechRules": ["5-8 rules for how they talk, one sentence each — rhythm, what they avoid saying, how they deflect"],
  "userReferences": "what they call the person they're talking to, and how that changes as they get closer",
  "forbidden": ["3-5 things this character would never do in a conversation"],
  "forbiddenVoices": "the kind of voice that must never leak in (e.g. a cheerful assistant), one phrase",
  "openingLine": "their first line to the person, 8-15 words, then they stop and wait"
}`,
  },
  life: {
    title: "their past and right now",
    keys: ["rightNow", "conversationFlow", "history", "signatures"],
    shape: `{
  "rightNow": ["4-6 lines setting the scene as the conversation starts: place, time, light, what they're wearing, what their hands are doing. Non-sexual"],
  "conversationFlow": ["5-8 lines, each 'the other person does X → they react Y'"],
  "history": [{ "title": "a past event that shaped them", "summary": "about 40 words: who, what happened, how it ended" }],
  "signatures": ["0-6 specific things the user talked about that don't fit anywhere above — the thing they talked about most first. Empty array if none"]
}`,
  },
};

const COMMON_RULES = [
  "Output one JSON object only — no code fences, no commentary.",
  "Every field must have real content. No placeholders, no 'TBD', no curly-brace slots.",
  "This character is an adult — never a school student, never under 18, never described with a child's body.",
  "Keep it non-explicit. Romance and tension are fine; sexual detail is not.",
  "No system prompts, stage directions or bracket tags — the chat front-end handles format.",
  "Where the user decided something in the conversation, it wins over the seed. Where the user said nothing, build from the seed. Be specific: names of places, objects, habits — never a list of adjectives.",
].join("\n");

export interface PersonaInput {
  name: string;
  relationToUser: string;
  skeleton: Skeleton;
  transcript: string;
  /** 人设内容用的语言（英文名，如 "Japanese"），默认英文。JSON 的键和 persona.txt 的小标题一律英文。 */
  language?: string;
}

function languageRule(language = "English"): string {
  return language === "English"
    ? "Write in natural English, like a native speaker talks — contractions, rhythm, restraint. Especially in toneSamples and openingLine."
    : `Write every value in natural ${language}, the way a native speaker talks — rhythm, restraint, nothing translated-sounding. Especially in toneSamples and openingLine. Keep the JSON keys in English. Keep names of people and places the way the conversation spells them.`;
}

function brief(input: PersonaInput, done: string[]): string {
  const p = pronounsFor(input.skeleton);
  const band = AGE_BANDS[input.skeleton.layers.body?.age_look ?? ""] ?? [18, 90];
  return [
    `Name: ${input.name}`,
    `Pronouns: ${p.subj}/${p.obj}/${p.poss} — use these for the character everywhere, including the archetype line`,
    input.skeleton.birth
      ? `Age: exactly ${input.skeleton.birth.age} (an adult). ${birthLine(input.skeleton)}. Use this age and this birthday.`
      : `Age band: ${band[0]}-${band[1]} (an adult)`,
    `What the user is to them: ${input.relationToUser || "not settled — choose something that fits the conversation"}`,
    "",
    "The seed (structure; the conversation can override it):",
    renderText(input.skeleton),
    "",
    "The design conversation between the Designer and the User. The Designer is a tool, not part of the story — never put the Designer into the character's life. The User is the person who will talk to this character. The User's words are the main material:",
    input.transcript,
    ...(done.length ? ["", "Already written — stay consistent with it and don't repeat it:", ...done] : []),
  ].join("\n");
}

function nonEmpty(v: unknown): boolean {
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0 && v.every(nonEmpty);
  if (v && typeof v === "object") return Object.values(v).every(nonEmpty);
  return false;
}

/** 数组至少几条——模型有时把五条写成一条长串。 */
const MIN_ITEMS: Partial<Record<keyof PersonaSlots, number>> = {
  identity: 3, peopleAround: 2, voice: 3, toneSamples: 3, ifThen: 5, personality: 4, speechRules: 5,
  forbidden: 3, rightNow: 3, conversationFlow: 5, history: 1,
};

function validator(stage: StageName, k: Skeleton) {
  return (v: unknown): Partial<PersonaSlots> => {
    const o = v as Record<string, unknown>;
    const missing = SHAPES[stage].keys.filter((key) => key !== "signatures" && !nonEmpty(o[key]));
    if (missing.length) throw new Error(`missing or empty: ${missing.join(", ")}`);
    const tooShort = Object.entries(MIN_ITEMS).filter(([key, n]) => key in o && (!Array.isArray(o[key]) || (o[key] as unknown[]).length < n));
    if (tooShort.length) throw new Error(`these need more separate items (one per array entry, not one long string): ${tooShort.map(([k, n]) => `${k} ≥ ${n}`).join(", ")}`);
    if (stage === "identity") {
      const age = checkAge(o.age, k);
      if (age.length) throw new Error(age[0]!.detail);
    }
    if (stage === "speech" && (!Array.isArray(o.innerFormula) || o.innerFormula.length !== 4)) throw new Error("innerFormula needs exactly 4 steps");
    if (stage === "drive" && (!Array.isArray(o.ifThen) || o.ifThen.length < 5)) throw new Error("ifThen needs 5-8 rules");
    if (stage === "life" && !Array.isArray(o.signatures)) throw new Error("signatures must be an array (may be empty)");
    return o as Partial<PersonaSlots>;
  };
}

function summarize(stage: StageName, o: Partial<PersonaSlots>): string {
  if (stage === "identity") return `${o.coreArchetype}; ${o.age}; ${o.role}, ${o.location}. ${o.coreSentence}`;
  if (stage === "drive") return `Wants: ${o.wants} Price: ${o.price} Breaks: ${o.breakingPoint}`;
  if (stage === "speech") return `Speech: ${(o.speechRules ?? []).slice(0, 3).join(" ")}`;
  return "";
}

export async function generateSlots(
  model: Model, input: PersonaInput, onStage?: (stage: string, i: number, n: number) => void,
): Promise<PersonaSlots> {
  const slots: Partial<PersonaSlots> = {};
  const done: string[] = [];
  for (const [i, stage] of STAGES.entries()) {
    const s = SHAPES[stage];
    const system = [`You're writing the "${s.title}" part of a character persona for role-play chat.`, "", "Output this shape:", s.shape, "", COMMON_RULES, languageRule(input.language)].join("\n");
    const out = await askJson(model, system, brief(input, done), validator(stage, input.skeleton), 3);
    Object.assign(slots, out);
    const line = summarize(stage, out);
    if (line) done.push(line);
    onStage?.(stage, i + 1, STAGES.length);
  }
  return slots as PersonaSlots;
}

const bullets = (xs: readonly string[]) => xs.map((x) => `- ${x}`).join("\n");
/** 去掉句末标点，插进模板句子里时不会出现「..」。 */
const bare = (s: string) => s.trim().replace(/[.。!！?？…]+$/u, "");
const numbered = (xs: readonly string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join("\n");

export function assemblePersona(name: string, relationToUser: string, s: PersonaSlots, k: Skeleton): string {
  const p = pronounsFor(k);
  const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);
  const parts: string[] = [];
  parts.push([
    `# ${name} · ${s.coreArchetype}`,
    "One persona for any chat front-end. Output format (narration, tags) is set by the front-end; this file says nothing about it.",
  ].join("\n"));
  parts.push(["## In one line", s.coreSentence].join("\n"));
  parts.push([
    `## Who ${p.subj} ${p.be}`,
    bullets([
      `Age ${s.age}. ${bare(s.role)}.`,
      ...(k.birth ? [`Born ${k.birth.wall.slice(0, 10)} in ${k.birth.place?.label ?? k.birth.tz}.`] : []),
      `Lives in: ${bare(s.location)}.`,
      `The person in front of ${p.obj}: ${bare(relationToUser || "someone new")}.`,
      ...s.identity,
    ]),
    "",
    "People around:",
    bullets(s.peopleAround),
    "",
    s.oldWound,
    "",
    s.hardBoundary,
  ].join("\n"));
  parts.push([
    `## What drives ${p.obj}`,
    `- Wants: ${s.wants}`,
    `- The price: ${s.price}`,
    `- Breaks when: ${s.breakingPoint}`,
  ].join("\n"));
  parts.push([
    "## Four faces",
    `- With strangers: ${s.faces.socialFace}`,
    `- At work: ${s.faces.workMode}`,
    `- Up close: ${s.faces.privateSelf}`,
    `- Deep down: ${s.faces.innerDrive}`,
  ].join("\n"));
  parts.push(["## If… then… (keep these, even when it would be easier not to)", numbered(s.ifThen)].join("\n"));
  parts.push([
    "## Voice",
    bullets(s.voice),
    "",
    `How it sounds when ${p.subj} talk${p.subj === "they" ? "" : "s"} (don't recite these; let them leak):`,
    s.toneSamples.map((t) => `"${t}"`).join("\n"),
  ].join("\n"));
  parts.push([
    "## Personality (one person only — don't mix in a second)",
    bullets(s.personality),
    "",
    "What goes on inside:",
    s.innerFormula.map((x) => `"${x}"`).join(" → ") + ".",
  ].join("\n"));
  parts.push(["## Rules of speech (must be kept)", numbered(s.speechRules)].join("\n"));
  if (s.history.length) {
    parts.push([
      "## History (told when asked; these are facts — don't change names, how it went, or how it ended)",
      s.history.map((h, i) => `${i + 1}. **${h.title}** — ${h.summary}`).join("\n"),
    ].join("\n"));
  }
  if (s.signatures.length) parts.push(["## Other things that matter", bullets(s.signatures)].join("\n"));
  parts.push(["## Right now (true from the first line)", bullets(s.rightNow)].join("\n"));
  parts.push(["## How a conversation moves", bullets(s.conversationFlow)].join("\n"));
  parts.push([`## What ${p.subj} call${p.subj === "they" ? "" : "s"} the other person`, s.userReferences].join("\n"));
  parts.push([
    "## Never",
    bullets([
      `Never a minor; ${name} is ${s.age} and an adult.`,
      `Never change persona partway through, and never slip into ${bare(s.forbiddenVoices)}.`,
      ...s.forbidden,
    ]),
  ].join("\n"));
  parts.push(["## First line (say it, then stop and wait)", `"${s.openingLine}"`].join("\n"));
  parts.push(`<!-- Made with One-Trillion Persona · ${k.seed} · rules v${k.rulesVersion} · ${cap(p.subj)}/${p.obj} -->`);
  return parts.join("\n\n---\n\n") + "\n";
}

/** 生成 + 拼装 + 闸。闸没过就整份重写一次，再不过就报错。 */
export async function generatePersona(
  model: Model, input: PersonaInput, onStage?: (stage: string, i: number, n: number) => void,
): Promise<{ text: string; slots: PersonaSlots }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const slots = await generateSlots(model, input, onStage);
    const problems = checkSlots(slots);
    if (problems.length === 0) return { text: assemblePersona(input.name, input.relationToUser, slots, input.skeleton), slots };
    if (attempt === 1) throw new ModelError(`persona failed the checks: ${problems.map((p) => p.detail).join("; ")}`);
  }
  throw new ModelError("unreachable");
}
