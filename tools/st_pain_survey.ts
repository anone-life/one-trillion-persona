// SillyTavern 玩家抱怨什么：数一年 r/SillyTavernAI 的帖子。介绍页「问题」一节的数字来自这里。
//   node tools/st_pain_survey.ts fetch     取帖子（Arctic Shift 公开存档）→ runs/st-survey/posts.jsonl
//   node tools/st_pain_survey.ts classify  模型逐批分类 → runs/st-survey/labels.jsonl（断了能续）
//   node tools/st_pain_survey.ts sample    每类随机抽 20 条 → runs/st-survey/sample.md（人读抽查）
//   node tools/st_pain_survey.ts count     出表 → runs/st-survey/counts.json + 打印
//   node tools/st_pain_survey.ts split     把 model 一类再分成 prompt / refusal / quality → runs/st-survey/model_split.jsonl（断了能续）
//   node tools/st_pain_survey.ts splitsample  三个子类各抽 20 条 → runs/st-survey/model_split_sample.md
//   node tools/st_pain_survey.ts costsplit    把 cost 一类分成 price / context → runs/st-survey/cost_split.jsonl + 全部列出
// 模型配置同 CLI（OPENAI_BASE_URL / OPENAI_API_KEY / ONE_T_MODEL / ONE_T_EXTRA_BODY）。
// 方法和结果：根文档仓库 docs/1T-persona/steps/step13_problem_data.md。
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { modelFromEnv, openAICompatible } from "@1t-persona/designer";

const DIR = "runs/st-survey";
const FROM = "2025-10-17", TO = "2026-10-17"; // [FROM, TO)
const CATEGORIES = ["memory", "sameness", "slop", "cards", "visual_voice", "setup", "cost", "proactive", "model", "other"] as const;

interface Post { id: string; created_utc: number; title: string; selftext: string; score: number; num_comments: number; flair: string }
interface Label { id: string; complaint: boolean; category: string }

