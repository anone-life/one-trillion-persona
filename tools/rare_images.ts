// 「奇人」聊天背景图：从出图清单里每人当前选中的那张，缩成 900 宽的 webp，放进 runs/rare-img/<id>.webp。
//   node tools/rare_images.ts --manifest <rare_manifest.json>
// runs/ 不进 git：照片和预生成的人设一样只在本机，网页按有没有这张图决定台上放不放照片。
// 清单在仓库外（根文档仓库），图也在仓库外；要装 cwebp（brew install webp）。设计见 docs/1T-persona/steps/step20_chat_stage.md。
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { manifest: { type: "string" }, force: { type: "boolean" } } });
if (!values.manifest) throw new Error("usage: node tools/rare_images.ts --manifest <rare_manifest.json> [--force]");
const m = JSON.parse(await fs.readFile(values.manifest, "utf8")) as { people: { id: string; codex_image_selection?: { image?: string } }[] };

const out = new URL("../runs/rare-img/", import.meta.url);
await fs.mkdir(out, { recursive: true });
let made = 0, kept = 0, missing = 0;
for (const p of m.people) {
  const src = p.codex_image_selection?.image;
  if (!src) { missing++; continue; }
  const dst = new URL(`${p.id}.webp`, out);
  const [s, d] = await Promise.all([fs.stat(src).catch(() => null), fs.stat(dst).catch(() => null)]);
  if (!s) { console.warn(`${p.id}: ${src} not found`); missing++; continue; }
  if (d && d.mtimeMs >= s.mtimeMs && !values.force) { kept++; continue; }
  execFileSync("cwebp", ["-quiet", "-q", "82", "-resize", "900", "0", src, "-o", dst.pathname]);
  made++;
}
console.log(`made ${made}, unchanged ${kept}, no image ${missing} (of ${m.people.length})`);
