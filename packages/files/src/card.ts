// SillyTavern 角色卡（Character Card V2，JSON）。字段怎么放见 docs/ARCHITECTURE.md。
// 四种场合各成一条世界书（character_book），按关键词触发——这是 1T 给 SillyTavern 玩家最直接的东西：
// 同一个人在酒吧、在工作、在亲密的时候、在说心里话的时候，行为不一样。
import { describe, type Skeleton } from "@1t-persona/core";

export interface CardInput {
  name: string;
  persona: string;
  coreSentence: string;
  relationToUser: string;
  rightNow: string[];
  openingLine: string;
  toneSamples: string[];
  faces: { socialFace: string; workMode: string; privateSelf: string; innerDrive: string };
  skeleton: Skeleton;
}

export interface CardBookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  case_sensitive: boolean;
  name: string;
  priority: number;
  id: number;
  comment: string;
  selective: boolean;
  secondary_keys: string[];
  constant: boolean;
  position: "before_char" | "after_char";
}

export interface CardV2 {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    character_book: { name: string; description: string; scan_depth: number; token_budget: number; recursive_scanning: boolean; extensions: Record<string, unknown>; entries: CardBookEntry[] };
    tags: string[];
    creator: string;
    character_version: string;
    extensions: Record<string, unknown>;
  };
}

/** 四种场合的触发词。宁宽勿窄：没触发＝这条白写，多触发只是多几十个 token。 */
export const FACE_KEYS: Record<keyof CardInput["faces"], { label: string; keys: string[] }> = {
  socialFace: { label: "With strangers", keys: ["stranger", "strangers", "new people", "someone new", "party", "crowd", "bar", "first time", "nice to meet", "introduce", "in public", "everyone"] },
  workMode: { label: "At work", keys: ["work", "job", "boss", "client", "office", "shift", "deadline", "coworker", "colleague", "business", "customer", "career"] },
  privateSelf: { label: "Up close", keys: ["love", "miss you", "date", "kiss", "hold me", "hold you", "close to", "together", "feelings", "care about", "hug", "jealous"] },
  innerDrive: { label: "Deep down", keys: ["dream", "future", "afraid", "scared", "deep down", "regret", "really want", "secret", "why do you", "what do you want", "honest", "truth"] },
};

