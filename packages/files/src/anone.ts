// .anone：和 anone.life 的 .anone v1 同一个格式，1T 的骨架多放一个 seed.json。格式说明见 docs/ARCHITECTURE.md。
import { checkPersonaText, MIN_AGE, type Skeleton } from "@1t-persona/core";
import { readZip, writeZip, type ZipEntry } from "./zip.ts";

export const ANONE_MIME = "application/x-anone";
export const FORMAT_VERSION = 1;

/** 单个文件的上限（info / persona / schedule 同 anone.life 服务器的限额）。 */
export const LIMITS: Record<string, number> = {
  "character/info.json": 8 * 1024,
  "character/persona.txt": 40 * 1024,
  "character/schedule.json": 20 * 1024,
  "character/seed.json": 16 * 1024,
  "manifest.json": 8 * 1024,
  mimetype: 64,
};
const ALLOWED = new Set(Object.keys(LIMITS));

/** 打包需要的东西（结构上的，不依赖 designer 包）。 */
export interface CharacterForFile {
  name: string;
  age: number;
  location: string;
  tagline: string;
  persona: string;
  /** 第 3 步的作息（era / blocks / work / apart?） */
  schedule: { era: string; blocks: Record<string, unknown>[]; apart?: string; work: unknown };
  skeleton: Skeleton;
  /** 选了 anone.life 的脸就写进 info.json（anone.life 桌宠导入时要它）。 */
  avatarId?: string;
}

export interface Manifest {
  format: "anone";
  formatVersion: 1;
  characterId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  files: Record<string, string>;
}

export class AnoneError extends Error {
  constructor(message: string) { super(message); this.name = "AnoneError"; }
}

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });

