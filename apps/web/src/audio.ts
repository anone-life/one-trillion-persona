// 声音处理：找第一个有声的时刻、剪掉开头的无声、包成 WAV。全在本机算，声音不发给 anone.life。
// 门限和 anone.life 一样（5ms 一窗、平均幅度 ≥ 0.01，约 −40dBFS），所以嘴张开的时刻和那边算的一致。
// 输入一律是 16 位小端单声道 PCM。

export const SAMPLE_RATE = 24000;

const sampleAt = (pcm: Uint8Array, i: number) => {
  const v = pcm[i * 2]! | (pcm[i * 2 + 1]! << 8);
  return v >= 0x8000 ? v - 0x10000 : v;
};

/** 第一个有声的时刻（毫秒）。整段都没声返回 0。 */
export function firstAudibleMs(pcm: Uint8Array, sampleRate = SAMPLE_RATE, level = 0.01, windowMs = 5): number {
  const samples = Math.floor(pcm.length / 2);
  const win = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  for (let start = 0; start + win <= samples; start += win) {
    let sum = 0;
    for (let i = start; i < start + win; i++) sum += Math.abs(sampleAt(pcm, i)) / 32768;
    if (sum / win >= level) return Math.round((start / sampleRate) * 1000);
  }
  return 0;
}

export const pcmDurationMs = (pcm: Uint8Array, sampleRate = SAMPLE_RATE): number =>
  Math.round((Math.floor(pcm.length / 2) / sampleRate) * 1000);

/** 剪掉开头的无声，只留 keepMs（不削掉第一个辅音的头）。TTS 开头的死气长短不定，不剪的话角色要先干等。 */
export function trimLeadingSilence(pcm: Uint8Array, sampleRate = SAMPLE_RATE, keepMs = 30): { pcm: Uint8Array; trimmedMs: number } {
  const onset = firstAudibleMs(pcm, sampleRate);
  const cutMs = Math.max(0, onset - keepMs);
  const cutBytes = Math.floor((cutMs / 1000) * sampleRate) * 2;
  return { pcm: pcm.subarray(cutBytes), trimmedMs: Math.round((cutBytes / 2 / sampleRate) * 1000) };
}

/** 一段无声（没填 TTS key 时，让角色照样按时长动）。 */
export const silence = (ms: number, sampleRate = SAMPLE_RATE): Uint8Array => new Uint8Array(Math.round((ms / 1000) * sampleRate) * 2);

/** PCM → WAV 字节，Web Audio 能直接解。 */
export function pcmToWav(pcm: Uint8Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const v = new DataView(out.buffer);
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
