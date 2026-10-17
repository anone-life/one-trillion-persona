// 验收用：一个模型扮演 SillyTavern 玩家，和 Elise 聊完一整轮，再出 persona.txt + schedule.json。
//
//   node tools/simulate_design.ts --seed 1T-3F9A-77C2-K8QX --ask bazi,world,body --wish "..." --out runs/x
//
// 模型配置同 CLI：OPENAI_BASE_URL / OPENAI_API_KEY / ONE_T_MODEL / ONE_T_EXTRA_BODY。
import { parseArgs } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { buildSkeleton, parseSeed } from "@1t-persona/core";
import {
  DesignerSession, finalize, makeCharacter, modelFromEnv, openAICompatible, writeCharacter, type ChatMessage,
} from "@1t-persona/designer";

const { values } = parseArgs({
  options: {
    seed: { type: "string" }, ask: { type: "string" }, wish: { type: "string" }, out: { type: "string" },
    "max-turns": { type: "string" },
  },
});

const model = openAICompatible(modelFromEnv());
const ask = values.ask ? values.ask.split(",") : undefined;
const skeleton = buildSkeleton({ seed: parseSeed(values.seed!), ask });
const session = new DesignerSession(skeleton, model);
const wish = values.wish ?? "You want someone interesting to talk to. You don't have strong ideas.";
const maxTurns = Number(values["max-turns"] ?? 14);

const PLAYER = [
  "You are a SillyTavern user making a new character with a character designer named Elise, in a text chat.",
  `What you have in mind: ${wish}`,
  "Type like a real person in a chat box: one or two short sentences, under 40 words, casual, sometimes lazy (\"idk, you pick\", \"sure\", \"hmm maybe\"). Never write paragraphs, never be overly polite, no lists.",
  "React to what Elise actually asks. Answer her question; sometimes add one detail of your own.",
  "When Elise says she has what she needs, or tells you to type /done, or when you feel it's enough after about 10 exchanges, reply with exactly: /done",
].join("\n");

const log: string[] = [];
const say = (who: string, text: string) => { log.push(`${who}: ${text}`); process.stdout.write(`\n${who}: ${text}\n`); };

say("Elise", await session.open());
let finished = false;
for (let i = 0; i < maxTurns && !finished; i++) {
  // 玩家这边看到的对话：Elise 是 user，自己是 assistant
  const msgs: ChatMessage[] = [{ role: "system", content: PLAYER }];
  for (const t of session.turns) msgs.push({ role: t.role === "designer" ? "user" : "assistant", content: t.text });
  let line = (await model.chat(msgs, { temperature: 0.9, maxTokens: 120 })).trim();
  if (i === maxTurns - 1) line = "/done";
  if (/^\/done\b/.test(line)) {
    say("You", "/done");
    const f = await finalize(model, session.skeleton, session.transcript());
    if (!f.enough) {
      say("(finalize)", `not enough: ${f.missing.join(", ")}`);
      say("Elise", await session.nudge(f.missing));
      continue;
    }
    if (f.dropped.length) say("(finalize)", `dropped: ${JSON.stringify(f.dropped)}`);
    const c = await makeCharacter(model, { name: f.name, relationToUser: f.relationToUser, skeleton: f.skeleton, turns: session.turns, transcript: session.transcript() },
      (stage, n, total) => process.stdout.write(`  writing ${stage} (${n}/${total})\n`));
    const dir = await writeCharacter(values.out ?? "runs", c);
    await fs.writeFile(path.join(dir, "simulation.txt"), [`wish: ${wish}`, `ask: ${skeleton.ask.join(",")}`, "", ...log].join("\n\n") + "\n");
    process.stdout.write(`\nwrote ${dir}\n`);
    finished = true;
    break;
  }
  say("You", line);
  say("Elise", await session.reply(line));
}
if (!finished) { process.stderr.write("simulation ended without a character\n"); process.exitCode = 1; }
