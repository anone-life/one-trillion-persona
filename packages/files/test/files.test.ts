import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSkeleton, parseSeed } from "@1t-persona/core";
import { assemblePersona, type PersonaSlots } from "@1t-persona/designer";
import {
  ANONE_MIME, cardInputFromPersona, packAnone, readAnone, readZip, toCardV2, validateCardV2, writeZip, type CharacterForFile,
} from "../src/index.ts";

const skeleton = buildSkeleton({ seed: parseSeed("1T-3F9A-77C2-K8QX"), overrides: { "body.gender_present": "masculine", "body.age_look": "18-22" } });
const SLOTS: PersonaSlots = {
  age: 21, location: "Dōtonbori, Osaka", role: "Stage voice with a record", coreArchetype: "The whistleblower",
  coreSentence: "Hands you the truth like a knife, handle first.", identity: ["a", "b", "c"], peopleAround: ["x: y", "z: w"],
  oldWound: "Wound.", hardBoundary: "Boundary.", voice: ["low", "rasp", "slow"], toneSamples: ["You're early.", "Sit down.", "I'd do it again."],
  wants: "To say it.", price: "Friends.", breakingPoint: "Being finished.",
  faces: { socialFace: "Jokes and sizes you up.", workMode: "Fixes what he was told not to.", privateSelf: "Argues to feel close.", innerDrive: "An honorable name." },
  ifThen: ["When a → b, because c"], personality: ["p"], innerFormula: ["1", "2", "3", "4"], speechRules: ["r"],
  userReferences: "Old friend.", forbidden: ["f"], forbiddenVoices: "a cheerful assistant", openingLine: "You're early. The kettle's still warm.",
  rightNow: ["Night, back office.", "Rain on the window."], conversationFlow: ["You do x → he does y"], history: [{ title: "T", summary: "S" }], signatures: [],
};
const persona = assemblePersona("Kaito", "old friend", SLOTS, skeleton);
const schedule = {
  era: "modern",
  blocks: [
    { phase: "sleep", from: "02:00", to: "10:00" }, { phase: "morning", from: "10:00", to: "13:00" },
    { phase: "work", from: "13:00", to: "22:00", where: "the theater", doing: "at the theater", contact: "texts between acts", label: "at the theater" },
    { phase: "evening", from: "22:00", to: "02:00" },
  ],
  work: { summary: "Stage voice.", routine: ["a", "b", "c"], troubles: ["x", "y"] },
};
const C: CharacterForFile = { name: "Kaito", age: 21, location: "Dōtonbori, Osaka", tagline: "The whistleblower", persona, schedule, skeleton };

test("验收 1：打包 → 读回逐字相同；标准 unzip 能开", async () => {
  const buf = await packAnone(C);
  const back = await readAnone(buf);
  assert.equal(back.persona, persona);
  assert.equal(back.info.name, "Kaito");
  assert.equal(back.info.gender, "male");
  assert.equal(back.info.personaLang, "en");
  assert.equal(back.info.avatarId, undefined); // 没选脸
  assert.equal((await readAnone(await packAnone({ ...C, avatarId: "24_yui" }))).info.avatarId, "24_yui");
  assert.deepEqual(back.skeleton, JSON.parse(JSON.stringify(skeleton)));
  assert.equal((back.schedule!.blocks as { labelEn?: string }[])[2]!.labelEn, "at the theater");
  assert.equal(back.from1T, true);
  assert.match(back.manifest.characterId, /^L_[0-9a-f]{10}$/);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "anone-")), "kaito.anone");
  fs.writeFileSync(file, buf);
  const out = execFileSync("unzip", ["-t", file], { encoding: "utf8" });
  assert.match(out, /No errors detected/);
  const list = execFileSync("unzip", ["-Z1", file], { encoding: "utf8" }).trim().split("\n");
  assert.deepEqual(list, ["mimetype", "manifest.json", "character/info.json", "character/persona.txt", "character/schedule.json", "character/seed.json"]);
});