async function sha256(data: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource));
  return "sha256:" + [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newLocalId(): string {
  const b = new Uint8Array(5);
  crypto.getRandomValues(b);
  return "L_" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** anone.life 的 info.json 白名单里，我们能填的那几个字段。 */
export function infoJson(c: CharacterForFile): Record<string, unknown> {
  const g = c.skeleton.layers.body?.gender_present;
  return {
    name: c.name,
    name_en: c.name,
    ...(g === "feminine" ? { gender: "female" } : g === "masculine" ? { gender: "male" } : {}),
    age: c.age,
    location: c.location,
    tagline_en: c.tagline,
    personaLang: "en",
    ...(c.avatarId ? { avatarId: c.avatarId } : {}),
  };
}

/** 第 3 步的作息 → anone.life 的形状：enabled / livesTogether / blocks（label → labelEn）/ work。 */
export function anoneSchedule(s: CharacterForFile["schedule"]): Record<string, unknown> {
  return {
    enabled: s.era !== "classical",
    livesTogether: false,
    blocks: s.blocks.map(({ label, ...rest }) => ({ ...rest, ...(typeof label === "string" ? { labelEn: label } : {}) })),
    ...(s.apart ? { apart: s.apart } : {}),
    work: s.work,
  };
}

export async function packAnone(c: CharacterForFile, opts: { createdAt?: string; characterId?: string } = {}): Promise<Uint8Array> {
  if (!(Number.isInteger(c.age) && c.age >= MIN_AGE)) throw new AnoneError(`age must be an integer ≥ ${MIN_AGE}`);
  if (!c.persona.trim()) throw new AnoneError("persona is empty");
  const files: [string, Uint8Array][] = [
    ["character/info.json", enc.encode(JSON.stringify(infoJson(c), null, 2) + "\n")],
    ["character/persona.txt", enc.encode(c.persona)],
    ["character/schedule.json", enc.encode(JSON.stringify(anoneSchedule(c.schedule), null, 2) + "\n")],
    ["character/seed.json", enc.encode(JSON.stringify(c.skeleton, null, 2) + "\n")],
  ];
  for (const [name, data] of files) {
    if (data.length > LIMITS[name]!) throw new AnoneError(`${name} is ${data.length} bytes, over the ${LIMITS[name]} limit`);
  }
  const hashes: Record<string, string> = {};
  for (const [name, data] of files) hashes[name] = await sha256(data);
  const manifest: Manifest = {
    format: "anone",
    formatVersion: FORMAT_VERSION,
    characterId: opts.characterId ?? newLocalId(),
    name: c.name,
    createdBy: "1t-persona",
    createdAt: opts.createdAt ?? new Date().toISOString(),
    files: hashes,
  };
  const entries: ZipEntry[] = [
    { name: "mimetype", data: enc.encode(ANONE_MIME), store: true },
    { name: "manifest.json", data: enc.encode(JSON.stringify(manifest, null, 2) + "\n") },
    ...files.map(([name, data]) => ({ name, data })),
  ];
  return writeZip(entries);
}

export interface AnoneContents {
  manifest: Manifest;
  info: Record<string, unknown>;
  persona: string;
  schedule?: Record<string, unknown>;
  skeleton?: Skeleton;
  /** 有 seed.json ＝ 1T 造的（anone.life 自己打的包没有） */
  from1T: boolean;
}

const json = (name: string, data: Uint8Array): Record<string, unknown> => {
  try {
    const v = JSON.parse(dec.decode(data));
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
    return v as Record<string, unknown>;
  } catch (e) {
    throw new AnoneError(`${name} is not a JSON object (${(e as Error).message})`);
  }
};

/** 读包。当外来输入处理：哪一条不对就拒绝，并说清楚哪一条。 */
export async function readAnone(buf: Uint8Array): Promise<AnoneContents> {
  let entries: ZipEntry[];
  try {
    entries = await readZip(buf, Math.max(...Object.values(LIMITS)), 16);
  } catch (e) {
    throw new AnoneError(`not a readable .anone file: ${(e as Error).message}`);
  }
  if (entries[0]?.name !== "mimetype" || dec.decode(entries[0].data) !== ANONE_MIME) throw new AnoneError("missing or wrong mimetype (must be the first entry)");
  const byName = new Map<string, Uint8Array>();
  for (const e of entries) {
    if (!ALLOWED.has(e.name)) throw new AnoneError(`unexpected file in package: ${e.name}`);
    if (byName.has(e.name)) throw new AnoneError(`duplicate file in package: ${e.name}`);
    if (e.data.length > LIMITS[e.name]!) throw new AnoneError(`${e.name} is over the ${LIMITS[e.name]} byte limit`);
    byName.set(e.name, e.data);
  }
  const m = json("manifest.json", byName.get("manifest.json") ?? new Uint8Array()) as unknown as Manifest;
  if (m.format !== "anone" || m.formatVersion !== FORMAT_VERSION) throw new AnoneError("not a formatVersion 1 .anone");
  if (typeof m.characterId !== "string" || !/^L_[0-9a-f]{10}$/.test(m.characterId)) throw new AnoneError("bad characterId");
  const listed = m.files && typeof m.files === "object" ? m.files : {};
  for (const name of byName.keys()) {
    if (name === "mimetype" || name === "manifest.json") continue;
    if (typeof listed[name] !== "string") throw new AnoneError(`${name} is not listed in the manifest`);
    if ((await sha256(byName.get(name)!)) !== listed[name]) throw new AnoneError(`${name} does not match its hash in the manifest (edited after packing?)`);
  }
  for (const name of Object.keys(listed)) if (!byName.has(name)) throw new AnoneError(`${name} is listed in the manifest but missing`);

  const info = json("character/info.json", byName.get("character/info.json") ?? new Uint8Array());
  if (!(typeof info.age === "number" && Number.isFinite(info.age) && info.age >= MIN_AGE)) throw new AnoneError(`age must be a number ≥ ${MIN_AGE}`);
  if (typeof info.name !== "string" || !info.name.trim()) throw new AnoneError("info.json has no name");
  const personaBytes = byName.get("character/persona.txt");
  if (!personaBytes) throw new AnoneError("persona.txt is missing");
  const persona = dec.decode(personaBytes);
  if (!persona.trim()) throw new AnoneError("persona.txt is empty");
  const problems = checkPersonaText(persona.replace(/^- Never a minor;.*$/gm, ""));
  if (problems.length) throw new AnoneError(`persona failed the checks: ${problems.map((p) => p.detail).join("; ")}`);
  const scheduleBytes = byName.get("character/schedule.json");
  const seedBytes = byName.get("character/seed.json");
  return {
    manifest: m,
    info,
    persona,
    ...(scheduleBytes ? { schedule: json("character/schedule.json", scheduleBytes) } : {}),
    ...(seedBytes ? { skeleton: json("character/seed.json", seedBytes) as unknown as Skeleton } : {}),
    from1T: !!seedBytes,
  };
}
