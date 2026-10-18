// 「奇人」100 人的出图清单：每人的关键信息 + 一段能直接拿去别的出图工具用的提示词。
//   node tools/rare_manifest.ts --style <art_style.json> --out <manifest.json>
// 画风段不写在这个仓库里：从 --style 指定的文件读（anone.life 的 style/art_style.json），原样拼进提示词。
// 清单写到仓库外（根文档仓库），因为它带着 anone.life 的画风文字。设计见 docs/1T-persona/steps/step17_rare_100.md。
import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { godLabel, localizedLayers } from "@1t-persona/core";
import { RARE, type Rare } from "../apps/web/src/rare-data.ts";
import { RARE_NAMES } from "../apps/web/src/rare/names.ts";

const { values } = parseArgs({ options: { style: { type: "string" }, out: { type: "string" } } });
if (!values.style || !values.out) throw new Error("usage: node tools/rare_manifest.ts --style <art_style.json> --out <manifest.json>");
const ART = JSON.parse(await fs.readFile(values.style, "utf8")) as { female: { style: string }; male: { style: string }; video: { femaleGuard: string; maleGuard: string } };

const EN = localizedLayers("en"), ZH = localizedLayers("zh");
const label = (layers: typeof EN, path: string, id: string) => {
  const [l, f] = path.split(".");
  return layers.find((x) => x.id === l)?.fields.find((x) => x.id === f)?.values.find((v) => v.id === id)?.label ?? id;
};
const both = (r: Rare, path: string) => ({ id: r.layers[path]!, en: label(EN, path, r.layers[path]!), zh: label(ZH, path, r.layers[path]!) });

// ── 从八层推出画面 ──────────────────────────────────────────────────────
const ERA: Record<string, string> = {
  "late-qing": "the 1900s, late Qing dynasty period clothing and hairstyle",
  showa: "the 1970s, Shōwa-era Japan period clothing and hairstyle",
  "1990s": "the 1990s, period clothing and hairstyle",
  "2010s": "the 2010s",
  "2026": "the present day",
  "near-future": "the near future, around 2045",
  "alternate-history": "an alternate-history present day",
  "in-network-virtual": "a virtual world inside the network",
};
const AGE: Record<string, string> = {
  "18-22": "around twenty", "23-27": "in the mid twenties", "28-34": "around thirty", "35-44": "around forty", "45-54": "around fifty", "55-plus": "in the sixties",
};
const OUTFIT: Record<string, string> = {
  "minimal-business": "minimal tailored business clothes", kimono: "a kimono", y2k: "Y2K-style fashion", dark: "dark, mostly black clothes",
  preppy: "neat preppy clothes", "nightlife-host": "a glamorous nightlife outfit", workwear: "practical work clothes", "tea-quiet": "quiet, plain linen and cotton clothes",
  cyber: "cyberpunk techwear", "home-undone": "rumpled loungewear", "old-money": "old-money tailoring", "idol-packaged": "a bright idol stage costume",
};
const PROP: Record<string, string> = {
  investing: "holding an account ledger", engineering: "holding a small tool", cooking: "holding a kitchen knife and a towel", performance: "holding a microphone",
  scholarship: "holding an old book", martial: "holding a wooden practice sword", design: "holding a sketchbook", medicine: "holding a worn medical bag",
  law: "holding a folder of papers", sales: "holding a sample case", music: "holding a small instrument", games: "holding a deck of cards",
  etiquette: "holding a folded fan", crime: "turning a playing card between two fingers", religion: "holding prayer beads", none: "hands loosely together",
};
const MOOD: Record<string, string> = {
  companion: "a level, self-reliant gaze", rob_wealth: "a competitive half-smile", eating_god: "a relaxed, contented expression",
  hurting_officer: "a sharp, defiant look", indirect_wealth: "a charming, restless grin", direct_wealth: "a steady, careful expression",
  seven_killings: "an alert, guarded stare", direct_officer: "a composed, proper bearing", indirect_resource: "distant, searching eyes",
  direct_resource: "a warm, protective look",
};
const STAGE: Record<string, string> = {
  office: "an office", bar: "a bar counter", home: "a home interior", "shrine-temple": "a shrine or temple", stage: "a stage",
  car: "a car interior", lab: "a workroom", "love-hotel-or-inn": "an old inn",
};
const COMPOSITION = "vertical 3:4 character card, upper-body portrait, facing the viewer, centered, small headroom, hands inside the frame, simple softly blurred background hinting at {stage}, no text, no logo, no watermark, no signature";
const NEGATIVE = "photorealistic, photo, 3D render, plastic CG, child, teenager, schoolgirl, school uniform, nudity, cleavage focus, extra fingers, deformed hands, text, watermark, logo";

