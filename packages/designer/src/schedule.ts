// schedule.json：一天四段作息。形状来自 anone.life 的 schedule_generate.ts，改成英文、按骨架的时代分两种。
import type { Skeleton } from "@1t-persona/core";
import { askJson, type Model } from "./model.ts";
import type { PersonaSlots } from "./persona.ts";

export type Phase = "sleep" | "morning" | "work" | "evening";
const PHASES: Phase[] = ["sleep", "morning", "work", "evening"];

export interface ScheduleBlock {
  phase: Phase; from: string; to: string;
  /** 现代：工作段在哪、在做什么、怎么联系得上、状态灯上的短标签 */
  where?: string; doing?: string; contact?: string; label?: string;
  /** 古代：这一段在做什么、身边是谁 */
  say?: string;
}
export interface Schedule {
  era: "modern" | "classical";
  blocks: ScheduleBlock[];
  apart?: string;
  work: { summary: string; routine: string[]; troubles: string[] };
}

export const eraOf = (k: Skeleton): Schedule["era"] => (k.layers.world?.era === "late-qing" ? "classical" : "modern");

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const span = (b: { from: string; to: string }) => (minutes(b.to) - minutes(b.from) + 1440) % 1440;

/** 四段各一次、首尾相接、合起来 24 小时；现代的工作段要有 where / doing / contact / label。 */
export function validateSchedule(raw: unknown, era: Schedule["era"]): Schedule {
  const o = raw as Partial<Schedule>;
  if (!o || !Array.isArray(o.blocks) || o.blocks.length !== 4) throw new Error("blocks must have exactly 4 entries");
  const seen = new Set(o.blocks.map((b) => b.phase));
  if (PHASES.some((p) => !seen.has(p))) throw new Error(`blocks must include each of ${PHASES.join(", ")} once`);
  for (const b of o.blocks) {
    if (!HHMM.test(b.from ?? "") || !HHMM.test(b.to ?? "")) throw new Error(`times must be HH:MM (24h), got ${b.from}–${b.to}`);
    if (span(b) < 30) throw new Error(`${b.phase} runs ${b.from}–${b.to}, under 30 minutes; every phase needs at least 30 minutes — take the time from the block next to it`);
  }
  for (let i = 0; i < 4; i++) {
    const a = o.blocks[i]!, b = o.blocks[(i + 1) % 4]!;
    if (a.to !== b.from) throw new Error(`${a.phase} ends at ${a.to} but ${b.phase} starts at ${b.from}; blocks must join end to start`);
  }
  if (o.blocks.reduce((s, b) => s + span(b), 0) !== 1440) throw new Error("blocks must cover exactly 24 hours");
  const work = o.blocks.find((b) => b.phase === "work")!;
  if (era === "modern") {
    for (const k of ["where", "doing", "contact", "label"] as const) if (!work[k]?.trim()) throw new Error(`work block needs "${k}"`);
  } else {
    if (o.blocks.some((b) => !b.say?.trim())) throw new Error("every block needs \"say\" in a classical setting");
    if (!o.apart?.trim()) throw new Error("classical schedule needs \"apart\"");
  }
  if (!o.work?.summary?.trim() || !Array.isArray(o.work.routine) || o.work.routine.length < 3 || !Array.isArray(o.work.troubles) || o.work.troubles.length < 2) {
    throw new Error("work needs summary, 3-5 routine items and 2-4 troubles");
  }
  return { era, blocks: o.blocks as ScheduleBlock[], ...(era === "classical" ? { apart: o.apart } : {}), work: o.work };
}

const SHAPE = {
  modern: '{"blocks":[{"phase":"sleep","from":"HH:MM","to":"HH:MM"},{"phase":"morning","from":"HH:MM","to":"HH:MM"},{"phase":"work","from":"HH:MM","to":"HH:MM","where":"…","doing":"…","contact":"…","label":"…"},{"phase":"evening","from":"HH:MM","to":"HH:MM"}],"work":{"summary":"…","routine":["…"],"troubles":["…"]}}',
  classical: '{"blocks":[{"phase":"sleep","from":"HH:MM","to":"HH:MM","say":"…"},{"phase":"morning","from":"HH:MM","to":"HH:MM","say":"…"},{"phase":"work","from":"HH:MM","to":"HH:MM","say":"…"},{"phase":"evening","from":"HH:MM","to":"HH:MM","say":"…"}],"apart":"…","work":{"summary":"…","routine":["…"],"troubles":["…"]}}',
};

export async function generateSchedule(model: Model, name: string, s: PersonaSlots, k: Skeleton, language = "English"): Promise<Schedule> {
  const era = eraOf(k);
  const system = [
    "Write one day of this character's routine. Output one JSON object and nothing else.",
    `Shape (no extra fields, none missing; reorder the four blocks to fit their day): ${SHAPE[era]}`,
    "Each phase appears once and lasts at least 30 minutes. The blocks join end to start and cover all 24 hours: each block's `to` is the next block's `from`, and the last joins back to the first. A block crossing midnight has `to` earlier than `from`. 24-hour HH:MM.",
    "Set the hours by their job and life, not office habits: night workers sleep by day. `work` is when they do their main thing — not necessarily daytime.",
    era === "modern"
      ? "The work block needs: where (a place, one phrase), doing (\"at the …\", under six words), contact (how to reach them then, one sentence), label (a 2-4 word status like \"at the clinic\"). Other blocks have only phase/from/to."
      : "This is a historical setting: no phones, no office hours. Every block has `say` (what they're doing and who's around, one or two sentences, no clock times). Add `apart`: what separates them from the other person when apart and how they'd get word to each other.",
    "work.summary: one sentence on what they do. routine: 3-5 concrete things on an ordinary day. troubles: 2-4 concrete everyday frustrations.",
    language === "English" ? "Write in English." : `Write the text values in ${language}. Keep the keys, the phase names and the HH:MM times as they are.`,
  ].join("\n");
  const user = [
    `Name: ${name}`, `Role: ${s.role}`, `Lives in: ${s.location}`, `In one line: ${s.coreSentence}`,
    "Facts:", ...s.identity.map((x) => `- ${x}`), "Right now:", ...s.rightNow.map((x) => `- ${x}`),
  ].join("\n");
  return askJson(model, system, user, (v) => validateSchedule(v, era), 4);
}
