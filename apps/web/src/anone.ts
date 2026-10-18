// anone.life 开放 API 的客户端（可选）：借脸、让脸跟着声音动。接口说明见 docs/ANONE_API.md。
// 发给 anone.life 的只有情绪、脸、开口时刻和时长；台词和声音都留在这边。
// key 只存在这个浏览器里，只发给 anone.life。没填 key 时这个文件里的东西都不会被调用。

export interface AnoneSettings { base: string; key: string }
const KEY = "1t.anone.v1";

export function loadAnone(): AnoneSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { base: "https://www.anone.life", key: "", ...(JSON.parse(raw) as Partial<AnoneSettings>) };
  } catch { /* 读不了就当没填 */ }
  return { base: "https://www.anone.life", key: "" };
}
export function saveAnone(s: AnoneSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify({ base: s.base.replace(/\/+$/, ""), key: s.key.trim() })); } catch { /* 存不了就只在这一页有效 */ }
}
export const anoneReady = (s: AnoneSettings) => /^ak_[0-9a-f]{32}$/.test(s.key) && /^https?:\/\//.test(s.base);

export const EMOTIONS = ["neutral", "happy", "shy", "surprised", "sad", "thoughtful"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export interface Face {
  id: string;
  label: string;
  gender: "female" | "male" | null;
  voice: string;
  base: string;
  poster: string;
  formats: string[];
  clips: { idle: string[]; listening: string[]; thinking: string[]; speaking: string[]; faces: string[] };
}

export interface TimelineEvent { atMs: number; clip: string; startFrame?: number; loop: boolean; fallback?: string }
/** 放一句要的东西：本机合成好的声音 + anone.life 给的时间表。 */
export interface Spoken {
  audio: { format: "wav"; sampleRate: number; durationMs: number; onsetMs: number; trimmedMs: number; base64: string };
  timeline: TimelineEvent[];
  emotion: Emotion;
  face: string;
  /** 这把 key 今天用了几句 / 上限（/animate 回的；第 24 步用来提前提醒、用完只提示一次）。 */
  usage?: { linesToday: number; linesLimit: number };
}

export class AnoneError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.name = "AnoneError"; this.status = status; }
}

async function call<T>(s: AnoneSettings, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${s.base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${s.key}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new AnoneError(res.status, body.message ?? `anone.life said HTTP ${res.status}`);
  return body;
}

let facesCache: Promise<Face[]> | null = null;
export function listFaces(s: AnoneSettings): Promise<Face[]> {
  facesCache ??= call<{ faces: Face[] }>(s, "/v1/1t/faces").then((r) => r.faces).catch((e) => { facesCache = null; throw e; });
  return facesCache;
}
export const resetFaces = () => { facesCache = null; };

export interface Animated { timeline: TimelineEvent[]; emotion: Emotion; face: string; usage: { linesToday: number; linesLimit: number; pointsCharged: number } }

/**
 * 只发情绪、脸、开口时刻和时长，拿回时间表。**台词不发给 anone.life**——
 * 台词只给你自己的模型和你自己的 TTS（voice.ts），声音也在本机量（audio.ts）。
 */
export function animate(s: AnoneSettings, body: { emotion: Emotion; faceId: string; onsetMs: number; durationMs: number }): Promise<Animated> {
  return call<Animated>(s, "/v1/1t/animate", { method: "POST", body: JSON.stringify(body) });
}

/**
 * 回复开头的情绪标签：`[happy] …`。按固定格式取、过白名单（不在里面就 neutral），并从文字里拿掉。
 * 这是让模型写进回复里的一个约定字段，不是去猜聊天文字。
 */
export function takeEmotion(reply: string): { emotion: Emotion; text: string } {
  const m = /^\s*\[([a-z]+)\]\s*/i.exec(reply);
  if (!m) return { emotion: "neutral", text: reply.trim() };
  const tag = m[1]!.toLowerCase();
  return { emotion: (EMOTIONS as readonly string[]).includes(tag) ? (tag as Emotion) : "neutral", text: reply.slice(m[0].length).trim() };
}

/** 只念台词：`*动作*`、`(旁白)`、`（旁白）`、`[标签]` 拿掉，多余空白收拢。 */
export function spokenText(text: string): string {
  return text
    .replace(/\*[^*]*\*/g, " ")
    .replace(/\([^)]*\)|（[^）]*）|\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
