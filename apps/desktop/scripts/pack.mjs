// Build the desktop app: web app → apps/desktop/web/, then @electron/packager for each platform, then zips
// people can download (release/) plus manifest.json with each zip's size and sha256 (paste those into the release notes).
//
//   node scripts/pack.mjs            # macOS Apple Silicon + Intel, Windows x64
//   node scripts/pack.mjs mac-arm64  # just one (mac-arm64 | mac-x64 | win-x64)
//
// The build never contains rare-person personas or photos (the web build swaps them for an empty stub unless
// ONE_T_RARE_ASSETS=1 is set — this script refuses to run with it set), runs/, or any key.
//
// macOS zips are made with `ditto`, not `zip`: an .app is full of symlinks that zip mangles. The app gets an ad-hoc
// signature (no certificate) so Apple Silicon doesn't call it "damaged"; people still right-click → Open the first time.
// Real signing + notarization needs an Apple Developer ID (see the README).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(DESKTOP, "..", "..");
const DIST = path.join(DESKTOP, "dist");
const OUT = path.join(DESKTOP, "release");
const pkg = JSON.parse(readFileSync(path.join(DESKTOP, "package.json"), "utf8"));
const APP_NAME = "1T Persona";
const BUNDLE_ID = "life.anone.onetrillion"; // never the anone.life app's id: two apps would share permissions and window position

if (process.env.ONE_T_RARE_ASSETS) throw new Error("unset ONE_T_RARE_ASSETS: the desktop build must not include local rare-person assets");

const TARGETS = {
  "mac-arm64": { platform: "darwin", arch: "arm64", out: `1T-Persona-macOS-AppleSilicon-${pkg.version}.zip` },
  "mac-x64": { platform: "darwin", arch: "x64", out: `1T-Persona-macOS-Intel-${pkg.version}.zip` },
  "win-x64": { platform: "win32", arch: "x64", out: `1T-Persona-Windows-x64-${pkg.version}.zip` },
};
const only = process.argv[2];
const picked = only ? [only] : Object.keys(TARGETS);
for (const k of picked) if (!TARGETS[k]) throw new Error(`unknown target ${k} (use ${Object.keys(TARGETS).join(" | ")})`);

// 1. the web app, built fresh, copied next to main.js
console.log("building the web app…");
execFileSync("npm", ["--workspace", "@1t-persona/web", "run", "build"], { cwd: REPO, stdio: "inherit" });
const web = path.join(DESKTOP, "web");
rmSync(web, { recursive: true, force: true });
cpSync(path.join(REPO, "apps", "web", "dist"), web, { recursive: true });

// 2. package, 3. zip
mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { files: {} };
manifest.version = pkg.version;
manifest.builtAt = new Date().toISOString();

for (const key of picked) {
  const t = TARGETS[key];
  console.log(`packaging ${key}…`);
  const [dir] = await packager({
    dir: DESKTOP,
    out: DIST,
    overwrite: true,
    name: APP_NAME,
    executableName: t.platform === "win32" ? "1T Persona" : undefined,
    platform: t.platform,
    arch: t.arch,
    appBundleId: BUNDLE_ID,
    appCategoryType: "public.app-category.entertainment",
    icon: path.join(DESKTOP, "build", t.platform === "darwin" ? "icon.icns" : "icon.ico"),
    asar: true,
    prune: true,
    ignore: [/^\/dist($|\/)/, /^\/release($|\/)/, /^\/scripts($|\/)/, /^\/build($|\/)/, /^\/smoke-out($|\/)/, /^\/node_modules($|\/)/, /\.gitignore$/, /\.md$/],
  });
  const outPath = path.join(OUT, t.out);
  rmSync(outPath, { force: true });
  if (t.platform === "darwin") {
    const app = `${APP_NAME}.app`;
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { cwd: dir, stdio: "inherit" });
    execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", app, outPath], { cwd: dir, stdio: "inherit" });
  } else {
    // a folder named "1T Persona" inside the zip, not loose files
    execFileSync("ditto", ["-c", "-k", "--keepParent", path.basename(dir), outPath], { cwd: path.dirname(dir), stdio: "inherit" });
  }
  const bytes = statSync(outPath).size;
  manifest.files[key] = { file: t.out, bytes, mb: +(bytes / 1048576).toFixed(1), sha256: createHash("sha256").update(readFileSync(outPath)).digest("hex") };
  console.log(`  → release/${t.out} (${manifest.files[key].mb} MB)`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("done: apps/desktop/release/");
