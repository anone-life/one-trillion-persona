// 「anone.life 的人」的登场演示（第 24 步）：没填 anone.life key 时点这四位，
// TA 从左边走进来、亲口请你去 anone.life 注册拿一把 key，讲完走出去，留两个按钮。
//
// 一切都是 anone.life 事先做好的演示包（`<anone>/1t_demo/<套>/demo.<lang>.json` + 四段 mp3，
// web_companion/scripts/build_1t_demo.mts）：声音是 TA 在 anone.life 的嗓子，时间表按片子里开始动嘴的时刻算好。
// 运行时不调任何 /v1/1t 接口、不要 key、不花钱，也不发任何东西给 anone.life（只是下载几个静态文件）。
import { lang, t } from "./i18n.ts";
import { loadAnone, type Emotion, type Face, type TimelineEvent } from "./anone.ts";
import { Stage } from "./player.ts";

type L = "en" | "zh" | "ja";
type L3 = Record<L, string>;
export interface DemoPerson { id: string; set: string; gender: "female" | "male"; name: L3; tagline: L3 }

/** 四位是谁：名字和一句话在 anone.life 首页本来就公开；人设不在这里（有 key 才下载，第 23 步）。 */
export const DEMO_PEOPLE: DemoPerson[] = [
  { id: "02_disowned_heiress", set: "02_disowned_heiress", gender: "female", name: { en: "Elise", zh: "Elise", ja: "Elise" },
    tagline: { en: "A proud heiress who waits up for you", zh: "嘴硬心软的豪门千金，深夜只等你回消息", ja: "強がりで寂しがりな令嬢、夜はあなたの返事を待っている" } },
  { id: "24_yui", set: "24_yui", gender: "female", name: { en: "Yui", zh: "由衣", ja: "由衣" },
    tagline: { en: "Your wife of six months, leaves the light on for you", zh: "新婚半年的妻子，灯亮着等你回家", ja: "結婚半年の妻、明かりをつけて帰りを待ってる" } },
  { id: "15_minato_ritsu", set: "15_minato_ritsu_v2", gender: "male", name: { en: "Ritsu Minato", zh: "湊 律", ja: "湊 律" },
    tagline: { en: "A quiet illustrator who remembers it all", zh: "寡言绘本插画师，你说过的他都记得", ja: "口数の少ない絵本作家、あなたの話は全部覚えている" } },
  // 第四位 2026-10-18 由颯换成晴（根文档仓库 docs/1T-persona/steps/step24_anone_demo_entrance.md「换人」）
  { id: "22_nanase_haru", set: "22_nanase_haru", gender: "male", name: { en: "Haru Nanase", zh: "七瀬 晴", ja: "七瀬 晴" },
    tagline: { en: "A younger idol, yours after the show", zh: "年下偶像，台上属于大家，夜里只对你撒娇", ja: "年下アイドル、ステージの後はあなたにだけ甘える" } },
];

/** 注册入口带来源：`f=1t`（anone.life 首页认）+ 是哪一位请你来的。不带任何用户数据。 */
/** 来源标记 `f=1t-<角色编号>`：只用小写字母数字和连字符，anone.life 四条注册路（含 Google / LINE）都原样记进台账（第 26 步漏斗）。 */
export const signupUrl = (p: DemoPerson) => `https://www.anone.life/?f=1t-${p.id.slice(0, 2)}`;

/**
 * 演示的匿名事件（第 26 步漏斗）：只在 anone.life 托管的那份（/1t/，同域）上发，开源版在别的域名上一律不发。
 * 借 anone.life 的 /api/film-plays：不记 IP、UA、账号，只带浏览器里随机的一个 id（和 1t-visit.js 同一个）。
 */