/** persona.txt 拆成节：标题 → 原文。 */
function sections(persona: string): { title: string; text: string }[] {
  return persona.replace(/<!--[\s\S]*?-->\s*/g, "").split(/\n\n---\n\n/).map((text) => ({ title: (/^##? (.*)$/m.exec(text)?.[1] ?? "").trim(), text: text.trim() })).filter((s) => s.text);
}

export function toCardV2(c: CardInput): CardV2 {
  const d = describe(c.skeleton);
  const description = sections(c.persona)
    .filter((s) => !/^Four faces|^First line/.test(s.title))
    .map((s) => s.text)
    .join("\n\n");
  const entries: CardBookEntry[] = (Object.keys(FACE_KEYS) as (keyof CardInput["faces"])[]).map((k, i) => ({
    keys: FACE_KEYS[k].keys,
    content: `${FACE_KEYS[k].label}, {{char}}: ${c.faces[k]}`,
    extensions: {},
    enabled: true,
    insertion_order: 100 + i,
    case_sensitive: false,
    name: `${FACE_KEYS[k].label} — ${c.name}`,
    priority: 10,
    id: i + 1,
    // SillyTavern 把 comment 当条目标题显示；四条要分得清
    comment: `${FACE_KEYS[k].label} — ${c.name}`,
    selective: false,
    secondary_keys: [],
    constant: false,
    position: "after_char",
  }));
  const world = d.layers.find((l) => l.id === "world")!;
  const era = world.fields.find((f) => f.id === "era")!.valueLabel;
  const city = world.fields.find((f) => f.id === "city")!.valueLabel;
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: c.name,
      description,
      personality: c.coreSentence,
      scenario: [`{{user}} is ${c.relationToUser || "someone new to {{char}}"}.`, ...c.rightNow].join("\n"),
      first_mes: c.openingLine,
      mes_example: c.toneSamples.map((t) => `<START>\n{{char}}: ${t}`).join("\n"),
      creator_notes: `Made with One-Trillion Persona · ${c.skeleton.seed} · rules v${c.skeleton.rulesVersion}. Bazi-inspired character generation — a grammar for fiction, not fortune-telling. The lorebook holds how ${c.name} acts in four settings; it triggers on keywords.`,
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: [],
      character_book: {
        name: `${c.name} — four faces`,
        description: "How the character behaves with strangers, at work, up close, and deep down.",
        scan_depth: 4,
        token_budget: 512,
        recursive_scanning: false,
        extensions: {},
        entries,
      },
      tags: ["1T Persona", era, city],
      creator: "One-Trillion Persona",
      character_version: "1",
      // world：世界书名字先写好。SillyTavern 1.19 点「导入内嵌世界书」只往编辑面板的隐藏字段里写名字、
      // 不触发保存，角色就一直没挂上世界书（2026-10-17 实测）；卡里先写好，导入后就是挂好的。
      extensions: { world: `${c.name} — four faces`, "1t_persona": { seed: c.skeleton.seed, rulesVersion: c.skeleton.rulesVersion } },
    },
  };
}

/** 按 V2 规范检查结构（必填字段、类型）。返回问题列表，空＝通过。 */
export function validateCardV2(card: unknown): string[] {
  const p: string[] = [];
  const c = card as CardV2;
  if (c?.spec !== "chara_card_v2") p.push("spec must be chara_card_v2");
  if (c?.spec_version !== "2.0") p.push("spec_version must be 2.0");
  const d = c?.data as Record<string, unknown> | undefined;
  if (!d) return [...p, "data missing"];
  for (const k of ["name", "description", "personality", "scenario", "first_mes", "mes_example", "creator_notes", "system_prompt", "post_history_instructions", "creator", "character_version"]) {
    if (typeof d[k] !== "string") p.push(`data.${k} must be a string`);
  }
  for (const k of ["alternate_greetings", "tags"]) if (!Array.isArray(d[k]) || !(d[k] as unknown[]).every((x) => typeof x === "string")) p.push(`data.${k} must be a string array`);
  if (!d.extensions || typeof d.extensions !== "object") p.push("data.extensions must be an object");
  const book = d.character_book as CardV2["data"]["character_book"] | undefined;
  if (book) {
    if (!Array.isArray(book.entries)) p.push("character_book.entries must be an array");
    for (const [i, e] of (book.entries ?? []).entries()) {
      if (!Array.isArray(e.keys) || !e.keys.length) p.push(`entry ${i}: keys must be a non-empty array`);
      if (typeof e.content !== "string" || !e.content) p.push(`entry ${i}: content must be a non-empty string`);
      if (typeof e.enabled !== "boolean") p.push(`entry ${i}: enabled must be boolean`);
      if (typeof e.insertion_order !== "number") p.push(`entry ${i}: insertion_order must be a number`);
      if (!e.extensions || typeof e.extensions !== "object") p.push(`entry ${i}: extensions must be an object`);
    }
  }
  if (!(d.name as string)?.trim()) p.push("data.name is empty");
  if (!(d.first_mes as string)?.trim()) p.push("data.first_mes is empty");
  return p;
}

/** 从 persona.txt（第 3 步的模板）里取出角色卡要的几样。人设是唯一的来源，不另存一份格子。 */
export function cardInputFromPersona(persona: string, skeleton: Skeleton, relationToUser: string): CardInput {
  const secs = sections(persona);
  const find = (re: RegExp) => secs.find((s) => re.test(s.title))?.text ?? "";
  const body = (text: string) => text.split("\n").slice(1).join("\n").trim();
  const bulletsOf = (text: string) => text.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
  const name = (/^# (.+?) ·/m.exec(persona)?.[1] ?? "").trim();
  const facesText = bulletsOf(find(/^Four faces/));
  const face = (prefix: string) => facesText.find((l) => l.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
  const voice = find(/^Voice/);
  const toneSamples = voice.split("\n").filter((l) => /^".*"$/.test(l.trim())).map((l) => l.trim().slice(1, -1));
  const opening = body(find(/^First line/)).replace(/^"|"$/g, "");
  return {
    name,
    persona,
    coreSentence: body(find(/^In one line/)),
    relationToUser,
    rightNow: bulletsOf(find(/^Right now/)),
    openingLine: opening,
    toneSamples,
    faces: {
      socialFace: face("With strangers:"),
      workMode: face("At work:"),
      privateSelf: face("Up close:"),
      innerDrive: face("Deep down:"),
    },
    skeleton,
  };
}
