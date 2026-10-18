// 1T Persona desktop shell (Electron main process).
//
// A transparent, frameless, always-on-top window (360×760, on the left of the screen) that loads the
// 1T web app's #/pet page. The page decides where the character is and turns click-through on and off,
// so clicks on empty space fall through to the desktop.
//
// The web app is served from inside the app (app://1t/), not from a server: the whole point of 1T is that
// your characters and keys stay on your computer. Set ONE_T_URL to load a dev server instead
// (e.g. ONE_T_URL=http://localhost:5190/#/pet).
//
// Adapted from anone.life's desktop pet shell (window flags, keep-on-screen, click-through, drag, Dock icon),
// and the page's look follows that pet too (apps/web/src/pet.ts),
// rewritten for this repo; synced 2026-10-18. Nothing here drives animation: the page plays the timeline
// anone.life sends (see docs/ANONE_API.md).

const { app, BrowserWindow, ipcMain, protocol, screen, session, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// app://1t/ — must be registered before ready. standard+secure so localStorage, fetch and CORS behave like https.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const WIN_WIDTH = 360;
const WIN_HEIGHT = 760;
const DEV_URL = process.env.ONE_T_URL || "";
const START_URL = DEV_URL || "app://1t/index.html#/pet";
const START_ORIGIN = new URL(START_URL).origin;

/** Where the built web app lives: packed next to this file as web/, or apps/web/dist while developing. */
function webRoot() {
  if (process.env.ONE_T_WEB_ROOT) return path.resolve(process.env.ONE_T_WEB_ROOT);
  const packed = path.join(__dirname, "web");
  return fs.existsSync(path.join(packed, "index.html")) ? packed : path.join(__dirname, "..", "web", "dist");
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

function serveApp(request) {
  const root = webRoot();
  let rel = decodeURIComponent(new URL(request.url).pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.normalize(path.join(root, rel));
  if (file !== root && !file.startsWith(root + path.sep)) return new Response("forbidden", { status: 403 });
  let target = file;
  try { if (!fs.statSync(file).isFile()) target = path.join(root, "index.html"); } catch { target = path.join(root, "index.html"); }
  try {
    return new Response(fs.readFileSync(target), { headers: { "content-type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream" } });
  } catch {
    return new Response(`1T Persona: the web app isn't built (looked in ${root}). Run npm run web:build.`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

// ── window position and "always on top", remembered between runs ────────────

const prefsFile = () => path.join(app.getPath("userData"), "window.json");
function readPrefs() {
  try { return JSON.parse(fs.readFileSync(prefsFile(), "utf8")); } catch { return {}; }
}
function writePrefs(patch) {
  try { fs.writeFileSync(prefsFile(), JSON.stringify({ ...readPrefs(), ...patch })); } catch { /* not fatal */ }
}

function keepOnScreen(pos) {
  const area = screen.getDisplayMatching({ ...pos, width: WIN_WIDTH, height: WIN_HEIGHT }).workArea;
  return {
    x: Math.round(Math.max(area.x, Math.min(pos.x, area.x + Math.max(0, area.width - WIN_WIDTH)))),
    y: Math.round(Math.max(area.y, Math.min(pos.y, area.y + Math.max(0, area.height - WIN_HEIGHT)))),
  };
}
function leftOfScreen() {
  const area = screen.getPrimaryDisplay().workArea;
  return keepOnScreen({ x: area.x + 8, y: area.y + Math.round((area.height - WIN_HEIGHT) / 2) });
}
function initialPosition() {
  const p = readPrefs();
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? keepOnScreen({ x: p.x, y: p.y }) : leftOfScreen();
}

let win = null;

function savePosition() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  writePrefs({ x, y });
}

function setOnTop(on) {
  if (!win) return;
  // "screen-saver" level keeps it above full-screen apps' windows too; false drops it to a normal window.
  if (on) win.setAlwaysOnTop(true, "screen-saver"); else win.setAlwaysOnTop(false);
  writePrefs({ onTop: on });
}

function createWindow() {
  const pos = initialPosition();
  win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x: pos.x,
    y: pos.y,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: false,
    resizable: false,
    fullscreenable: false,
    // Keep the Dock / taskbar icon: with it hidden, people who hide or close the window can't find it again.
    skipTaskbar: false,
    title: "1T Persona",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  setOnTop(readPrefs().onTop !== false);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  let saveTimer = null;
  win.on("move", () => { clearTimeout(saveTimer); saveTimer = setTimeout(savePosition, 250); });
  win.on("close", () => { clearTimeout(saveTimer); savePosition(); });

  // Only this app's own pages load in the window; links to anywhere else open in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin === START_ORIGIN) return;
    event.preventDefault();
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });
  // Safety net: on any page other than #/pet (settings, library…) the window always takes the mouse,
  // even if the page never got to say so — otherwise clicks would fall through a page you can see.
  win.webContents.on("did-navigate-in-page", (_e, url) => {
    if (!/^#\/pet(\/|$)/.test(new URL(url).hash)) win.setIgnoreMouseEvents(false);
  });
  // A transparent window that failed to load is invisible. Say so instead (only happens with ONE_T_URL).
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    const msg = `1T Persona couldn't load ${url} (${desc}).`;
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<body style="margin:0;font:14px -apple-system,sans-serif;background:#f4efe6;color:#1b1a17;padding:20px;border-radius:10px">${msg.replace(/</g, "&lt;")}</body>`)}`);
  });

  // Interactive until the page says otherwise, so a page that didn't load isn't a dead zone.
  void win.loadURL(START_URL);
}

// ── what the page asks for (preload.js exposes these as window.onetPet) ─────

ipcMain.on("pet:set-interactive", (_e, on) => {
  if (!win || win.isDestroyed()) return;
  // forward: true keeps mousemove coming while clicks fall through, so the page can tell when the pointer is over her.
  if (on) win.setIgnoreMouseEvents(false); else win.setIgnoreMouseEvents(true, { forward: true });
});

// Drag: the page calls drag-start when the mouse is pressed on her and moves; we follow the cursor until drag-end.
// (Not a CSS drag region: those swallow the mouse, so the page couldn't tell a click from a drag.)
let dragTimer = null;
function stopDrag() {
  if (!dragTimer) return;
  clearInterval(dragTimer);
  dragTimer = null;
  savePosition();
}
ipcMain.on("pet:drag-start", () => {
  if (!win || win.isDestroyed()) return;
  clearInterval(dragTimer);
  const start = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  dragTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return stopDrag();
    const now = screen.getCursorScreenPoint();
    win.setPosition(wx + now.x - start.x, wy + now.y - start.y);
  }, 16);
});
ipcMain.on("pet:drag-end", stopDrag);

