import { test } from "node:test";
import assert from "node:assert/strict";
import { firstAudibleMs, pcmDurationMs, pcmToWav, silence, toBase64, trimLeadingSilence } from "../src/audio.ts";
import { XAI_TONE, estimateMs, openaiVoiceFor } from "../src/voice.ts";
import { EMOTIONS } from "../src/anone.ts";

/** 开头 silentMs 无声、之后方波的 24kHz PCM（和 anone.life 那边测试用的同一个形状）。 */
function pcm(silentMs: number, totalMs: number): Uint8Array {
  const rate = 24000;
  const n = Math.round((totalMs / 1000) * rate);
  const out = new Uint8Array(n * 2);
  const v = new DataView(out.buffer);
  for (let i = Math.round((silentMs / 1000) * rate); i < n; i++) v.setInt16(i * 2, i % 40 < 20 ? 16000 : -16000, true);
  return out;
}

test("开口时刻、剪开头无声、时长——和 anone.life 的 audio.ts 同一套门限", () => {
  const raw = pcm(120, 1500);
  assert.equal(firstAudibleMs(raw), 120);
  assert.equal(pcmDurationMs(raw), 1500);
  const { pcm: cut, trimmedMs } = trimLeadingSilence(raw);
  assert.equal(trimmedMs, 90);
  assert.equal(firstAudibleMs(cut), 30, "剪完只留约 30ms 的头");
  assert.equal(firstAudibleMs(silence(500)), 0, "整段无声回 0");
  assert.equal(pcmDurationMs(silence(500)), 500);
});

test("WAV 头和 base64", () => {
  const wav = pcmToWav(pcm(0, 10));
  assert.equal(String.fromCharCode(...wav.subarray(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.subarray(36, 40)), "data");
  assert.equal(wav.length, 44 + 480);
  assert.equal(atob(toBase64(wav)).length, wav.length);
});

test("语气模板 6 种齐、都含 {text}；没有亲密档", () => {
  assert.deepEqual(Object.keys(XAI_TONE).sort(), [...EMOTIONS].sort());
  for (const tpl of Object.values(XAI_TONE)) assert.ok(tpl.includes("{text}"));
  assert.equal(openaiVoiceFor("male"), "onyx");
  assert.equal(openaiVoiceFor("female"), "nova");
  assert.ok(estimateMs("Hello there, you came back.", "en") >= 1200);
});
