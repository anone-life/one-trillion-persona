// 对话结束：判断够不够写、抽出名字和关系、把用户说要改的东西钉进骨架。
import {
  ConstraintError, LAYERS, rebuildSkeleton, validateOverrides, type Overrides, type Skeleton,
} from "@1t-persona/core";
import { checkName } from "@1t-persona/core";
import { askJson, type Model } from "./model.ts";
import { pronounsFor } from "./designer.ts";

export interface Finalized {
  enough: boolean;
  /** 还缺什么（enough 为 false 时），用户听得懂的话 */
  missing: string[];
  name: string;
  relationToUser: string;
  /** 新骨架：原种子 + 用户要改的值 */
  skeleton: Skeleton;
  /** 用户说要改、但枚举里没有或和约束冲突、所以没钉进骨架的（这些仍然会作为对话内容进人设） */
  dropped: { path: string; value: string; why: string }[];
}

function fieldMenu(): string {
  return LAYERS.flatMap((l) => l.fields.map((f) => `${l.id}.${f.id} (${f.label}): ${f.values.map((v) => v.id).join(", ")}`)).join("\n");
}

const SYSTEM = [
  "You read a conversation between a character designer and a user, and pull out what the user decided.",
  "Output one JSON object and nothing else:",
  '{"name": "", "relationToUser": "", "enough": true, "missing": [], "overrides": {}}',
  "",
  "- name: the character's name, if the user gave or accepted one. Name only. Empty string if none.",
  "- relationToUser: who THE USER is (not the character) in the character's life — one short noun phrase describing the user (\"a coworker on the night shift\", \"the new writer on the show\"). Don't start it with \"the user is\". Empty if never settled.",
  "- enough: true when there is a name AND at least one concrete thing the user decided or confirmed about the character. Small talk only = false.",
  "- missing: when enough is false, what's still needed — at most three items, each under six words, in words the user understands. Empty array when enough is true.",
  "- overrides: fields the user clearly CHANGED from the seed's value, mapped to the closest allowed value from the menu below. Key is \"layer.field\", value is one of the listed ids, copied exactly.",
  "  Only include a field when the user explicitly wanted something different and an allowed value fits. If nothing in the menu fits what they said, leave it out — the details go into the persona from the conversation anyway.",
  "  Don't include fields the user kept as they were.",
].join("\n");

/** language：relationToUser 和 missing 用的语言（英文名，如 "Japanese"），默认英文。 */
export async function finalize(model: Model, skeleton: Skeleton, transcript: string, language = "English"): Promise<Finalized> {
  const p = pronounsFor(skeleton);
  const user = [
    `Write relationToUser and missing in ${language}. The character's pronouns are ${p.subj}/${p.obj}/${p.poss}; if a pronoun for the character is needed, use those.`,
    "",
    "The seed's current values:",
    JSON.stringify(Object.fromEntries(Object.entries(skeleton.layers).filter(([id]) => !(skeleton.removed ?? []).includes(id)))),
    "",
    "Allowed values (layer.field: ids):",
    fieldMenu(),
    "",
    "The conversation:",
    transcript,
  ].join("\n");

  const raw = await askJson(model, SYSTEM, user, (v) => {
    const o = v as Record<string, unknown>;
    if (typeof o !== "object" || o === null) throw new Error("not an object");
    if (typeof o.enough !== "boolean") throw new Error("enough must be true or false");
    return {
      name: typeof o.name === "string" ? o.name.trim() : "",
      relationToUser: typeof o.relationToUser === "string" ? o.relationToUser.trim() : "",
      enough: o.enough,
      missing: Array.isArray(o.missing) ? o.missing.filter((x): x is string => typeof x === "string").slice(0, 3) : [],
      overrides: (typeof o.overrides === "object" && o.overrides !== null ? o.overrides : {}) as Record<string, unknown>,
    };
  });

  // 逐个校验，坏的丢掉并记下
  const dropped: Finalized["dropped"] = [];
  const merged: Overrides = { ...skeleton.overrides };
  for (const [path, value] of Object.entries(raw.overrides)) {
    if (typeof value !== "string") { dropped.push({ path, value: String(value), why: "not a value id" }); continue; }
    try {
      validateOverrides({ [path]: value });
      merged[path] = value;
    } catch (e) {
      dropped.push({ path, value, why: (e as Error).message });
    }
  }
  // 和约束冲突的，从后往前丢，直到能建出骨架
  const keys = Object.keys(merged);
  let next: Skeleton | null = null;
  while (!next) {
    try {
      next = rebuildSkeleton(skeleton, merged);
    } catch (e) {
      if (!(e instanceof ConstraintError) || keys.length === 0) throw e;
      const path = keys.pop()!;
      dropped.push({ path, value: merged[path]!, why: e.message });
      delete merged[path];
    }
  }

  let enough = raw.enough;
  const missing = [...raw.missing];
  if (checkName(raw.name).length > 0) {
    enough = false;
    if (!missing.some((m) => /name/i.test(m))) missing.unshift("a name");
  }
  return { enough, missing, name: raw.name, relationToUser: raw.relationToUser, skeleton: next, dropped };
}
