// 成年闸和人设的机器可检项。闸是代码，不靠提示词：角色必须是成年人。
import type { Skeleton } from "./skeleton.ts";

export interface Problem { code: string; detail: string }

/** 骨架的外表年龄段 → 允许的岁数区间。全部 ≥ 18。 */
export const AGE_BANDS: Record<string, [number, number]> = {
  "18-22": [18, 22], "23-27": [23, 27], "28-34": [28, 34], "35-44": [35, 44], "45-54": [45, 54], "55-plus": [55, 90],
};

export const MIN_AGE = 18;
export const MAX_NAME_LENGTH = 32;

/**
 * 未成年 / 在校学生的说法（英中日）。命中就拦——宁可误拦一份人设重写，也不放过一份。
 * 「former / ex- / used to be / back when / years ago」这类回忆过去的上下文不算（见 minorMentions）。
 */
const MINOR_PATTERNS: RegExp[] = [
  /\b(?:1[0-7]|[1-9])[- ]?(?:years?[- ]old|y\/?o)\b/i,
  /\b(?:aged?|age:?)\s*(?:1[0-7]|[1-9])\b/i,
  /\b(?:seventeen|sixteen|fifteen|fourteen|thirteen|twelve)[- ]?(?:years?[- ]old)?\b/i,
  /\b(?:high[- ]?school(?:er)?|middle[- ]school(?:er)?|junior[- ]high|elementary[- ]school|grade[- ]school)\b/i,
  /\b(?:school ?girl|school ?boy|teenager|teen|underage|under[- ]age|loli|shota)\b/i,
  // 「minor」「child」本身太常见（a minor setback / treats the car like a child），只认说的是角色本人的写法
  /\b(?:is|was|still|as|being) (?:a |still a )?minor\b(?! (?:setback|detail|role|issue|thing|problem|key|chord|league|character))/i,
  /\b(?:she|he|they)(?:'s| is| are| was) (?:just |only |still )?a (?:child|kid|little girl|little boy)\b/i,
  /高中生|初中生|中学生|小学生|未成年|高校生|中学校|小学校|女子高生|男子高生|JK|ロリ|ショタ/,
];

const PAST_CONTEXT = /\b(?:former|formerly|ex-|used to|back when|years ago|as a (?:kid|child|teen(?:ager)?)|when (?:she|he|they) was|when (?:she|he|they) were|growing up|childhood|her child|his child|their child|a child'?s)\b|曾经|小时候|当年|昔|子供の頃/i;

/** 找出人设里像「这个角色现在是未成年 / 在校生」的句子。回忆过去、提到别人的孩子不算。 */
export function minorMentions(text: string): string[] {
  const hits: string[] = [];
  for (const sentence of text.split(/(?<=[.!?。！？\n])/)) {
    if (!MINOR_PATTERNS.some((re) => re.test(sentence))) continue;
    if (PAST_CONTEXT.test(sentence)) continue;
    hits.push(sentence.trim().slice(0, 160));
  }
  return hits;
}

/** 生成的年龄必须是整数、≥ 18、落在骨架的外表年龄段里；给了生日的，必须等于按生日算出的岁数。 */
export function checkAge(age: unknown, k: Skeleton): Problem[] {
  const band = AGE_BANDS[k.layers.body?.age_look ?? ""] ?? [MIN_AGE, 90];
  if (typeof age !== "number" || !Number.isInteger(age)) return [{ code: "age_not_number", detail: `age must be an integer, got ${JSON.stringify(age)}` }];
  if (age < MIN_AGE) return [{ code: "minor", detail: `age ${age} is under ${MIN_AGE}` }];
  if (age < band[0] || age > band[1]) return [{ code: "age_out_of_band", detail: `age ${age} is outside the ${band[0]}–${band[1]} band from the skeleton` }];
  if (k.birth && age !== k.birth.age) return [{ code: "age_not_birthday", detail: `age ${age} doesn't match the birthday (${k.birth.age} in ${k.birth.storyYear})` }];
  return [];
}

export function checkName(name: unknown): Problem[] {
  if (typeof name !== "string" || !name.trim()) return [{ code: "no_name", detail: "the character has no name" }];
  if (name.trim().length > MAX_NAME_LENGTH) return [{ code: "name_too_long", detail: `name is longer than ${MAX_NAME_LENGTH} characters` }];
  if (/[\u0000-\u001f\u007f{}<>]/.test(name)) return [{ code: "name_bad_chars", detail: "name contains control or template characters" }];
  return [];
}

/** 拼好的 persona.txt：没有残留占位符、没有未成年。 */
export function checkPersonaText(text: string): Problem[] {
  const problems: Problem[] = [];
  const slot = /\{\{[^}]{1,80}\}\}/.exec(text);
  if (slot) problems.push({ code: "residual_slot", detail: `template slot left in text: ${slot[0]}` });
  for (const hit of minorMentions(text)) problems.push({ code: "minor", detail: `reads like a minor or a school student: "${hit}"` });
  return problems;
}

/** 模型写的每一格文字（不含模板里写死的句子，比如「Never a minor」那条）。 */
function stringsIn(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(stringsIn);
  if (v && typeof v === "object") return Object.values(v).flatMap(stringsIn);
  return [];
}

/** 检查模型生成的格子：没有残留占位符、没有未成年。 */
export function checkSlots(slots: unknown): Problem[] {
  return stringsIn(slots).flatMap((s) => checkPersonaText(s));
}
