// 种子号与确定性随机。规则见 spec/bazi-rules.v1.md §4。
//
// 种子号：「1T-XXXX-XXXX-XXXX」，12 位 Crockford base32 = 60 bit。
// 随机数：splitmix64，用 BigInt 算，任何平台结果一样。
// 每一层（八字、世界、身体……）用自己的子流：种子 × 规则版本 × 层名 × 重抽次数 一起哈希，
// 所以改一层的枚举、或一层重抽，不会让别的层跟着变。

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32，去掉 I L O U
const MASK64 = (1n << 64n) - 1n;
export const SEED_BITS = 60;

export function formatSeed(value: bigint): string {
  if (value < 0n || value >= 1n << BigInt(SEED_BITS)) throw new RangeError("seed out of range");
  let s = "";
  for (let i = 11; i >= 0; i--) s += ALPHABET[Number((value >> BigInt(i * 5)) & 31n)];
  return `1T-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** 解析种子号。大小写不敏感，I/L 当 1、O 当 0，横杠可有可无，「1T-」前缀可省。 */
export function parseSeed(text: string): bigint {
  let s = text.trim().toUpperCase().replace(/^1T-?/, "").replace(/[-\s]/g, "");
  s = s.replace(/[IL]/g, "1").replace(/O/g, "0");
  if (s.length !== 12) throw new SyntaxError("a seed has 12 characters, like 1T-3F9A-77C2-K8QX");
  let v = 0n;
  for (const ch of s) {
    const d = ALPHABET.indexOf(ch);
    if (d < 0) throw new SyntaxError(`not a seed character: ${ch}`);
    v = (v << 5n) | BigInt(d);
  }
  return v;
}

export function randomSeed(): bigint {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return ((BigInt(b[0]!) << 32n) | BigInt(b[1]!)) & ((1n << BigInt(SEED_BITS)) - 1n);
}

function fnv1a64(text: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & MASK64;
  }
  return h;
}

/** splitmix64 生成器。 */
export class Stream {
  private state: bigint;
  constructor(state: bigint) { this.state = state & MASK64; }

  next64(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return z ^ (z >> 31n);
  }

  /** [0, n) 的整数。取模偏差 < n / 2^64，可忽略。 */
  int(n: number): number {
    return Number(this.next64() % BigInt(n));
  }
}

/** 某一层的子流。 */
export function layerStream(seed: bigint, rulesVersion: number, layer: string, attempt = 0): Stream {
  return new Stream(seed ^ fnv1a64(`1t-persona|v${rulesVersion}|${layer}|${attempt}`));
}
