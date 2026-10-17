// 最小 zip 读写：只用 Uint8Array、CompressionStream、DataView，Node 和浏览器都能跑。
// 写：mimetype 那种条目不压缩（store），其余 deflate。读：认 store 和 deflate 两种，别的拒绝。

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
const deflate = (d: Uint8Array) => pipe(d, new CompressionStream("deflate-raw"));
const inflate = (d: Uint8Array) => pipe(d, new DecompressionStream("deflate-raw"));

export interface ZipEntry { name: string; data: Uint8Array; store?: boolean }

export async function writeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const body = e.store ? e.data : await deflate(e.data);
    const method = e.store ? 0 : 8;
    const crc = crc32(e.data);
    const local = new Uint8Array(30);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, method, true); lv.setUint32(14, crc, true); lv.setUint32(18, body.length, true);
    lv.setUint32(22, e.data.length, true); lv.setUint16(26, name.length, true);
    parts.push(local, name, body);
    const c = new Uint8Array(46);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true); cv.setUint32(16, crc, true); cv.setUint32(20, body.length, true);
    cv.setUint32(24, e.data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    central.push(c, name);
    offset += local.length + name.length + body.length;
  }
  const centralSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const b of all) { out.set(b, p); p += b.length; }
  return out;
}

export class ZipError extends Error {
  constructor(message: string) { super(message); this.name = "ZipError"; }
}

/** 读 zip。maxEntryBytes 限制每个条目解压后的大小（防压缩炸弹）。 */
export async function readZip(buf: Uint8Array, maxEntryBytes = 1 << 20, maxEntries = 64): Promise<ZipEntry[]> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError("not a zip file");
  const count = v.getUint16(eocd + 10, true);
  if (count > maxEntries) throw new ZipError(`too many entries (${count})`);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder("utf-8", { fatal: true });
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || v.getUint32(p, true) !== 0x02014b50) throw new ZipError("broken central directory");
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const lho = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (usize > maxEntryBytes) throw new ZipError(`${name} is too large (${usize} bytes)`);
    if (lho + 30 > buf.length || v.getUint32(lho, true) !== 0x04034b50) throw new ZipError(`broken local header for ${name}`);
    const start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
    const body = buf.subarray(start, start + csize);
    let data: Uint8Array;
    if (method === 0) data = body.slice();
    else if (method === 8) data = await inflate(body);
    else throw new ZipError(`${name} uses an unsupported compression method (${method})`);
    if (data.length !== usize || crc32(data) !== crc) throw new ZipError(`${name} is corrupt (size or CRC mismatch)`);
    out.push({ name, data, store: method === 0 });
  }
  return out;
}
