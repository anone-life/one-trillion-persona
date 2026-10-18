// 桌宠页 #/pet（第 21 步）：TA 站在桌面上，透明底；回复出在头顶的纸色气泡里；鼠标移到底部那一条才出输入台。
// 和网页是同一份代码：在桌宠外壳（apps/desktop）里窗口透明、点击穿透；在浏览器里打开 #/pet 也能看（开发、截图用）。
// 「轻桌宠」：不做主动开口、记忆、通话——想要的去 anone.life（右键菜单里有入口）。
//
// 外壳给的桥是 window.onetPet（apps/desktop/preload.js）：开关鼠标穿透、拖窗口、置顶 / 隐藏 / 退出。
// 没有桥（普通浏览器）时：不穿透、没有 ✥ 拖动键、菜单里没有「窗口」那一组。
// 样子照 anone.life 桌宠（web_companion/public/desktop.html）：深色半透明、朱红、明朝体。
import { anoneReady, listFaces, loadAnone, takeEmotion, type Face } from "./anone.ts";
import { Stage } from "./player.ts";
import { reply, speak, stopSpeaking } from "./talk.ts";
import { loadVoice, voiceReady } from "./voice.ts";
import { loadSettings, modelFrom, ready } from "./llm.ts";
import { RARE } from "./rare-data.ts";
import { rareCutout, rarePhoto } from "./rare/assets.ts";
import { importFile } from "./importer.ts";
import { loadPhoto } from "./photo.ts";
import { closingLine, directUrl, handOff, isLimited, isSpent, turnsLeft } from "./limit.ts";
import { fetchQuota, freeModel, rareCard, RareStop, rareStatus, usesFree, type RareChoice, type RareQuota } from "./rare-free.ts";
import { lang, t } from "./i18n.ts";
import { lastSyncError, lastSyncRejected, syncAnonePeopleOnce } from "./anone-people.ts";
import { DEMO_PEOPLE, playDemo } from "./demo.ts";
import { getCharacter, listCharacters, saveCharacter, type SavedCharacter } from "./store.ts";

export const RELEASES_URL = "https://github.com/anone-life/one-trillion-persona/releases";
const ANONE_URL = "https://www.anone.life/?ref=1t-pet";
/** Elise 的立绘（第 20 步同一张）：角色库是空的时候站在桌面上的是她。 */
const ELISE_PORTRAIT = "https://www.anone.life/home/02_disowned_heiress.webp";
const LAST = "1t.pet.character";

// ── 外壳的桥 ─────────────────────────────────────────────────────────────────

export interface PetBridge {
  setInteractive(on: boolean): void;
  startDrag(): void;
  endDrag(): void;
  /** 窗口那几件事：置顶开关、回到屏幕左边、隐藏、退出；"state" 只问现在置不置顶。 */
  app(cmd: "onTop" | "reset" | "hide" | "quit" | "state"): Promise<{ onTop: boolean }>;
}
declare global { interface Window { onetPet?: PetBridge } }

export const petBridge = (): PetBridge | null => window.onetPet ?? null;
export const inShell = () => !!window.onetPet;
if (inShell()) document.documentElement.dataset.shell = "desktop";

// ── 小工具 ──────────────────────────────────────────────────────────────────

type Child = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v as EventListener);
    else if (k === "class") e.className = String(v);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}