function track(p: DemoPerson, event: "open" | "end" | "close" | "signup" | "havekey", sec?: number): void {
  if (import.meta.env.BASE_URL !== "/1t/") return;
  try {
    let v = localStorage.getItem("anone.filmViewer") ?? "";
    if (!/^[a-z0-9]{8,32}$/.test(v)) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join("");
      localStorage.setItem("anone.filmViewer", v);
    }
    void fetch("/api/film-plays", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ film: `t04_demo_${p.id.slice(0, 2)}`, event, page: "1t", lang: lang(), v,
        surface: matchMedia("(max-width: 860px)").matches ? "phone" : "web", ...(sec !== undefined ? { sec } : {}) }),
    }).catch(() => undefined);
  } catch { /* 记不上就算了 */ }
}
// 本地开发时可以在这个标签页里 `sessionStorage.setItem("1t.demoBase", "http://localhost:5180")` 指到本机的 anone.life（演示包还没部署时验收用）。
const devBase = (): string | null => { try { return import.meta.env.DEV ? sessionStorage.getItem("1t.demoBase") : null; } catch { return null; } };
const anoneBase = () => (devBase() ?? loadAnone().base).replace(/\/+$/, "");
export const demoPoster = (p: DemoPerson) => `${anoneBase()}/avatar/${p.set}/poster.jpg`;

interface Transition { clip: string; clipMs: number; audio: string; audioAtMs: number; speechMs: [number, number]; text: string }
interface Pack {
  v: 1; set: string; lang: L;
  face: { id: string; path: string; formats: string[]; clips: Face["clips"] };
  enter: Transition; exit: Transition;
  lines: { text: string; emotion: Emotion; audio: string; onsetMs: number; durationMs: number; timeline: TimelineEvent[] }[];
}

type Kid = Node | string | null;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 一张卡：海报、名字、一句话、「看 TA 登场」。点了就放演示。 */
export function demoCard(p: DemoPerson, opts: { onDone?: (to: "settings" | null) => void } = {}): HTMLElement {
  const L = lang();
  const card = el("article", { class: "demo-card", tabindex: "0", role: "button", "aria-label": `${p.name[L]} · ${t("demo.watch")}` },
    el("div", { class: "dc-img" }, el("img", { src: demoPoster(p), alt: "", loading: "lazy" }), el("span", { class: "dc-play" }, `▶ ${t("demo.watch")}`)),
    el("div", { class: "dc-body" }, el("h3", {}, p.name[L]), el("div", { class: "dc-tag" }, p.tagline[L])));
  const open = () => playDemo(p, opts.onDone);
  card.onclick = open;
  card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
  return card;
}

/**
 * 放演示：全屏一层，入场 → 两句引导 → 出场 → 两个按钮。
 * 必须在一次点击里调（要在第一个 await 之前解锁声音）。
 */
