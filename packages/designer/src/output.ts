// 收尾：生成 persona.txt + schedule.json，和骨架、对话一起写进一个目录。
import fs from "node:fs/promises";
import path from "node:path";
import type { Skeleton } from "@1t-persona/core";
import type { Turn } from "./designer.ts";
import type { Model } from "./model.ts";
import { generatePersona, type PersonaSlots } from "./persona.ts";
import { generateSchedule, type Schedule } from "./schedule.ts";

export interface Character {
  name: string;
  relationToUser: string;
  skeleton: Skeleton;
  persona: string;
  slots: PersonaSlots;
  schedule: Schedule;
  turns: Turn[];
}

export async function makeCharacter(
  model: Model,
  input: { name: string; relationToUser: string; skeleton: Skeleton; turns: Turn[]; transcript: string },
  onStage?: (stage: string, i: number, n: number) => void,
): Promise<Character> {
  const { text, slots } = await generatePersona(model, input, onStage);
  onStage?.("schedule", 5, 5);
  const schedule = await generateSchedule(model, input.name, slots, input.skeleton);
  return { name: input.name, relationToUser: input.relationToUser, skeleton: input.skeleton, persona: text, slots, schedule, turns: input.turns };
}

export function folderName(c: Pick<Character, "name" | "skeleton">): string {
  const slug = c.name.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "character";
  return `${slug}-${c.skeleton.seed.replace(/^1T-/, "")}`;
}

export async function writeCharacter(dir: string, c: Character): Promise<string> {
  const out = path.join(dir, folderName(c));
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, "persona.txt"), c.persona);
  await fs.writeFile(path.join(out, "schedule.json"), JSON.stringify(c.schedule, null, 2) + "\n");
  await fs.writeFile(path.join(out, "skeleton.json"), JSON.stringify(c.skeleton, null, 2) + "\n");
  await fs.writeFile(path.join(out, "conversation.json"), JSON.stringify({ name: c.name, relationToUser: c.relationToUser, turns: c.turns }, null, 2) + "\n");
  return out;
}