const readJsonl = async <T>(f: string): Promise<T[]> =>
  existsSync(f) ? (await fs.readFile(f, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : [];

async function fetchPosts() {
  await fs.mkdir(DIR, { recursive: true });
  const out: Post[] = [];
  let after = Math.floor(Date.parse(FROM + "T00:00:00Z") / 1000);
  const end = Math.floor(Date.parse(TO + "T00:00:00Z") / 1000);
  for (;;) {
    const url = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=SillyTavernAI&after=${after}&before=${end}&sort=asc&limit=100&fields=id,created_utc,title,selftext,score,num_comments,link_flair_text`;
    const r = await fetch(url, { headers: { "user-agent": "1t-persona-survey/0.1" } });
    if (!r.ok) { console.error("HTTP", r.status, "retry in 10s"); await new Promise((s) => setTimeout(s, 10_000)); continue; }
    const data = ((await r.json()) as { data: Record<string, unknown>[] }).data;
    if (!data.length) break;
    for (const d of data) {
      out.push({ id: String(d.id), created_utc: Number(d.created_utc), title: String(d.title ?? ""), selftext: String(d.selftext ?? "").slice(0, 600),
        score: Number(d.score ?? 0), num_comments: Number(d.num_comments ?? 0), flair: String(d.link_flair_text ?? "") });
    }
    const last = Number(data[data.length - 1]!.created_utc);
    if (last <= after) after += 1; else after = last;
    process.stdout.write(`\r${out.length} posts, up to ${new Date(after * 1000).toISOString().slice(0, 10)}`);
  }
  const seen = new Set<string>();
  const uniq = out.filter((p) => !seen.has(p.id) && seen.add(p.id));
  await fs.writeFile(`${DIR}/posts.jsonl`, uniq.map((p) => JSON.stringify(p)).join("\n") + "\n");
  // 按周数一下，看有没有空周（存档漏抓）
  const weeks = new Map<string, number>();
  for (const p of uniq) { const w = new Date(p.created_utc * 1000); w.setUTCDate(w.getUTCDate() - w.getUTCDay()); const k = w.toISOString().slice(0, 10); weeks.set(k, (weeks.get(k) ?? 0) + 1); }
  console.log(`\n${uniq.length} unique posts; ${weeks.size} weeks; smallest week: ${Math.min(...weeks.values())}`);
}

const SYSTEM = `You are sorting Reddit posts from r/SillyTavernAI (a community of people who role-play with AI characters).
For each post decide two things.

complaint: true only if the post is about a problem or frustration with the role-play experience itself — something about how the characters or chats turn out, or what it takes to get a good experience. false for: technical help about a specific error, bug or failure (an error message, an API that fails, something that won't import or install, a setting that doesn't work), model news or neutral comparisons, sharing presets/cards/art, memes, jokes, general discussion with no problem in it.

category (only when complaint is true; otherwise "none"), exactly one of:
- memory: the character forgets things, long chats drift, no continuity between sessions, summaries don't work
- sameness: the characters themselves — they all sound alike, lose their own personality, turn into the model's default persona, are too agreeable / never refuse / too positive / too clingy
- slop: repetitive phrasing, the same stock phrases and clichés, repeated sentence patterns
- cards: hard to find good characters, hard to write a character card, not knowing how to write one
- visual_voice: wanting faces, expressions, animation, images of the character, or a voice
- setup: overwhelmed or confused — too many settings and presets, don't know where to start, the tool is too complicated (NOT a specific error message; that is not a complaint)
- cost: too expensive, token limits, context too short
- proactive: the character never starts a conversation or messages you first, or does nothing on their own while you are away (wanting the model to push the plot forward inside a scene is "other")
- model: about the model rather than the characters — the model got dumber or worse at writing, ignores instructions, refuses or censors, needs a jailbreak, too horny / too prudish, a model's general flavor or bias
- other: a role-play problem that fits none of the above

Answer with one JSON object and nothing else: {"labels": [{"id": "...", "complaint": true|false, "category": "..."}]} with one entry per post, same ids.`;

async function classify() {
  const model = openAICompatible(modelFromEnv());
  const posts = await readJsonl<Post>(`${DIR}/posts.jsonl`);
  const done = new Set((await readJsonl<Label>(`${DIR}/labels.jsonl`)).map((l) => l.id));
  const todo = posts.filter((p) => !done.has(p.id));
  const BATCH = 40, PAR = 6;
  const batches: Post[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  let n = done.size;
  const run = async (b: Post[]) => {
    const body = b.map((p) => `id: ${p.id}\ntitle: ${p.title}\nflair: ${p.flair}\ntext: ${p.selftext.replace(/\s+/g, " ").slice(0, 400)}`).join("\n\n---\n\n");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const raw = await model.chat([{ role: "system", content: SYSTEM }, { role: "user", content: body }], { temperature: 0, maxTokens: 4000 });
        const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { labels: Label[] };
        const ids = new Set(b.map((p) => p.id));
        const got = json.labels.filter((l) => ids.has(l.id)).map((l) => ({ id: l.id, complaint: !!l.complaint, category: l.complaint && (CATEGORIES as readonly string[]).includes(l.category) ? l.category : (l.complaint ? "other" : "none") }));
        if (got.length < b.length * 0.9) throw new Error(`only ${got.length}/${b.length} labels`);
        await fs.appendFile(`${DIR}/labels.jsonl`, got.map((l) => JSON.stringify(l)).join("\n") + "\n");
        n += got.length; process.stdout.write(`\r${n}/${posts.length}`);
        return;
      } catch (e) { if (attempt === 2) console.error("\nbatch failed:", (e as Error).message); }
    }
  };
  for (let i = 0; i < batches.length; i += PAR) await Promise.all(batches.slice(i, i + PAR).map(run));
  console.log();
}

async function sample() {
  const posts = new Map((await readJsonl<Post>(`${DIR}/posts.jsonl`)).map((p) => [p.id, p]));
  const labels = await readJsonl<Label>(`${DIR}/labels.jsonl`);
  const lines = ["# 抽查：每类随机 20 条（人读，判对错）", ""];
  const pick = <T>(xs: T[], k: number) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).slice(0, k).map((x) => x[1]);
  for (const c of [...CATEGORIES, "none"]) {
    lines.push(`## ${c}`, "");
    for (const l of pick(labels.filter((x) => x.category === c), 20)) {
      const p = posts.get(l.id)!;
      lines.push(`- [${l.id}] **${p.title}** — ${p.selftext.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    lines.push("");
  }
  await fs.writeFile(`${DIR}/sample.md`, lines.join("\n"));
  console.log(`${DIR}/sample.md`);
}

async function count() {
  const posts = new Map((await readJsonl<Post>(`${DIR}/posts.jsonl`)).map((p) => [p.id, p]));
  const labels = await readJsonl<Label>(`${DIR}/labels.jsonl`);
  const complaints = labels.filter((l) => l.complaint);
  const rows = CATEGORIES.map((c) => {
    const ls = complaints.filter((l) => l.category === c);
    const weight = ls.reduce((s, l) => { const p = posts.get(l.id)!; return s + Math.max(p.score, 0) + p.num_comments; }, 0);
    return { category: c, posts: ls.length, share: ls.length / complaints.length, weight };
  });
  const totalW = rows.reduce((s, r) => s + r.weight, 0);
  const out = { subreddit: "r/SillyTavernAI", from: FROM, to: TO, source: "Arctic Shift archive", totalPosts: posts.size, labelled: labels.length, complaints: complaints.length,
    rows: rows.map((r) => ({ ...r, weightShare: r.weight / totalW })).sort((a, b) => b.posts - a.posts) };
  await fs.writeFile(`${DIR}/counts.json`, JSON.stringify(out, null, 2));
  console.log(`posts ${out.totalPosts}, labelled ${out.labelled}, complaints ${out.complaints}`);
  for (const r of out.rows) console.log(`${r.category.padEnd(13)} ${String(r.posts).padStart(5)}  ${(r.share * 100).toFixed(1).padStart(5)}%   weighted ${(r.weightShare * 100).toFixed(1)}%`);
}

// 「模型本身」里有一部分其实是提示词的问题（2026-10-18 用户指出）——只对 model 那些帖子再分一次
const SPLIT_SYSTEM = `These Reddit posts from r/SillyTavernAI were already judged to be complaints about the AI model during role-play. Sort each into exactly one group:
- prompt: the behavior could be improved by a better preset, system prompt, instructions or character card — the model ignores instructions, breaks character, speaks or acts for the user, has a positivity bias, writes in the wrong style, length or tone, isn't vulgar/dark/funny enough, asks how to make a model behave a certain way
- refusal: the model refuses, censors, filters, moralizes, or the post is about jailbreaking or getting around a safety filter
- quality: the model itself got worse or is broken — dumber, a new version is worse, hallucinates facts, loops, blank or cut-off replies, answers in the wrong language, provider/serving problems
Answer with one JSON object and nothing else: {"labels": [{"id": "...", "group": "prompt|refusal|quality"}]}, one entry per post, same ids.`;
const SUBS = ["prompt", "refusal", "quality"] as const;

async function split() {
  const model = openAICompatible(modelFromEnv());
  const posts = new Map((await readJsonl<Post>(`${DIR}/posts.jsonl`)).map((p) => [p.id, p]));
  const ids = (await readJsonl<Label>(`${DIR}/labels.jsonl`)).filter((l) => l.category === "model").map((l) => l.id);
  const done = new Set((await readJsonl<{ id: string }>(`${DIR}/model_split.jsonl`)).map((l) => l.id));
  const todo = ids.filter((i) => !done.has(i)).map((i) => posts.get(i)!);
  const BATCH = 25, PAR = 6;
  const batches: Post[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  const run = async (b: Post[]) => {
    const body = b.map((p) => `id: ${p.id}\ntitle: ${p.title}\ntext: ${p.selftext.replace(/\s+/g, " ").slice(0, 400)}`).join("\n\n---\n\n");
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const raw = await model.chat([{ role: "system", content: SPLIT_SYSTEM }, { role: "user", content: body }], { temperature: 0, maxTokens: 3000 });
        const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { labels: { id: string; group: string }[] };
        const want = new Set(b.map((p) => p.id));
        const got = json.labels.filter((l) => want.has(l.id) && (SUBS as readonly string[]).includes(l.group));
        if (got.length < b.length * 0.9) throw new Error(`only ${got.length}/${b.length}`);
        await fs.appendFile(`${DIR}/model_split.jsonl`, got.map((l) => JSON.stringify({ id: l.id, group: l.group })).join("\n") + "\n");
        return;
      } catch (e) { if (attempt === 3) console.error("batch failed:", (e as Error).message); }
    }
  };
  for (let i = 0; i < batches.length; i += PAR) await Promise.all(batches.slice(i, i + PAR).map(run));
  const all = await readJsonl<{ id: string; group: string }>(`${DIR}/model_split.jsonl`);
  console.log(`${all.length}/${ids.length}`, SUBS.map((s) => `${s} ${all.filter((l) => l.group === s).length}`).join(", "));
}

async function splitSample() {
  const posts = new Map((await readJsonl<Post>(`${DIR}/posts.jsonl`)).map((p) => [p.id, p]));
  const all = await readJsonl<{ id: string; group: string }>(`${DIR}/model_split.jsonl`);
  const lines = ["# 抽查：model 再分的三个子类，各随机 20 条", ""];
  for (const s of SUBS) {
    lines.push(`## ${s}`, "");
    const xs = all.filter((l) => l.group === s).map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).slice(0, 20);
    for (const [, l] of xs) { const p = posts.get(l.id)!; lines.push(`- [${l.id}] **${p.title}** — ${p.selftext.replace(/\s+/g, " ").slice(0, 160)}`); }
    lines.push("");
  }
  await fs.writeFile(`${DIR}/model_split_sample.md`, lines.join("\n"));
  console.log(`${DIR}/model_split_sample.md`);
}

// 「太贵」和「上下文太短」方向相反（上下文越长越贵；2026-10-18 用户指出）——cost 一类再分一次
const COST_SYSTEM = `These Reddit posts from r/SillyTavernAI were judged to be complaints about cost or context. Sort each into exactly one group:
- price: money — too expensive, prices went up, free tier removed, credits drained, looking for something cheaper or free
- context: the context window or token budget is too small — the model can't hold enough of the chat, context limit hit, max context smaller than expected, tokens being wasted inside the window
Answer with one JSON object and nothing else: {"labels": [{"id": "...", "group": "price|context"}]}, one entry per post, same ids.`;

async function costSplit() {
  const model = openAICompatible(modelFromEnv());
  const posts = new Map((await readJsonl<Post>(`${DIR}/posts.jsonl`)).map((p) => [p.id, p]));
  const ids = (await readJsonl<Label>(`${DIR}/labels.jsonl`)).filter((l) => l.category === "cost").map((l) => l.id);
  const out: { id: string; group: string }[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const b = ids.slice(i, i + 10).map((x) => posts.get(x)!);
    const body = b.map((p) => `id: ${p.id}\ntitle: ${p.title}\ntext: ${p.selftext.replace(/\s+/g, " ").slice(0, 400)}`).join("\n\n---\n\n");
    for (let attempt = 0; ; attempt++) {
      try {
        const raw = await model.chat([{ role: "system", content: COST_SYSTEM }, { role: "user", content: body }], { temperature: 0, maxTokens: 3000 });
        out.push(...(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { labels: { id: string; group: string }[] }).labels);
        break;
      } catch (e) { if (attempt === 3) { console.error(`batch ${i} failed: ${(e as Error).message}`); break; } }
    }
  }
  await fs.writeFile(`${DIR}/cost_split.jsonl`, out.map((l) => JSON.stringify(l)).join("\n") + "\n");
  for (const g of ["price", "context"]) {
    const xs = out.filter((l) => l.group === g);
    console.log(`\n## ${g} ${xs.length}`);
    for (const l of xs) console.log(`- ${posts.get(l.id)?.title.slice(0, 100)}`);
  }
  console.log(`\n${out.length}/${ids.length}`);
}

const cmd = process.argv[2];
if (cmd === "fetch") await fetchPosts();
else if (cmd === "classify") await classify();
else if (cmd === "sample") await sample();
else if (cmd === "count") await count();
else if (cmd === "split") await split();
else if (cmd === "splitsample") await splitSample();
else if (cmd === "costsplit") await costSplit();
else console.error("usage: node tools/st_pain_survey.ts fetch|classify|sample|count");