export function playDemo(p: DemoPerson, onDone?: (to: "settings" | null) => void, opts: { crossOrigin?: boolean; host?: HTMLElement; variant?: "pet" } = {}): void {
  const L = lang();
  const stage = new Stage({ crossOrigin: opts.crossOrigin });
  stage.unlock();
  let over = false;
  const t0 = performance.now();
  let ended = false; // 自己放完到收尾卡（end），还是中途跳过 / 关掉（close + 看了几秒）
  const leftEarly = () => { if (!ended) { ended = true; track(p, "close", Math.round((performance.now() - t0) / 1000)); } };
  track(p, "open");
  const sub = el("div", { class: "demo-sub", "aria-live": "polite" });
  const skip = el("button", { type: "button", class: "demo-skip" }, t("demo.skip"));
  const close = el("button", { type: "button", class: "demo-close", "aria-label": t("demo.close") }, "×");
  const cta = el("div", { class: "demo-cta", hidden: "" });
  const box = el("div", { class: "demo-box" }, el("div", { class: "demo-stage" }, stage.el), sub, cta, skip, close);
  // 桌宠：透明窗口上直接演（不压暗、不加底色），演的时候把原来那位藏起来
  const layer = el("div", { class: `demo-layer${opts.variant === "pet" ? " pet" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": p.name[L] }, box);
  (opts.host ?? document.body).append(layer);
  if (opts.variant === "pet") document.body.classList.add("demo-on");
  const finish = (to: "settings" | null) => { over = true; stage.stop(); layer.remove(); document.body.classList.remove("demo-on"); document.removeEventListener("keydown", esc); onDone?.(to); };
  const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { leftEarly(); finish(null); } };
  document.addEventListener("keydown", esc);
  close.onclick = () => { leftEarly(); finish(null); };
  layer.onclick = (e) => { if (e.target === layer) { leftEarly(); finish(null); } };

  const showCta = () => {
    over = true;
    stage.stop();
    skip.hidden = true;
    sub.textContent = "";
    box.classList.add("ended");
    const signup = el("a", { class: "btn primary demo-signup", href: signupUrl(p), target: "_blank", rel: "noopener" }, t("demo.signup"));
    const have = el("button", { type: "button", class: "btn" }, t("demo.haveKey"));
    signup.addEventListener("click", () => track(p, "signup"));
    have.onclick = () => { track(p, "havekey"); finish("settings"); };
    const again = el("button", { type: "button", class: "btn-link" }, t("demo.again"));
    again.onclick = () => { layer.remove(); document.body.classList.remove("demo-on"); document.removeEventListener("keydown", esc); playDemo(p, onDone, opts); };
    cta.replaceChildren(
      el("img", { class: "demo-cta-face", src: demoPoster(p), alt: "" }),
      el("h3", {}, t("demo.ctaTitle", { name: p.name[L] })),
      el("p", {}, t("demo.ctaBody")),
      el("div", { class: "row" }, signup, have),
      again);
    cta.hidden = false;
    signup.focus();
  };
  skip.onclick = () => { leftEarly(); showCta(); };

  void (async () => {
    sub.textContent = "…";
    const root = `${anoneBase()}/1t_demo/${encodeURIComponent(p.set)}/`;
    let pack: Pack, audio: Map<string, ArrayBuffer>;
    try {
      pack = (await (await fetch(`${root}demo.${L}.json`)).json()) as Pack;
      const files = [pack.enter.audio, ...pack.lines.map((x) => x.audio), pack.exit.audio];
      audio = new Map(await Promise.all(files.map(async (f) => [f, await (await fetch(root + f)).arrayBuffer()] as const)));
    } catch {
      if (!over) { showCta(); cta.prepend(el("p", { class: "muted" }, t("demo.fail"))); }
      return;
    }
    if (over) return;
    const face: Face = { id: pack.face.id, label: p.name[L], gender: p.gender, voice: "", base: `${anoneBase()}${pack.face.path}`, poster: demoPoster(p), formats: pack.face.formats, clips: pack.face.clips };
    stage.setFace(face, false);
    // 入场那 10 秒里把后面要用的片子整段下进浏览器缓存（片子 immutable；每段 1–2MB）：第一次来的人 CDN 是冷的，
    // 不先下，说话片子会比声音晚半秒（线上实测 312–703ms，第 24 步）。藏着的 <video preload> 只缓冲一小段，不够。
    // 要 anone.life 的 /avatar/ 那一跳 302 带跨域头（web_companion server.ts，2026-10-18 加的），别的域名上的开源版才下得了。
    const later = [...new Set([...pack.lines.flatMap((x) => x.timeline.slice(1).map((e) => stage.clipUrl(e.clip, e.fallback))), stage.clipUrl(pack.exit.clip)])];
    const warm = Promise.all(later.map((u) => fetch(u).then((r) => r.arrayBuffer()).catch(() => null)));
    const warmed = () => Promise.race([warm, sleep(4000)]);
    sub.textContent = "";

    // 字幕：跟着每句开口出、说完留一会儿
    const timers: number[] = [];
    const caption = (text: string, atMs: number) => () => { timers.push(window.setTimeout(() => { if (!over) sub.textContent = text; }, atMs)); };
    const tr = async (x: Transition) => {
      await stage.playOnce(x.clip, audio.get(x.audio)!, x.audioAtMs, x.clipMs, caption(x.text, x.speechMs[0]));
    };
    await tr(pack.enter);
    await warmed();
    for (const line of pack.lines) {
      if (over) return;
      await sleep(250);
      if (over) return;
      await stage.playBytes(audio.get(line.audio)!, line.timeline, line.onsetMs, caption(line.text, line.onsetMs));
    }
    if (over) return;
    await sleep(300);
    if (over) return;
    await tr(pack.exit);
    if (!over) { ended = true; track(p, "end"); showCta(); }
  })();
}
