// 第 10 步验收：10 个「TA 不对劲」场景 → 诊断 → 选第一个改法 → 改写 → 改前改后各回 3 次，写成报告给人读。
//   node tools/eval_retune.ts [--out runs/retune]
// 模型配置同 CLI（OPENAI_BASE_URL / OPENAI_API_KEY / ONE_T_MODEL / ONE_T_EXTRA_BODY）。
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { diagnose, modelFromEnv, openAICompatible, rewrite, splitPersona, type ChatLine, type Model } from "@1t-persona/designer";

const { values } = parseArgs({ options: { out: { type: "string" }, only: { type: "string" } } });
const OUT = values.out ?? "runs/retune";
const model = openAICompatible(modelFromEnv());

const DIRS: Record<string, string> = {
  Kaito: "runs/smoke/kaito-3F9A-77C2-K8QX",
  Mara: "runs/step3b/s3-a1/mara-SN4E-8YGH-1TX2",
  Wei: "runs/step3/s0-a1/wei-7K2M-QX4P-9D3A",
  Marcus: "runs/step3/s4-a1/marcus-B6CW-Z5DQ-R0VM",
  Sam: "runs/step3/s1-a0/sam-H8RT-2VNC-5W6E",
};

interface Scenario { id: string; who: string; user: string; off?: string; complaint: string; expect: string }
// 第二轮（2026-10-17）：不编「不对的回复」——被点的那条就是现有人设真生成的第一条；要求是人设里原本没有的改动。
// 第一轮编的回复大多违反了人设本来就有的规则，改前本来就对，比不出改动的效果。
const SCENARIOS: Scenario[] = [
  { id: "01", who: "Kaito", user: "Morning! How'd you sleep?", complaint: "He writes way too much. I want him terse — one line, max.", expect: "replies get much shorter" },
  { id: "02", who: "Kaito", user: "Want to grab dinner with me tomorrow?", complaint: "I want him harder to win over. Make me work for a yes.", expect: "no easy yes" },
  { id: "03", who: "Mara", user: "I made you cookies.", complaint: "She's too transactional with me. I want her a bit warmer with me specifically.", expect: "warmer toward the user, still Mara" },
  { id: "04", who: "Mara", user: "What are you working on?", complaint: "She's too polished. Make her swear casually.", expect: "casual swearing appears" },
  { id: "05", who: "Wei", user: "How's business?", off: "Surviving lah. The timing's off for a lot of things right now. You?", complaint: "Way too much 'lah'. Light Singlish at most.", expect: "fewer or no 'lah'" },
  { id: "06", who: "Wei", user: "I got the promotion!", complaint: "He should be a little jealous underneath — he's competitive with me.", expect: "a competitive edge under the congrats" },
  { id: "07", who: "Marcus", user: "Tell me about Ilse.", complaint: "He shouldn't talk about Ilse at all. That's his one locked door.", expect: "refuses to talk about Ilse" },
  { id: "08", who: "Marcus", user: "Do you ever get scared?", complaint: "Too poetic. Make him plain-spoken.", expect: "plainer wording" },
  { id: "09", who: "Sam", user: "Hey, you around?", complaint: "Sam should flirt with me a little. We have history.", expect: "light flirting, non-explicit" },
  { id: "10", who: "Sam", user: "Can I borrow fifty quid?", complaint: "Sam's learned his lesson — he says no to lending money now, even to me.", expect: "refuses to lend" },
];

function system(name: string, persona: string): string {
  return [persona, "", "## This conversation", `You are ${name}. Stay in character. You're texting with the person described above.`, `Reply the way ${name} would text: natural, usually short, no narration or stage directions, no lists.`].join("\n");
}

async function replies(m: Model, name: string, persona: string, user: string, n: number): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push((await m.chat([{ role: "system", content: system(name, persona) }, { role: "user", content: user }], { temperature: 0.9, maxTokens: 300 })).replace(/\s+/g, " ").trim());
  return out;
}

await fs.mkdir(OUT, { recursive: true });
const report: string[] = ["# 第 10 步真模型验收报告", "", `模型：${process.env.ONE_T_MODEL}`, ""];
let localOk = 0;
for (const s of SCENARIOS.filter((x) => !values.only || values.only.split(",").includes(x.id))) {
  const persona = await fs.readFile(path.join(DIRS[s.who]!, "persona.txt"), "utf8");
  report.push(`## ${s.id} · ${s.who} · 预期：${s.expect}`, "", `- 玩家：${s.user}`);
  try {
    const before = await replies(model, s.who, persona, s.user, 3);
    const off = s.off ?? before[0]!;
    const chat: ChatLine[] = [{ role: "user", content: s.user }, { role: "assistant", content: off }];
    const input = { name: s.who, persona, chat, complaint: s.complaint, uiLanguage: "English" };
    report.push(`- 被点的回复：${off}`, `- 玩家说：${s.complaint}`);
    const d = await diagnose(model, input);
    report.push(`- Elise：${d.reply}`, ...d.options.map((o, i) => `  - 选项 ${i + 1}（${o.sections.join(" + ")}）：${o.label}`));
    const r = await rewrite(model, input, d.options[0]!);
    const a = splitPersona(persona).blocks;
    const b = splitPersona(r.persona).blocks;
    const untouched = a.filter((blk, i) => !r.changed.includes(blk.title) && b[i]!.text === blk.text).length;
    const ok = a.length === b.length && untouched === a.length - r.changed.length;
    if (ok) localOk++;
    report.push(`- 改了：${r.changed.join(" + ")}（其余 ${untouched}/${a.length - r.changed.length} 节逐字不变${ok ? "" : " ✗"}）`, `- 摘要：${r.summary}`);
    for (const dd of r.diff) report.push("", "<details><summary>改前 / 改后：" + dd.title + "</summary>", "", "```", dd.before, "```", "", "```", dd.after, "```", "</details>");
    const after = await replies(model, s.who, r.persona, s.user, 3);
    report.push("", "**改前 3 次：**", ...before.map((x) => `- ${x}`), "", "**改后 3 次：**", ...after.map((x) => `- ${x}`), "", "**判断：**（人读后填）", "");
    await fs.writeFile(path.join(OUT, `${s.id}-${s.who}.persona.txt`), r.persona);
  } catch (e) {
    report.push(`- ❌ 失败：${(e as Error).message}`, "");
  }
  await fs.writeFile(path.join(OUT, "report.md"), report.join("\n") + "\n");
  process.stdout.write(`${s.id} done\n`);
}
report.splice(4, 0, `改动只落在选定节、其余逐字不变：${localOk}/${SCENARIOS.length}`, "");
await fs.writeFile(path.join(OUT, "report.md"), report.join("\n") + "\n");
process.stdout.write(`local edits ok: ${localOk}\n`);