/** Window things the page's ⋯ menu can ask for (the menu itself is drawn by the page, like anone.life's pet). */
ipcMain.handle("pet:app", (_e, cmd) => {
  if (!win || win.isDestroyed()) return { onTop: false };
  if (cmd === "onTop") setOnTop(!win.isAlwaysOnTop());
  else if (cmd === "reset") { const p = leftOfScreen(); win.setPosition(p.x, p.y); savePosition(); }
  else if (cmd === "hide") win.hide();
  else if (cmd === "quit") setTimeout(() => app.quit(), 0);
  return { onTop: win.isAlwaysOnTop() };
});

// ── app lifecycle ────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    protocol.handle("app", serveApp);
    // Elise's portrait on anone.life comes without a CORS header, so the page can't read its pixels to tell
    // "on her" from "empty space". Add the header for that one folder of images (read-only, public files).
    session.defaultSession.webRequest.onHeadersReceived({ urls: ["https://www.anone.life/home/*"] }, (details, done) => {
      done({ responseHeaders: { ...details.responseHeaders, "access-control-allow-origin": ["*"] } });
    });
    createWindow();
    // Clicking the Dock icon brings a hidden window back.
    app.on("activate", () => {
      if (win && !win.isDestroyed()) win.show();
      else createWindow();
    });
  });
  // Closing the window doesn't quit on macOS (the Dock icon stays); elsewhere it does.
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