function prompt(r: Rare): string {
  const fem = r.layers["body.gender_present"] === "feminine";
  const who = fem ? "adult woman" : "adult man";
  const age = AGE[r.layers["body.age_look"]!]!;
  const era = ERA[r.layers["world.era"]!]!;
  const city = r.layers["world.city"] === "unnamed-port" ? "a nameless harbour city" : label(EN, "world.city", r.layers["world.city"]!);
  const outfit = OUTFIT[r.layers["signs.aesthetic"]!]!;
  const prop = PROP[r.layers["skills.skill_primary"]!]!;
  const mood = MOOD[r.gods[0]]!;
  const stage = STAGE[r.layers["signs.stage"]!]!;
  const job = r.name.en.replace(/^The /, "").replace(/^the /, "");
  const look = `${who} ${age}, mature adult face, not a teenager, ${job}, in ${city}, ${era}, wearing ${outfit}, ${prop}, ${mood}`;
  const subject = fem ? "1girl, solo, looking at viewer" : "1boy, solo, looking at viewer";
  // 形态不是「真人」的，画法要说清楚，否则会被画成普通人
  const embodiment: Record<string, string> = {
    "live-action-human": "",
    "virtual-idol": "drawn as an anime virtual idol shown on a glowing screen, idol character design, still clearly an adult",
    "animated-body": "drawn as a simplified cartoon avatar on a screen, mascot-like proportions, still clearly an adult",
  };
  const style = fem ? ART.female.style : ART.male.style;
  // 只有声音的人：画面里没有人，画 TA 出没的那个地方和一道发光的声波
  if (r.layers["body.embodiment"] === "voice-only") {
    return ["no humans, empty scene", `the place where the voice of ${job} is heard, in ${city}, ${era}`, `${stage}, a softly glowing sound wave in the air, mood: ${mood.replace(/^an? /, "")}`,
      "vertical 3:4 character card, still scene, no text, no logo, no watermark, no signature", style].join(", ");
  }
  const guard = fem ? ART.video.femaleGuard : ART.video.maleGuard;
  return [subject, look, embodiment[r.layers["body.embodiment"]!], COMPOSITION.replace("{stage}", stage), style, guard].filter(Boolean).join(", ");
}

const people = RARE.map((r) => {
  const g = r.gods.map((id) => ({ id, en: godLabel(id, "en")!.name, zh: godLabel(id, "zh")!.name }));
  return {
    id: r.id,
    name: RARE_NAMES[r.id],
    title: r.name,
    era: both(r, "world.era"),
    city: both(r, "world.city"),
    gender: r.layers["body.gender_present"] === "feminine" ? { id: "female", en: "woman", zh: "女" } : { id: "male", en: "man", zh: "男" },
    ageBand: r.layers["body.age_look"],
    embodiment: both(r, "body.embodiment"),
    occupation: { primary: both(r, "skills.skill_primary"), secondary: both(r, "skills.skill_secondary"), honesty: both(r, "skills.skill_honesty") },
    traits: {
      inner: g,
      voice: both(r, "body.voice"), aesthetic: both(r, "signs.aesthetic"), register: both(r, "signs.register"), stage: both(r, "signs.stage"),
      status: { class: both(r, "status.class"), publicness: both(r, "status.publicness"), legal: both(r, "status.legal"), household: both(r, "status.household") },
      drama: { role: both(r, "drama.plot_role"), secret: both(r, "drama.secret") },
      quirk: both(r, "glitch.glitch"),
      twist: r.twist,
    },
    hook: { en: r.hook.en, zh: r.hook.zh },
    image: { prompt: prompt(r), negative: NEGATIVE, aspect: "3:4" },
  };
});

const manifest = {
  _comment: "1T「奇人」100 人的出图清单。由 one-trillion-persona/tools/rare_manifest.ts 生成，别手改；改人物去改 apps/web/src/rare/*.ts 再重跑。image.prompt = 外形 + 衣服 + 道具 + 神态（由八层推出）+ 构图 + anone.life 画风段（style/art_style.json 原样拼入）+ 画风守卫。",
  generatedAt: new Date().toISOString().slice(0, 10),
  style: { source: "web_companion/style/art_style.json", female: ART.female.style, male: ART.male.style },
  count: people.length,
  people,
};
await fs.writeFile(values.out, JSON.stringify(manifest, null, 2) + "\n");
console.log(`${people.length} people → ${values.out}`);
