// 「奇人」100 人 × 中英日，提前把完整人设（persona.txt + 作息）跑出来。先不生成图。
//   node tools/rare_pregen.ts [--only 01,02] [--langs en,zh,ja] [--par 6]
// 产出：runs/rare-pregen/<id>.<lang>.persona.txt、.schedule.json；进度和耗时追加到 runs/rare-pregen/log.jsonl。
// 已有产出的跳过（断点续跑）。模型配置同 CLI（OPENAI_BASE_URL / OPENAI_API_KEY / ONE_T_MODEL / ONE_T_EXTRA_BODY）。
// 设计见根文档仓库 docs/1T-persona/steps/step17_rare_100.md。
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { generatePersona, generateSchedule, modelFromEnv, openAICompatible } from "@1t-persona/designer";
import { RARE, type Rare } from "../apps/web/src/rare-data.ts";
import { rareSkeleton } from "../apps/web/src/rare/skeleton.ts";
import { RARE_NAMES } from "../apps/web/src/rare/names.ts";

type Lang = "en" | "zh" | "ja";
const LANG_NAME: Record<Lang, string> = { en: "English", zh: "Simplified Chinese", ja: "Japanese" };
// 关系一律是「陌生人 · 初次见面」；场景和第一句用目标语言喂（第 17 步：喂英文会让中文人设写成英文）
const RELATION: Record<Lang, string> = { en: "a stranger meeting them for the first time", zh: "初次见面的陌生人", ja: "初めて会う見知らぬ人" };
const TRANSCRIPT: Record<Lang, (r: Rare) => string> = {
  en: (r) => `The user picked this person from the Rare ones page. They have never met.\nWhere they meet: ${r.scene.en}\nTheir first line to the user: ${r.first.en}`,
  zh: (r) => `用户在「奇人」页选了这个人。两人素不相识。\n初见：${r.scene.zh}\nTA 对用户说的第一句：${r.first.zh}`,
  ja: (r) => `ユーザーは「奇人」のページでこの人を選んだ。二人は初対面。\n出会い：${r.scene.ja}\n相手が最初にユーザーにかける言葉：${r.first.ja}`,
};

const { values } = parseArgs({ options: { only: { type: "string" }, langs: { type: "string" }, par: { type: "string" } } });
const OUT = "runs/rare-pregen";
const langs = (values.langs ?? "en,zh,ja").split(",") as Lang[];
const people = RARE.filter((r) => !values.only || values.only.split(",").includes(r.id));
const model = openAICompatible(modelFromEnv());

async function one(r: Rare, lang: Lang) {
  const base = `${OUT}/${r.id}.${lang}`;
  if (existsSync(`${base}.persona.txt`) && existsSync(`${base}.schedule.json`)) return;
  const name = RARE_NAMES[r.id]?.[lang];
  if (!name) throw new Error(`${r.id}: no name for ${lang}`);
  const skeleton = rareSkeleton(r);
  const t0 = Date.now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { text, slots } = await generatePersona(model, { name, relationToUser: RELATION[lang], skeleton, transcript: TRANSCRIPT[lang](r), language: LANG_NAME[lang] });
      const schedule = await generateSchedule(model, name, slots, skeleton, LANG_NAME[lang]);
      await fs.writeFile(`${base}.persona.txt`, text);
      await fs.writeFile(`${base}.schedule.json`, JSON.stringify(schedule, null, 2));
      await fs.appendFile(`${OUT}/log.jsonl`, JSON.stringify({ id: r.id, lang, ok: true, attempt, secs: (Date.now() - t0) / 1000, chars: text.length }) + "\n");
      process.stdout.write(`✓ ${r.id}.${lang} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
      return;
    } catch (e) {
      await fs.appendFile(`${OUT}/log.jsonl`, JSON.stringify({ id: r.id, lang, ok: false, attempt, error: (e as Error).message.slice(0, 300) }) + "\n");
      if (attempt === 3) process.stdout.write(`✗ ${r.id}.${lang} ${(e as Error).message.slice(0, 120)}\n`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fs.mkdir(OUT, { recursive: true });
  const jobs = people.flatMap((r) => langs.map((l) => () => one(r, l)));
  const par = Number(values.par ?? 6);
  let next = 0;
  await Promise.all(Array.from({ length: par }, async () => { while (next < jobs.length) await jobs[next++]!(); }));
  console.log(`done: ${jobs.length} jobs`);
}