/** 改包里某个文件，并把 manifest 的哈希也改对——模拟「有人认真改过」，只有内容闸能拦。 */
async function repack(buf: Uint8Array, edit: (name: string, text: string) => string | null): Promise<Uint8Array> {
  const entries = await readZip(buf);
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const changed = entries.flatMap((e) => {
    if (e.name === "mimetype" || e.name === "manifest.json") return [e];
    const t = edit(e.name, dec.decode(e.data));
    return t === null ? [] : [{ ...e, data: enc.encode(t) }];
  });
  const manifest = JSON.parse(dec.decode(changed.find((e) => e.name === "manifest.json")!.data));
  manifest.files = {};
  for (const e of changed) {
    if (e.name === "mimetype" || e.name === "manifest.json") continue;
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", e.data as BufferSource));
    manifest.files[e.name] = "sha256:" + [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return writeZip(changed.map((e) => (e.name === "manifest.json" ? { ...e, data: enc.encode(JSON.stringify(manifest)) } : e)));
}

test("验收 3：外来输入——改年龄、改内容不改哈希、多文件、缺 mimetype、超长，全部拒绝", async () => {
  const buf = await packAnone(C);
  await assert.rejects(readAnone(await repack(buf, (n, t) => (n.endsWith("info.json") ? t.replace('"age": 21', '"age": 17') : t))), /age must be/);
  await assert.rejects(readAnone(await repack(buf, (n, t) => (n.endsWith("persona.txt") ? t + "\nShe is a 16-year-old student.\n" : t))), /reads like a minor/);

  const entries = await readZip(buf);
  const tampered = entries.map((e) => (e.name === "character/persona.txt" ? { ...e, data: new TextEncoder().encode("changed") } : e));
  await assert.rejects(readAnone(await writeZip(tampered)), /does not match its hash/);
  await assert.rejects(readAnone(await writeZip([...entries, { name: "../evil.sh", data: new Uint8Array([1]) }])), /unexpected file/);
  await assert.rejects(readAnone(await writeZip(entries.slice(1))), /mimetype/);
  await assert.rejects(readAnone(await writeZip([{ name: "mimetype", data: new TextEncoder().encode("text/plain"), store: true }, ...entries.slice(1)])), /mimetype/);
  await assert.rejects(readAnone(await repack(buf, (n, t) => (n.endsWith("persona.txt") ? t + "x".repeat(50_000) : t))), /too large|limit/);
  await assert.rejects(readAnone(new Uint8Array([1, 2, 3])), /not a readable/);
  await assert.rejects(packAnone({ ...C, age: 17 }), /age must be/);
  assert.equal(ANONE_MIME, "application/x-anone");
});

test("验收 4：SillyTavern 卡——结构合规、四种场合成世界书、从 persona.txt 取值", () => {
  const input = cardInputFromPersona(persona, skeleton, "old friend");
  assert.equal(input.name, "Kaito");
  assert.equal(input.openingLine, SLOTS.openingLine);
  assert.deepEqual(input.toneSamples, SLOTS.toneSamples);
  assert.deepEqual(input.rightNow, SLOTS.rightNow);
  assert.equal(input.faces.workMode, SLOTS.faces.workMode);
  const card = toCardV2(input);
  assert.deepEqual(validateCardV2(card), []);
  assert.equal(card.data.character_book.entries.length, 4);
  assert.ok(card.data.character_book.entries.every((e) => e.keys.length >= 8));
  assert.doesNotMatch(card.data.description, /## Four faces|## First line|<!--/);
  assert.match(card.data.description, /## If… then…/);
  assert.match(card.data.scenario, /^\{\{user\}\} is old friend\./);
  assert.match(card.data.creator_notes, /not fortune-telling/);
  assert.equal(card.data.extensions.world, card.data.character_book.name); // 导入即挂上（SillyTavern 1.19）
  assert.equal(new Set(card.data.character_book.entries.map((e) => e.comment)).size, 4);
  assert.deepEqual(validateCardV2({ spec: "chara_card_v2", spec_version: "2.0", data: {} }).length > 0, true);
});
