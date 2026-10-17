#!/usr/bin/env node
// 1t-persona 命令行。用法见 HELP。
import { parseArgs } from "node:util";
import readline from "node:readline/promises";
import fs from "node:fs/promises";
import path from "node:path";
import { cardInputFromPersona, packAnone, readAnone, toCardV2 } from "@1t-persona/files";
import {
  DESIGNER_NAME, DesignerSession, finalize, makeCharacter, modelFromEnv, openAICompatible, writeCharacter,
} from "@1t-persona/designer";
import {
  ALL_LAYERS, ConstraintError, DEFAULT_ASK, LAYERS, buildSkeleton, layerCount, parseSeed, randomSeed, renderText,
  type BirthInput, type Overrides,
} from "@1t-persona/core";

const HELP = `One-Trillion Persona — every seed is someone.

Usage:
  1t-persona roll [options]      Roll a character skeleton (default command)
  1t-persona design [options]    Roll, then shape the character by chatting with Elise; writes persona.txt
  1t-persona export <dir>        Write <name>.anone and <name>.card.json (SillyTavern) for a character folder
  1t-persona inspect <file>      Check a .anone file and print what's inside
  1t-persona layers              List every layer, field and value

Options for roll:
  --seed <code>        Reuse a seed, e.g. 1T-3F9A-77C2-K8QX (default: a new random seed)
  --birth <datetime>   Use a birthday for the inner layer, e.g. "1998-04-12 07:30"
  --tz <zone>          Time zone of --birth, e.g. Asia/Tokyo or +09:00 (default: this computer's)
  --lon <degrees>      Birth longitude (east positive); turns on true solar time
  --ask <layers>       Layers the designer will ask you about (default: ${DEFAULT_ASK.join(",")})
                       Layers: ${ALL_LAYERS.join(", ")}
  --set <layer.field=value>   Pin a value, e.g. --set world.city=tokyo (repeatable)
  --json               Print the full skeleton as JSON
  -h, --help           Show this help

Options for design (plus all of the above except --json):
  --out <dir>          Where to write the character folder (default: ./out)
  Model: set OPENAI_API_KEY, and OPENAI_BASE_URL / ONE_T_MODEL for any OpenAI-compatible provider.
  In the chat: /show prints the current skeleton, /done finishes, /quit leaves without saving.

Bazi here is a grammar for fictional characters, not fortune-telling.`;

function parseBirth(text: string, tz: string, lon?: string): BirthInput {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) throw new ConstraintError(`--birth must look like "1998-04-12 07:30", got "${text}"`);
  const [, y, mo, d, h, mi] = m.map(Number) as number[];
  const birth: BirthInput = { wall: { year: y!, month: mo!, day: d!, hour: h!, minute: mi! }, tz };
  if (lon !== undefined) {
    const v = Number(lon);
    if (!Number.isFinite(v) || v < -180 || v > 180) throw new ConstraintError(`--lon must be between -180 and 180, got "${lon}"`);
    birth.longitude = v;
  }
  return birth;
}

function parseSets(sets: string[]): Overrides {
  const out: Overrides = {};
  for (const s of sets) {
    const i = s.indexOf("=");
    if (i < 1) throw new ConstraintError(`--set must look like layer.field=value, got "${s}"`);
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return out;
}

function listLayers(): string {
  const lines = [`BAZI  ${layerCount("bazi").toLocaleString("en-US")} charts (year pillar 60 × month 12 × day pillar 60 × hour 12)`];
  for (const l of LAYERS) {
    lines.push("", `${l.id.toUpperCase()}  ${layerCount(l.id).toLocaleString("en-US")} combinations — ${l.blurb}`);
    for (const f of l.fields) lines.push(`  ${l.id}.${f.id} (${f.label}): ${f.values.map((v) => v.id).join(", ")}`);
  }
  return lines.join("\n");
}

export function run(argv: string[]): { code: number; out: string } {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      seed: { type: "string" }, birth: { type: "string" }, tz: { type: "string" }, lon: { type: "string" },
      ask: { type: "string" }, set: { type: "string", multiple: true }, json: { type: "boolean" },
      help: { type: "boolean", short: "h" }, out: { type: "string" },
    },
  });
  const cmd = positionals[0] ?? "roll";
  if (values.help) return { code: 0, out: HELP };
  if (cmd === "layers") return { code: 0, out: listLayers() };
  if (cmd !== "roll") return { code: 2, out: `unknown command "${cmd}"\n\n${HELP}` };
  const skeleton = skeletonFrom(values);
  return { code: 0, out: values.json ? JSON.stringify(skeleton, null, 2) : renderText(skeleton) };
}

type Values = { seed?: string; birth?: string; tz?: string; lon?: string; ask?: string; set?: string[] };

function skeletonFrom(values: Values) {
  const seed = values.seed ? parseSeed(values.seed) : randomSeed();
  const tz = values.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const birth = values.birth ? parseBirth(values.birth, tz, values.lon) : undefined;
  const ask = values.ask ? values.ask.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  return buildSkeleton({ seed, birth, ask, overrides: parseSets(values.set ?? []) });
}

