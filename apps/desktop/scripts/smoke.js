// Smoke test for the desktop shell: runs the real main.js in a throwaway profile, plays a list of steps
// against the window (run JS in the page, move the mouse, wait, take a screenshot) and writes a log.
//   ONE_T_SMOKE_STEPS=steps.json ONE_T_SMOKE_OUT=out/ npx electron scripts/smoke.js
// Steps: { "js": "..." } | { "wait": ms } | { "shot": "name.png" } | { "move": [x, y] } | { "down" / "up": [x, y] }
//        | { "click": [x, y], "button"?: "left"|"right" } | { "key": "Escape" } | { "size": [w, h] } | { "reload": true }
// The log records every click-through switch the page asked for, so you can check where clicks fall through.
// Not packed into the app (scripts/ is ignored by pack.mjs).
const { app, ipcMain, BrowserWindow } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");

const steps = JSON.parse(fs.readFileSync(process.env.ONE_T_SMOKE_STEPS, "utf8"));
const out = path.resolve(process.env.ONE_T_SMOKE_OUT || "smoke-out");
fs.mkdirSync(out, { recursive: true });
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "1t-smoke-")));

const log = [];
const note = (entry) => { log.push({ t: Date.now(), ...entry }); };
ipcMain.on("pet:set-interactive", (_e, on) => note({ interactive: !!on }));
ipcMain.on("pet:drag-start", () => note({ drag: "start" }));
ipcMain.on("pet:drag-end", () => note({ drag: "end" }));

require("../main.js");

let wc0 = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  let win = null;
  for (let i = 0; i < 100 && !win; i++) { win = BrowserWindow.getAllWindows()[0] ?? null; await sleep(50); }
  // 挪开一点：用户自己的桌宠也开着、也在左边置顶时，两扇窗叠在一起，被盖住的那扇 Chromium 不再画、视频也会停（截图拿到的是旧画面）
  win.setPosition(420, 40);
  wc0 = win.webContents; wc0.setBackgroundThrottling(false);
  const wc = win.webContents;
  wc.on("console-message", (e) => note({ console: `${e.level}: ${e.message}` }));
  await new Promise((r) => (wc.isLoading() ? wc.once("did-finish-load", r) : r()));
  await sleep(800);
  for (const s of steps) {
    try {
      if (s.js) note({ js: s.js.slice(0, 80), result: await wc.executeJavaScript(s.js, true) });
      else if (s.wait) await sleep(s.wait);
      else if (s.reload) { wc.reload(); await new Promise((r) => wc.once("did-finish-load", r)); await sleep(800); }
      else if (s.move) { wc.sendInputEvent({ type: "mouseMove", x: s.move[0], y: s.move[1] }); await sleep(30); }
      else if (s.size) { win.setResizable(true); win.setSize(s.size[0], s.size[1]); await sleep(400); }
      else if (s.down) { wc.sendInputEvent({ type: "mouseDown", x: s.down[0], y: s.down[1], button: "left", clickCount: 1 }); await sleep(30); }
      else if (s.up) { wc.sendInputEvent({ type: "mouseUp", x: s.up[0], y: s.up[1], button: "left", clickCount: 1 }); await sleep(30); }
      else if (s.key) { wc.sendInputEvent({ type: "keyDown", keyCode: s.key }); wc.sendInputEvent({ type: "keyUp", keyCode: s.key }); await sleep(50); }
      else if (s.click) {
        const button = s.button || "left";
        wc.sendInputEvent({ type: "mouseDown", x: s.click[0], y: s.click[1], button, clickCount: 1 });
        wc.sendInputEvent({ type: "mouseUp", x: s.click[0], y: s.click[1], button, clickCount: 1 });
        await sleep(100);
      } else if (s.shot) {
        // 窗口被别的窗口盖住时 Chromium 不重画，capturePage 会拿到上一步的画面：先顶到最前、强制重画
        win.moveTop(); wc.invalidate(); await sleep(250);
        const img = await wc.capturePage();
        fs.writeFileSync(path.join(out, s.shot), img.toPNG());
        note({ shot: s.shot, bounds: win.getBounds(), onTop: win.isAlwaysOnTop() });
      }
    } catch (e) { note({ step: s, error: String(e) }); }
  }
  fs.writeFileSync(path.join(out, "log.json"), JSON.stringify(log, null, 1));
  app.exit(0);
});
