// 配音：用玩家自己的 TTS key，在这个浏览器里直接调 TTS 服务商。台词只发给那一家，不发给 anone.life。
// 两家都允许浏览器直接调用（2026-10-18 实测 OPTIONS 预检回 access-control-allow-origin）。
// 都要 24kHz、16 位单声道 PCM，后面量开口时刻用。

import { animate, type AnoneSettings, type Emotion, type Face, type Spoken } from "./anone.ts";
import { SAMPLE_RATE, firstAudibleMs, pcmDurationMs, pcmToWav, silence, toBase64, trimLeadingSilence } from "./audio.ts";

export type VoiceProvider = "none" | "xai" | "openai";
export interface VoiceSettings { provider: VoiceProvider; key: string }
const KEY = "1t.voice.v1";

export function loadVoice(): VoiceSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { provider: "none", key: "", ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch { /* 读不了就当没填 */ }
  return { provider: "none", key: "" };
}
export function saveVoice(s: VoiceSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify({ provider: s.provider, key: s.key.trim() })); } catch { /* 存不了就只在这一页有效 */ }
}
export const voiceReady = (s: VoiceSettings) => s.provider !== "none" && s.key.trim().length > 0;

/**
 * xAI 的语气标签（anone.life 调定的那一套，6 种）。标签不会被念出来，只改语气。
 * OpenAI 没有这种标签，直接念原文。
 */
export const XAI_TONE: Readonly<Record<Emotion, string>> = {
  neutral: "<soft>{text}</soft>",
  happy: "<soft><higher-pitch>{text}</higher-pitch></soft>",
  shy: "[pause] <soft>{text}</soft>",
  surprised: "<higher-pitch>{text}</higher-pitch>",
  sad: "[exhale] <soft><slow>{text}</slow></soft>",
  thoughtful: "[pause] <soft>{text}</soft>",
};

/** OpenAI 的音色按脸的性别挑。xAI 用脸自带的音色（和 anone.life 上同一个声音）。 */
export function openaiVoiceFor(gender: "female" | "male" | null): string {
  return gender === "male" ? "onyx" : gender === "female" ? "nova" : "alloy";
}

export interface VoiceRequest { text: string; emotion: Emotion; lang: "en" | "zh" | "ja"; voice: string; gender: "female" | "male" | null }

/** 合成一句，回 PCM 字节。 */
export async function synthesize(s: VoiceSettings, r: VoiceRequest): Promise<Uint8Array> {
  if (s.provider === "xai") {
    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: { authorization: `Bearer ${s.key.trim()}`, "content-type": "application/json" },
      body: JSON.stringify({ text: XAI_TONE[r.emotion].replaceAll("{text}", r.text), language: r.lang, voice_id: r.voice, output_format: { codec: "pcm", sample_rate: 24000 } }),
    });
    if (!res.ok) throw new Error(`xAI TTS said HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    // 回来可能是 JSON 里的 base64，也可能直接是音频字节
    if ((res.headers.get("content-type") ?? "").includes("json")) {
      const body = (await res.json()) as { audio?: string };
      if (!body.audio) throw new Error("xAI TTS returned no audio");
      return Uint8Array.from(atob(body.audio), (c) => c.charCodeAt(0));
    }
    return new Uint8Array(await res.arrayBuffer());
  }
  if (s.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${s.key.trim()}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: openaiVoiceFor(r.gender), input: r.text, response_format: "pcm" }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS said HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error("no TTS provider set");
}

/** 没填 TTS key 时按字数估一句的时长（不出声，角色照样动）。 */
export function estimateMs(text: string, lang: "en" | "zh" | "ja"): number {
  const perChar = lang === "en" ? 65 : 220;
  return Math.min(60_000, Math.max(1200, text.length * perChar));
}

/**
 * 说一句：本机配音、本机量开口时刻和时长，只把这几个数（加情绪、脸）发给 anone.life 换时间表。
 * 没填 TTS key 时不出声，按字数估时长，角色照样动。
 */
export async function voiceLine(anone: AnoneSettings, voice: VoiceSettings, face: Face, line: { text: string; emotion: Emotion; lang: "en" | "zh" | "ja" }): Promise<Spoken> {
  let pcm: Uint8Array;
  let trimmedMs = 0;
  let onsetMs = 0;
  if (voiceReady(voice)) {
    const raw = await synthesize(voice, { ...line, voice: face.voice, gender: face.gender });
    ({ pcm, trimmedMs } = trimLeadingSilence(raw));
    onsetMs = firstAudibleMs(pcm);
  } else {
    pcm = silence(estimateMs(line.text, line.lang));
  }
  const durationMs = Math.max(1, pcmDurationMs(pcm));
  const anim = await animate(anone, { emotion: line.emotion, faceId: face.id, onsetMs: Math.min(onsetMs, durationMs - 1), durationMs });
  return {
    audio: { format: "wav", sampleRate: SAMPLE_RATE, durationMs, onsetMs, trimmedMs, base64: toBase64(pcmToWav(pcm)) },
    timeline: anim.timeline,
    emotion: anim.emotion,
    face: anim.face,
  };
}