/** 角色目录 → <名字>.anone + <名字>.card.json。人设、骨架、作息都从目录里读，persona.txt 是唯一来源。 */
async function exportFolder(dir: string): Promise<string[]> {
  const read = (f: string) => fs.readFile(path.join(dir, f), "utf8");
  const persona = await read("persona.txt");
  const skeleton = JSON.parse(await read("skeleton.json"));
  const schedule = JSON.parse(await read("schedule.json"));
  const conv = JSON.parse(await read("conversation.json").catch(() => "{}"));
  const card = cardInputFromPersona(persona, skeleton, conv.relationToUser ?? "");
  // 「- Age 26.」是现在的模板；最早一版写成「- 26.」，也认
  const age = Number(/^- Age (\d+)\./m.exec(persona)?.[1] ?? /^- (\d+)\. /m.exec(persona)?.[1]);
  const location = /^- Lives in: (.+?)\.?$/m.exec(persona)?.[1] ?? "";
  const tagline = /^# .+? · (.+)$/m.exec(persona)?.[1] ?? "";
  const base = path.join(dir, card.name.replace(/[^\p{L}\p{N}_ -]+/gu, "").trim() || "character");
  await fs.writeFile(`${base}.anone`, await packAnone({ name: card.name, age, location, tagline, persona, schedule, skeleton }));
  await fs.writeFile(`${base}.card.json`, JSON.stringify(toCardV2(card), null, 2) + "\n");
  return [`${base}.anone`, `${base}.card.json`];
}

async function design(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv, allowPositionals: true,
    options: {
      seed: { type: "string" }, birth: { type: "string" }, tz: { type: "string" }, lon: { type: "string" },
      ask: { type: "string" }, set: { type: "string", multiple: true }, out: { type: "string" },
    },
  });
  const model = openAICompatible(modelFromEnv());
  const session = new DesignerSession(skeletonFrom(values), model);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const say = (text: string) => process.stdout.write(`\n${DESIGNER_NAME}: ${text}\n\n`);
  process.stdout.write(`${session.skeleton.seed} — designing with ${DESIGNER_NAME}. /show, /done, /quit\n`);
  say(await session.open());
  try {
    for (;;) {
      const line = (await rl.question("you: ")).trim();
      if (!line) continue;
      if (line === "/quit") return 0;
      if (line === "/show") { process.stdout.write(`\n${renderText(session.skeleton)}\n\n`); continue; }
      if (line === "/done") {
        process.stdout.write("\n(reading the conversation…)\n");
        const f = await finalize(model, session.skeleton, session.transcript());
        if (!f.enough) { say(await session.nudge(f.missing)); continue; }
        for (const d of f.dropped) process.stdout.write(`(kept as a detail, not a seed value: ${d.path}=${d.value} — ${d.why})\n`);
        const c = await makeCharacter(model, { name: f.name, relationToUser: f.relationToUser, skeleton: f.skeleton, turns: session.turns, transcript: session.transcript() },
          (stage, i, n) => process.stdout.write(`  writing ${stage} (${i}/${n})\n`));
        const dir = await writeCharacter(values.out ?? "out", c);
        const files = await exportFolder(dir);
        process.stdout.write(`\n${c.name} is ready:\n  ${dir}/persona.txt\n${files.map((f) => `  ${f}\n`).join("")}`);
        return 0;
      }
      say(await session.reply(line));
    }
  } finally {
    rl.close();
  }
}

async function inspect(file: string): Promise<number> {
  const c = await readAnone(new Uint8Array(await fs.readFile(file)));
  process.stdout.write([
    `${c.manifest.name}  ${c.manifest.characterId}  made by ${c.manifest.createdBy} on ${c.manifest.createdAt}`,
    `age ${c.info.age}${c.info.gender ? ` · ${c.info.gender}` : ""}${c.info.location ? ` · ${c.info.location}` : ""}`,
    `persona ${c.persona.length} chars · schedule ${c.schedule ? "yes" : "no"} · ${c.from1T ? `seed ${c.skeleton?.seed} (rules v${c.skeleton?.rulesVersion})` : "no seed (not made with 1T Persona)"}`,
    "all checks passed",
  ].join("\n") + "\n");
  return 0;
}

const ASYNC: Record<string, (args: string[]) => Promise<number>> = {
  design: (a) => design(a),
  export: async (a) => { if (!a[0]) throw new Error("usage: 1t-persona export <character folder>"); for (const f of await exportFolder(a[0])) process.stdout.write(f + "\n"); return 0; },
  inspect: async (a) => { if (!a[0]) throw new Error("usage: 1t-persona inspect <file.anone>"); return inspect(a[0]); },
};

if (import.meta.main && ASYNC[process.argv[2] ?? ""]) {
  ASYNC[process.argv[2]!]!(process.argv.slice(3)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.exitCode = 1;
  });
} else if (import.meta.main) {
  try {
    const { code, out } = run(process.argv.slice(2));
    (code === 0 ? process.stdout : process.stderr).write(out + "\n");
    process.exitCode = code;
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.exitCode = 1;
  }
}