const go = (hash: string) => { location.hash = hash; };
const inside = (x: number, y: number, e: Element | null) => {
  if (!e || (e as HTMLElement).hidden) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

/** object-fit: contain + object-position: bottom center 时，画面在元素里实际占的那块。 */
export function containRect(box: { left: number; top: number; width: number; height: number }, natural: { w: number; h: number }) {
  const s = Math.min(box.width / natural.w, box.height / natural.h);
  const w = natural.w * s, h = natural.h * s;
  return { left: box.left + (box.width - w) / 2, top: box.top + box.height - h, width: w, height: h, scale: s };
}

/** 鼠标下那一点是不是人（不透明）。读不了像素（跨域没 CORS 的图）就按画面所占的矩形算。 */
class HitTest {
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  private imgPixels: ImageData | null = null;
  private imgFor: HTMLImageElement | null = null;

  at(x: number, y: number, media: HTMLImageElement | HTMLVideoElement | null): boolean {
    if (!media) return false;
    const natural = media instanceof HTMLImageElement ? { w: media.naturalWidth, h: media.naturalHeight } : { w: media.videoWidth, h: media.videoHeight };
    if (!natural.w || !natural.h) return false;
    const r = containRect(media.getBoundingClientRect(), natural);
    if (x < r.left || x > r.left + r.width || y < r.top || y > r.top + r.height) return false;
    const nx = Math.floor((x - r.left) / r.scale), ny = Math.floor((y - r.top) / r.scale);
    try {
      if (media instanceof HTMLImageElement) {
        // 图还没解码完就画，读到的全是透明——而且会被缓存住（线上版图在 CDN、来得慢，第一次判总是空的）：没完成就按矩形算、不缓存
        if (!media.complete) return true;
        if (this.imgFor !== media) {
          this.imgFor = media; this.imgPixels = null;
          this.canvas.width = natural.w; this.canvas.height = natural.h;
          this.ctx.drawImage(media, 0, 0);
          this.imgPixels = this.ctx.getImageData(0, 0, natural.w, natural.h);
        }
        if (!this.imgPixels) return true;
        return this.imgPixels.data[(ny * natural.w + nx) * 4 + 3]! > 24;
      }
      this.canvas.width = 1; this.canvas.height = 1;
      this.ctx.clearRect(0, 0, 1, 1);
      this.ctx.drawImage(media, nx, ny, 1, 1, 0, 0, 1, 1);
      return this.ctx.getImageData(0, 0, 1, 1).data[3]! > 24;
    } catch {
      return true; // 跨域读不了：按矩形算
    }
  }
}

// ── 台上放什么 ───────────────────────────────────────────────────────────────

type Figure =
  | { kind: "portrait"; src: string; crossOrigin: boolean }
  | { kind: "card"; src: string }
  | { kind: "live" }
  | { kind: "none"; note: string; action?: { label: string; href: string } };

function figureFor(c: SavedCharacter | null, liveReady: boolean): Figure {
  // 外壳给这张图补了 CORS 头（apps/desktop/main.js），桌宠里能按像素判穿透；普通浏览器里加 crossorigin 反而加载不出来
  if (!c) return { kind: "portrait", src: ELISE_PORTRAIT, crossOrigin: inShell() };
  if (c.rareId) {
    const cut = rareCutout(c.rareId);
    // 线上版的抠图在 CDN（另一个来源）：按 CORS 加载才读得了像素（点击穿透），CloudFront 回 `*`
    if (cut) return { kind: "portrait", src: cut, crossOrigin: /^https?:/.test(cut) };
    const photo = rarePhoto(c.rareId);
    if (photo) return { kind: "card", src: photo };
    return { kind: "none", note: t("rare.voiceOnly") };
  }
  if (c.avatarId) return liveReady ? { kind: "live" } : { kind: "none", note: t("pet.needKey", { name: c.name }), action: { label: t("pet.toSettings"), href: "#/settings?next=pet" } };
  // 自己造的人（第 23 步）：不换脸；上传过照片就是照片立牌，没有就是圆盘 + 去聊天页放一张
  const photo = loadPhoto(c.id);
  if (photo) return { kind: "card", src: photo };
  return { kind: "none", note: t("pet.noPhoto", { name: c.name }), action: { label: t("pet.addPhoto", { name: c.name }), href: `#/c/${c.id}` } };
}

// ── 页面 ─────────────────────────────────────────────────────────────────────

let teardown: (() => void) | null = null;
/** 重画之后要显示的一句（导入完重画整页，旧页面的气泡已经不在了） */
let flash = "";

export function petView(app: HTMLElement, id: string | null) {
  teardown?.();
  backBar?.remove(); backBar = null;
  // 同步下完 anone.life 的人以后会重拍（见下面 syncAnonePeopleOnce）——只拍一次的话，正选着别人时菜单永远停在「正在带过来」
  let all = listCharacters();
  let lastId: string | null = null;
  try { lastId = localStorage.getItem(LAST); } catch { /* 记不住就用第一个 */ }
  const c = (id && getCharacter(id)) || (lastId && getCharacter(lastId)) || all[0] || null;
  if (c) { try { localStorage.setItem(LAST, c.id); } catch { /* 无害 */ } }
  const bridge = petBridge();
  const anone = loadAnone();
  const settings = loadSettings();
  const fig = figureFor(c, anoneReady(anone));
  const stage = fig.kind === "live" ? new Stage({ crossOrigin: true }) : null;
  let face: Face | null = null;
  let busy = false;
  // 一期一会没填自己的模型：走 anone.life 的免费试聊（第 28 步），和聊天页同一套
  const free = !!c && usesFree(c);
  let quota: RareQuota | null = null;
  let stop: string | null = null;
  let pendingPick = false;
  const freeState = () => (stop ? ({ ok: false, code: stop } as const) : c ? rareStatus(c, quota, pendingPick) : ({ ok: true, pay: "default", hint: "" } as const));
  const freeBlocked = () => free && !freeState().ok;

  // ── 摆法照 anone.life 桌宠（web_companion/public/desktop.html 2026-10-11 那段）：TA 在上面一截不被挡；
  //    TA 说的话、提示、输入台都在 TA 下面那一条里；右上角深色圆钮 ✥ 拖动、⋯ 菜单。

  // 字幕：只留这一轮（你那句 + TA 那句），从下往上；说完 10 秒淡掉。提示是一行灰字，带按钮的提示是深色小卡、不淡。
  const transcript = el("div", { class: "pet-transcript" });
  let turn: { user?: string; her?: string; status?: string } = {};
  // choices：一期一会试聊卡住时的那张卡（第 28 步），几个按钮竖着排；有 action / choices 的提示都不淡
  let notes: { text: string; action?: { label: string; onclick: () => void }; choices?: RareChoice[]; sub?: string }[] = [];
  const lastLine = () => {
    const m = c ? [...c.chat].reverse().find((x) => x.role === "assistant") : null;
    return m ? takeEmotion(m.content).text : "";
  };
  const draw = () => {
    transcript.replaceChildren(
      ...(turn.user ? [el("div", { class: "msg msg--user" }, el("p", {}, turn.user))] : []),
      ...(turn.her && herLine(turn.her) ? [el("div", { class: "msg msg--char" }, herLine(turn.her)!)] : []),
      ...(turn.status ? [el("div", { class: "msg msg--status" }, el("p", {}, turn.status))] : []),
      ...notes.map((n) => n.choices
        ? el("div", { class: "msg pet-callout pet-callout--choices" }, el("span", {}, n.text),
            ...n.choices.map((x) => el("button", { type: "button", class: x.primary ? "" : "ghost", onclick: x.run }, x.label)),
            n.sub ? el("small", {}, n.sub) : null)
        : n.action
        ? el("div", { class: "msg pet-callout" }, el("span", {}, n.text), el("button", { type: "button", onclick: n.action.onclick }, n.action.label))
        : el("div", { class: "msg msg--sys" }, el("p", {}, n.text))),
    );
    transcript.style.opacity = "1";
    calmSince = 0;
  };
  // TA 那句话：*星号* 里是动作描写——开了「显示动作描写」排成灰色斜体（照 anone.life 桌宠 .narration），关着就不显示；动作从来不念
  const herLine = (text: string): HTMLElement | null => {
    const parts = text.split(/(\*[^*\n]+\*)/g).filter(Boolean);
    const show = !!c?.prefs?.actions;
    const kids: (string | HTMLElement)[] = parts.flatMap((x): (string | HTMLElement)[] => /^\*[^*]+\*$/.test(x) ? (show ? [el("span", { class: "narration" }, x.slice(1, -1))] : []) : [x]);
    const p = el("p", {}, ...kids);
    return p.textContent?.trim() ? p : null;
  };
  const note = (text: string, action?: { label: string; onclick: () => void }) => { notes = text ? [...notes.filter((n) => n.text !== text), { text, ...(action ? { action } : {}) }] : []; draw(); };

  // 「anone.life 的人」聊满 10 回合的收尾（第 25 步）：TA 口吻的一句 + 带着对话去 anone.life（桌宠外壳里由主进程交给系统浏览器）
  function spentNote() {
    const go2 = async () => {
      try { window.open(c!.handedOffAt ? directUrl(c!, anone) : await handOff(c!, anone), "_blank", "noopener"); petView(app, c!.id); }
      catch (e) { note(t("limit.fail", { msg: (e as Error).message })); }
    };
    return { text: closingLine(c!), action: { label: c!.handedOffAt ? t("limit.again") : t("limit.bring"), onclick: () => void go2() } };
  }

  // 台
  let media: HTMLImageElement | HTMLVideoElement | null = null;
  const figure = el("div", { class: "pet-fig", "data-kind": fig.kind });
  if (fig.kind === "portrait") {
    const img = el("img", { class: "pet-portrait", src: fig.src, alt: c?.name ?? "Elise", draggable: "false", ...(fig.crossOrigin ? { crossorigin: "anonymous" } : {}) });
    figure.append(img); media = img;
  } else if (fig.kind === "card") {
    figure.append(el("div", { class: "pet-card" }, el("img", { src: fig.src, alt: c!.name, draggable: "false" }), el("span", {}, c!.name)));
  } else if (fig.kind === "live" && stage) {
    figure.append(stage.el);
  } else if (fig.kind === "none") {
    figure.append(el("div", { class: "pet-disc" }, el("b", {}, c?.name ?? ""), el("span", {}, fig.note),
      fig.action ? el("a", { href: fig.action.href }, fig.action.label) : null));
  }

  // 右上角：✥ 拖动（只有外壳里有）、⋯ 菜单
  const MOVE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>';
  const moveBtn = el("button", { type: "button", class: "pet-btn pet-move", title: t("pet.move"), "aria-label": t("pet.move"), hidden: !bridge });
  moveBtn.innerHTML = MOVE_SVG;
  const moreBtn = el("button", { type: "button", class: "pet-btn", title: t("pet.more"), "aria-label": t("pet.more") }, "⋯");
  const topbar = el("div", { class: "pet-topbar" }, moveBtn, moreBtn);
  const menu = el("div", { class: "pet-menu", hidden: true });

  // 输入台：深色胶囊 + 朱红圆钮；隐藏 → 窥视（鼠标在底部停 200ms）→ 钉住（有焦点、有字、点过 TA）
  const box = el("textarea", { rows: "1", placeholder: !c ? "" : isLimited(c) && turnsLeft(c) <= 2 && turnsLeft(c) > 0 ? t("limit.left", { n: turnsLeft(c), name: c.name }) : t("char.placeholder", { name: c.name }) }) as HTMLTextAreaElement;
  const send = el("button", { class: "pet-send", type: "button", title: t("chat.send"), "aria-label": t("chat.send") }, "➤") as HTMLButtonElement;
  const composer = el("div", { class: "pet-composer", "data-state": "hidden" }, box, send);
  const file = el("input", { type: "file", accept: ".anone,.json,application/x-anone,application/zip,application/json", hidden: true }) as HTMLInputElement;
  const root = el("div", { class: "pet", "data-kind": fig.kind }, figure, topbar, transcript, composer, menu, file);

  document.body.dataset.layout = "pet";
  app.replaceChildren(root);

  // 一打开先给一句 TA 最后说的（3 秒后照样淡掉）；没准备好的提示留着
  if (c && lastLine()) turn = { her: lastLine() };
  if (flash) { notes = [{ text: flash }]; flash = ""; }
  else if (!c) notes = [{ text: t("pet.empty"), action: { label: t("pet.importFile"), onclick: () => file.click() } }];
  else if (c && isSpent(c)) notes = [spentNote()]; // 第 25 步：「anone.life 的人」聊满 10 回合 → 收尾卡，输入台不再唤出
  else if (!ready(settings) && !free) notes = [{ text: t("pet.needModel"), action: { label: t("pet.toSettings"), onclick: () => go("#/settings?next=pet") } }];
  let calmSince = 0;
  draw();
  /** 一期一会：照额度换输入框的提示，或者在字幕区出那张卡（卡住时输入台不唤出） */
  const applyFree = () => {
    if (!free || !c) return;
    const st = freeState();
    notes = notes.filter((n) => !n.choices);
    if (st.ok) { box.placeholder = st.hint || t("char.placeholder", { name: c.name }); draw(); return; }
    setState("hidden");
    const card = rareCard(st.code, c, quota, anone, {
      refresh: () => { stop = null; void fetchQuota(c, anone).then((q) => { quota = q; if (!q) stop = "offline"; applyFree(); }); },
      pick: () => { pendingPick = true; stop = null; applyFree(); },
      stamps: (on) => { c.prefs = { ...c.prefs, stamps: on }; saveCharacter(c); stop = null; applyFree(); },
      ownApi: () => go("#/settings?next=pet"),
      open: (url) => void window.open(url, "_blank", "noopener"),
    });
    notes = [...notes, { text: card.text, choices: card.choices, ...(card.note ? { sub: card.note } : {}) }];
    draw();
  };
  if (free && c) void fetchQuota(c, anone).then((q) => { quota = q; applyFree(); });

  // 第一次打开（有 anone.life key）把「anone.life 的人」下载下来；库原本是空的就切到第一位
  // 不管成功、失败还是 key 被拒，结束了就重拍名单、菜单开着就重画（2026-10-18：正选着奇人时四位下载完了菜单还停在「正在带过来」）
  void syncAnonePeopleOnce(anone, lang()).then((n) => {
    if (n && !c && /^#\/pet/.test(location.hash)) { petView(app, null); return; }
    all = listCharacters();
    if (!menu.hidden) buildMenu();
  });

  if (stage && c) {
    listFaces(anone).then((faces) => {
      face = faces.find((f) => f.id === c.avatarId) ?? null;
      stage.setFace(face);
      media = stage.current;
      if (!face) note(t("pet.faceGone"));
    }, (e) => note(t("face.loadFail", { msg: (e as Error).message })));
  }

  const HOT = 88, EXIT = 148, DWELL = 200;
  let dwell = 0, idleTimer = 0;
  let last = { x: -1, y: -1 };
  const setState = (s: "hidden" | "peek" | "pinned") => { composer.dataset.state = s; };
  const pinned = () => composer.dataset.state === "pinned" || document.activeElement === box || !!box.value.trim();
  const reveal = () => { if (composer.dataset.state === "hidden" && !(c && isSpent(c)) && !freeBlocked()) setState("peek"); };
  const conceal = () => { if (!pinned()) setState("hidden"); };
  box.addEventListener("focus", () => setState("pinned"));
  box.addEventListener("blur", () => { if (!box.value.trim()) setState(inside(last.x, last.y, composer) ? "peek" : "hidden"); });

  // 点击穿透：只有压在人身上、字上、右上角圆钮、露出来的输入台上才接鼠标；菜单开着、正在拖时整窗接
  let interactive: boolean | null = null;
  let locked = false;
  const setInteractive = (on: boolean) => { if (locked) on = true; if (on !== interactive) { interactive = on; bridge?.setInteractive(on); } };
  const hit = new HitTest();
  const onText = (x: number, y: number) => [...transcript.querySelectorAll(".msg p, .pet-callout")].some((e) => inside(x, y, e));
  const overSomething = (x: number, y: number) =>
    !menu.hidden || onText(x, y) || inside(x, y, moreBtn) || inside(x, y, moveBtn)
    || (composer.dataset.state !== "hidden" && inside(x, y, composer))
    || (fig.kind === "portrait" || fig.kind === "live" ? hit.at(x, y, fig.kind === "live" ? stage!.current : media) : inside(x, y, figure.firstElementChild));

  // 验收用（apps/desktop/scripts/smoke.js）：这一点接不接鼠标
  (window as unknown as { __1tPetHit?: (x: number, y: number) => boolean }).__1tPetHit = overSomething;

  // ✥ 按住就拖（和 anone.life 一样：页面自己接 pointerdown，主进程跟着光标挪；悬停变朱红）
  const stopDrag = () => { if (!moveBtn.classList.contains("dragging")) return; moveBtn.classList.remove("dragging"); locked = false; bridge?.endDrag(); };
  moveBtn.addEventListener("pointerdown", (e) => {
    if (!bridge || e.button !== 0) return;
    e.preventDefault();
    moveBtn.setPointerCapture(e.pointerId);
    moveBtn.classList.add("dragging");
    locked = true; setInteractive(true);
    bridge.startDrag();
  });
  moveBtn.addEventListener("pointerup", stopDrag);
  moveBtn.addEventListener("pointercancel", stopDrag);
  moveBtn.addEventListener("lostpointercapture", stopDrag);

  // ⋯ 菜单（右键 TA 也开这个）：TA（当前的人 · 换个人 ›）、1T Persona、窗口（外壳才有）
  let menuPage: "main" | "people" = "main";
  let onTop = true;
  const closeMenu = () => { if (menu.hidden) return; menu.hidden = true; menuPage = "main"; locked = false; setInteractive(overSomething(last.x, last.y)); };
  // 播音：打开那一刻把 TA 最后一句补念一遍，关掉就停（照 anone.life 桌宠 setBroadcast）
  const setVoice = (on: boolean) => {
    if (!c) return;
    c.prefs = { ...c.prefs, voice: on };
    saveCharacter(c);
    buildMenu();
    if (!on) { stopSpeaking(); stage?.stop(); stage?.idle(); return; }
    if (!voiceReady(loadVoice())) { note(t("chat.opt.voiceNoKey"), { label: t("pet.toSettings"), onclick: () => go("#/settings?next=pet") }); return; }
    const lastRaw = [...c.chat].reverse().find((x) => x.role === "assistant")?.content;
    if (!lastRaw || busy) return;
    busy = true;
    void speak(c, lastRaw, { face, stage, anone }, { status: () => {}, sys: (x) => note(x), redraw: () => {} }).finally(() => { busy = false; });
  };
  const buildMenu = () => {
    menu.replaceChildren();
    const row = (label: string, onClick: (() => void) | null, x: { sub?: string; toggle?: boolean; cls?: string; keep?: boolean } = {}) => {
      const b = el("button", { type: "button", class: x.cls }, el("span", {}, label),
        x.sub ? el("span", { class: "sub" }, x.sub) : null,
        x.toggle !== undefined ? el("span", { class: `tg${x.toggle ? " on" : ""}` }) : null);
      if (x.toggle !== undefined) { b.setAttribute("role", "switch"); b.setAttribute("aria-checked", String(x.toggle)); }
      if (onClick) b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); if (!x.keep) closeMenu(); });
      menu.append(b);
    };
    const label = (txt: string) => menu.append(el("div", { class: "label" }, txt));
    if (menuPage === "people") {
      row(t("pet.menu.back"), () => { menuPage = "main"; buildMenu(); }, { cls: "back", keep: true });
      // 分组（第 23 步）：anone.life 的人（会动）、奇人、你造的
      const groups: [string, SavedCharacter[]][] = [
        [t("lib.anoneTitle"), all.filter((x) => x.anoneId).sort((a, b) => a.anoneId!.localeCompare(b.anoneId!))],
        [t("rare.nav"), all.filter((x) => x.rareId)],
        [t("lib.mineTitle"), all.filter((x) => !x.anoneId && !x.rareId)],
      ];
      for (const [name, list] of groups) {
        const isAnone = name === t("lib.anoneTitle");
        if (!list.length && !isAnone) continue;
        label(name);
        for (const x of list) row(x.name, () => go(`#/pet/${x.id}`), { cls: x.id === c?.id ? "now" : "", ...(x.id === c?.id ? { sub: "✓" } : {}) });
        // 这一组空着时说清楚为什么：没填 key / 拉不下来（anone.life 那边还没开放、网络）/ 正在拉
        if (isAnone && !list.length) {
          // key 格式对但被 anone.life 拒了（401）和没填一样：出四位的演示和「去设置」，不能只剩一句报错
          const noKey = !anoneReady(anone) || lastSyncRejected;
          menu.append(el("div", { class: "pet-menu-note" }, !anoneReady(anone) ? t("lib.anoneNeedKey") : lastSyncRejected ? t("lib.anoneKeyRejected") : lastSyncError ? t("lib.anoneFailed", { msg: lastSyncError }) : t("lib.anoneLoading")));
          if (noKey) row(t("pet.toSettings"), () => go("#/settings?next=pet"), { sub: "›" });
          // 第 24 步：没 key 也能点这四位——TA 在桌面上走进来、请你去注册、讲完走出去
          if (noKey) for (const p of DEMO_PEOPLE) row(p.name[lang()], () => playDemo(p, (to) => { if (to === "settings") go("#/settings?next=pet"); }, { crossOrigin: true, variant: "pet" }), { sub: `▶ ${t("demo.watch")}` });
        }
      }
      row(t("pet.menu.import"), () => file.click(), { cls: "add" });
      return;
    }
    label("TA");
    if (c) row(c.name, () => { menuPage = "people"; buildMenu(); }, { cls: "now", keep: true, sub: `${t("pet.menu.switch")} ›` });
    else row(t("pet.menu.import"), () => file.click(), { cls: "add" });
    label("1T Persona");
    row(t("nav.model"), () => go("#/settings?next=pet"), { sub: "›" });
    row(t("pet.menu.library"), () => go("#/library"), { sub: "›" });
    row(t("pet.menu.anone"), () => window.open(ANONE_URL, "_blank", "noopener"), { sub: "anone.life ↗" });
    // 设置：和聊天页那两个开关是同一份（这个角色的 prefs，第 22 步），哪边改另一边都跟着
    if (c) {
      label(t("pet.menu.prefs"));
      row(t("pet.menu.voice"), () => setVoice(!c.prefs?.voice), { toggle: !!c.prefs?.voice, keep: true });
      row(t("pet.menu.actions"), () => { c.prefs = { ...c.prefs, actions: !c.prefs?.actions }; saveCharacter(c); draw(); buildMenu(); }, { toggle: !!c.prefs?.actions, keep: true });
    }
    if (bridge) {
      label(t("pet.menu.window"));
      row(t("pet.menu.onTop"), () => { void bridge.app("onTop").then((st) => { onTop = st.onTop; buildMenu(); }); }, { toggle: onTop, keep: true });
      row(t("pet.menu.reset"), () => void bridge.app("reset"));
      row(t("pet.menu.hide"), () => void bridge.app("hide"));
      row(t("pet.menu.quit"), () => void bridge.app("quit"), { cls: "back" });
    }
  };
  const openMenu = () => {
    menuPage = "main";
    buildMenu();
    menu.hidden = false;
    locked = true; setInteractive(true);
    if (bridge) void bridge.app("state").then((st) => { if (st.onTop !== onTop) { onTop = st.onTop; if (!menu.hidden) buildMenu(); } });
  };
  moreBtn.addEventListener("click", (e) => { e.stopPropagation(); if (menu.hidden) openMenu(); else closeMenu(); });


  const onMove = (e: MouseEvent) => {
    last = { x: e.clientX, y: e.clientY };
    const fromBottom = innerHeight - e.clientY;
    if (fromBottom <= HOT) { if (!dwell && composer.dataset.state === "hidden") dwell = window.setTimeout(() => { dwell = 0; reveal(); setInteractive(true); }, DWELL); }
    else { clearTimeout(dwell); dwell = 0; if (fromBottom > EXIT) conceal(); }
    setInteractive(overSomething(e.clientX, e.clientY));
    // 兜底：鼠标离开窗口时收不到事件，输入台会一直露着——停下 1.5 秒、又不在底部那条里，就收起
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => { if (innerHeight - last.y > HOT && !inside(last.x, last.y, composer)) conceal(); }, 1500);
  };
  // 点 TA 一下：输入台钉住、光标进去（拖交给 ✥）
  const onClickFigure = (e: MouseEvent) => {
    if (e.button !== 0 || !menu.hidden || inside(e.clientX, e.clientY, composer) || inside(e.clientX, e.clientY, topbar) || onText(e.clientX, e.clientY)) return;
    if (inside(e.clientX, e.clientY, figure) && overSomething(e.clientX, e.clientY)) { setState("pinned"); box.focus(); }
  };
  // 菜单外面按下就关（捕获阶段，不等 click；透明处的按下收不到，所以菜单开着时整窗接鼠标）
  const onDownAway = (e: PointerEvent) => { if (!menu.hidden && !inside(e.clientX, e.clientY, menu) && !inside(e.clientX, e.clientY, moreBtn)) closeMenu(); };
  const onLeave = () => { if (!locked) { conceal(); setInteractive(false); } };
  const onContext = (e: MouseEvent) => {
    if (inside(e.clientX, e.clientY, composer)) return;
    e.preventDefault();
    if (overSomething(e.clientX, e.clientY)) openMenu();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !menu.hidden) closeMenu(); };
  const onBlur = () => closeMenu();

  // 说完 10 秒淡掉（2026-10-18 用户定，anone.life 是 3 秒；轮询照 anone.life desktop.ts：不靠「说完那一下」排定时器——播音还在念、指针压在字上都要等）
  let fadeTimer = 0;
  const calmTick = window.setInterval(() => {
    const fading = !!(turn.user || turn.her || turn.status || notes.some((n) => !n.action && !n.choices));
    if (!fading) { calmSince = 0; return; }
    if (busy || onText(last.x, last.y)) {
      calmSince = 0;
      if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = 0; transcript.style.opacity = "1"; }
      return;
    }
    const now = Date.now();
    if (!calmSince) { calmSince = now; return; }
    if (now - calmSince < 10_000 || fadeTimer) return;
    transcript.style.opacity = "0";
    fadeTimer = window.setTimeout(() => { fadeTimer = 0; turn = {}; notes = notes.filter((n) => n.action || n.choices); draw(); }, 450);
  }, 400);

  // 拖文件进来：备份（导出全部）或 .anone
  const takeFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = await importFile(f);
      try { if (r.ids[0]) localStorage.setItem(LAST, r.ids[0]); } catch { /* 无害 */ }
      flash = t("pet.imported", { added: r.added, updated: r.updated });
      petView(app, r.ids[0] ?? null);
    } catch (e) { note(t("pet.importFail", { msg: (e as Error).message })); }
  };
  file.onchange = () => { void takeFile(file.files?.[0]); file.value = ""; };
  const onDragOver = (e: DragEvent) => { e.preventDefault(); setInteractive(true); root.dataset.drop = "1"; };
  const onDrop = (e: DragEvent) => { e.preventDefault(); delete root.dataset.drop; void takeFile(e.dataTransfer?.files[0]); };
  const onDragLeave = () => { delete root.dataset.drop; };

  // 发消息
  send.onclick = async () => {
    const text = box.value.trim();
    if (!text || busy || !c || turnsLeft(c) <= 0) return;
    if (!ready(loadSettings()) && !free) { note(t("pet.needModel"), { label: t("pet.toSettings"), onclick: () => go("#/settings?next=pet") }); return; }
    if (freeBlocked()) { applyFree(); return; }
    box.value = ""; box.blur(); setState("hidden");
    busy = true; send.disabled = true;
    notes = []; turn = { user: text };
    c.chat.push({ role: "user", content: text }); saveCharacter(c);
    let replied = false;
    draw();
    try {
      const model = free ? freeModel(c, anone, () => { const st = freeState(); return st.ok ? st.pay : "default"; }, (q) => { quota = q; }) : modelFrom(loadSettings());
      await reply(c, model, { face, stage, anone }, {
        // 只在等回复时显示「正在输入…」；回复到了就一直是那句话
        status: (s) => { if (replied) return; turn.status = s || undefined; draw(); },
        sys: (s) => note(s),
        redraw: () => { replied = true; turn = { user: text, her: lastLine() }; draw(); },
      });
      pendingPick = false; stop = null;
    } catch (e) {
      c.chat.pop(); saveCharacter(c); turn = { user: text };
      if (e instanceof RareStop) { stop = e.code; if (e.quota) quota = e.quota; box.value = text; }
    }
    finally { busy = false; send.disabled = false; turn.status = undefined; draw(); }
    if (free) applyFree();
    // 第 10 句回完：重画成收尾卡（TA 那句话照样留在字幕里）
    if (isSpent(c) && /^#\/pet/.test(location.hash)) { const said = turn.her; petView(app, c.id); if (said) { turn = { her: said }; draw(); } }
  };
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send.click(); } };

  const listeners: [EventTarget, string, EventListener, boolean?][] = [
    [document, "mousemove", onMove as EventListener], [document, "click", onClickFigure as EventListener],
    [document, "pointerdown", onDownAway as EventListener, true], [document, "mouseleave", onLeave],
    [document, "contextmenu", onContext as EventListener], [document, "keydown", onKey as EventListener], [window, "blur", onBlur],
    [document, "dragover", onDragOver as EventListener], [document, "drop", onDrop as EventListener], [document, "dragleave", onDragLeave],
  ];
  for (const [t0, ev, fn, cap] of listeners) t0.addEventListener(ev, fn, cap);
  teardown = () => {
    for (const [t0, ev, fn, cap] of listeners) t0.removeEventListener(ev, fn, cap);
    clearTimeout(dwell); clearTimeout(idleTimer); clearTimeout(fadeTimer); clearInterval(calmTick);
    stopDrag();
    stage?.stop();
    teardown = null;
  };
}

// 外壳里离开桌宠页（设置、角色库……）时顶上的一条：「← 回到桌面」，Esc 也行。这条也是拖窗口的地方。
// 2026-10-18 用户：「我点了 setting 之后，就回不去了」——原来回去的路只有导航里一个小小的「桌宠」。
let backBar: HTMLElement | null = null;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && inShell() && !/^#\/pet(\/|$)/.test(location.hash)) { e.preventDefault(); go("#/pet"); }
});

/** 离开桌宠页（去设置、角色库）时：拆掉监听，整窗恢复接鼠标——页面是不透明的普通页。 */
export function leavePet() {
  teardown?.();
  const bridge = petBridge();
  if (!bridge) return;
  bridge.setInteractive(true);
  if (!backBar) {
    backBar = el("div", { class: "shell-back" }, el("button", { type: "button", class: "btn primary", onclick: () => go("#/pet") }, t("pet.back")), el("span", {}, "Esc"));
    document.body.prepend(backBar);
  }
}
