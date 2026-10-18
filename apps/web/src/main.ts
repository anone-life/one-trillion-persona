// One-Trillion Persona 网页版。页面：选维度 → 看陌生人 → 和 Elise 聊 → 写人设 → 结果 → 角色库 → 和角色聊。
// 结构见 docs/ARCHITECTURE.md。
import "./app.css";
import {
  ALL_LAYERS, BIRTHPLACES, DEFAULT_ASK, LAYERS, buildSkeleton, countryLabel, describe, formatSeed, layerCount, localizedLayers,
  REMOVABLE_LAYERS, parseSeed, placeById, placeLabel, randomSeed, rebuildSkeleton, type Skeleton,
} from "@1t-persona/core";
import {
  DESIGNER_NAME, DesignerSession, finalize, generatePersona, generateSchedule,
} from "@1t-persona/designer/browser";
import { cardInputFromPersona, packAnone, toCardV2 } from "@1t-persona/files";
import { makeBackup } from "./backup.ts";
import { importFile } from "./importer.ts";
import { inShell, leavePet, petView } from "./pet.ts";
import { desktopDownload } from "./desktop-download.ts";
import { DEV_PROXY, PRESETS, loadSettings, modelFrom, ready, saveSettings, type Settings } from "./llm.ts";
import { anoneReady, listFaces, loadAnone, resetFaces, saveAnone, takeEmotion, type AnoneSettings, type Face } from "./anone.ts";
import { GROK_ONLY, VOICES, defaultVoice, loadVoice, saveVoice, voiceReady, type VoiceProvider } from "./voice.ts";
import { reply } from "./talk.ts";
import { loadPhoto, removePhoto, savePhoto, shrinkPhoto } from "./photo.ts";
import { lastSyncError, lastSyncRejected, syncAnonePeopleOnce } from "./anone-people.ts";
import { closingLine, directUrl, handOff, isLimited, isSpent, turnsLeft } from "./limit.ts";
import { fetchQuota, freeModel, rareCard, RareStop, rareStatus, usesFree, type RareCard, type RareQuota } from "./rare-free.ts";
import { DEMO_PEOPLE, demoCard } from "./demo.ts";
import { Stage } from "./player.ts";
import { aboutContent } from "./about.ts";
import { rareContent, rareProfile } from "./rare.ts";
import { RARE, type Rare } from "./rare-data.ts";
import { hasRarePersona, loadRarePersona, rarePhoto } from "./rare/assets.ts";
import { rareSkeleton } from "./rare/skeleton.ts";
import { RARE_CONTEXT } from "./rare/context.ts";
import { RARE_NAMES } from "./rare/names.ts";
import { retunePanel } from "./retune.ts";
import { clipCard, clipStrip } from "./promo.ts";
import { LANG_NAME, LANG_OPTIONS, fmtCount, joinList, lang, scaleTicks, setLang, t } from "./i18n.ts";
import {
  deleteCharacter, getCharacter, listCharacters, loadDraft, saveCharacter, saveDraft, type SavedCharacter,
} from "./store.ts";

// ── 小工具 ──────────────────────────────────────────────────────────────────

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "class") el.className = String(v);
    else if (k === "html") el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
const app = document.getElementById("app")!;
const go = (hash: string) => { location.hash = hash; };
function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** 去掉句末标点，拼进句子时不出现「..」。 */
const bare = (s: string) => s.trim().replace(/[.。!！?？…]+$/u, "");
const fileBase = (name: string) => name.replace(/[^\p{L}\p{N}_ -]+/gu, "").trim() || "character";

function masthead(active: string) {
  const link = (href: string, label: string) => h("a", { href, "aria-current": active === href ? "page" : undefined }, label);
  return h("div", { class: "masthead" },
    h("a", { class: "mark", href: "#/about", "aria-label": "あのね" }),
    h("div", { class: "by" }, h("b", {}, "あのね"), "  open source 01"),
    // 奇人排第一、介绍改叫「怎么做的」排后面（第 27 步）；手机上这一排横向滑动，不折行
    h("nav", {}, inShell() ? link("#/pet", t("pet.nav")) : null, link("#/rare", t("nav.rare")), link("#/", t("nav.new")), link("#/library", t("nav.library")), link("#/about", t("nav.about")), link("#/settings", t("nav.model")),
      h("span", { class: "langs" }, ...LANG_OPTIONS.map((o) => h("button", {
        class: `lang${o.id === lang() ? " on" : ""}`, "aria-pressed": String(o.id === lang()),
        onclick: () => { if (o.id !== lang()) { setLang(o.id); route(); } },
      }, o.label)))),
  );
}
function page(active: string, ...children: Child[]) {
  delete document.body.dataset.layout;
  app.replaceChildren(h("div", { class: "wrap" }, masthead(active), ...children));
  window.scrollTo(0, 0);
}

// ── 聊天的台（第 20 步）：照 anone.life 的版式——桌面左台右聊，手机台铺满、聊天浮在上面 ──

/** Elise 的立绘：只借 anone.life 那位的脸（透明底、静态），图不进本仓库，直接引用线上那张。 */
const ELISE_PORTRAIT = "https://www.anone.life/home/02_disowned_heiress.webp";
/** 台上放什么：透明底立绘（站在砂紋圆盘上）、照片（铺满）、或什么都没有（只留圆盘和一行字）。 */
type Backdrop = { kind: "portrait"; src: string } | { kind: "photo"; src: string } | { kind: "none"; note?: string };

function stagePage(active: string, o: { name: string; backdrop: Backdrop; live?: HTMLElement; scroll: Child[]; composer: HTMLElement }) {
  const b = o.backdrop;
  const art = b.kind === "portrait" ? h("img", { class: "cs-portrait", src: b.src, alt: o.name, decoding: "async" })
    : b.kind === "photo" ? h("img", { class: "cs-photo", src: b.src, alt: o.name, decoding: "async" })
    : b.note ? h("div", { class: "cs-note" }, b.note) : null;
  document.body.dataset.layout = "stage";
  delete document.body.dataset.transcript;
  // 照 anone.life（.stage-header）：台的左上角是名字，右上角一个「⋯」；站点导航收进「⋯」里那张小卡，不再占顶上一整条
  const menu = h("div", { class: "cs-menu", hidden: true }, masthead(active));
  const more = h("button", { class: "cs-more", type: "button", "aria-label": t("pet.more"), "aria-expanded": "false" }, "⋯");
  const close = (e: Event) => { if (!menu.contains(e.target as Node) && e.target !== more) { menu.hidden = true; more.setAttribute("aria-expanded", "false"); document.removeEventListener("pointerdown", close, true); } };
  more.onclick = () => {
    menu.hidden = !menu.hidden;
    more.setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) document.addEventListener("pointerdown", close, true);
  };
  // 手机上平时只露最后一轮，点这根横条展开整段（anone.life 的 .transcript-toggle）；桌面不显示
  const toggle = h("button", { class: "cs-toggle", type: "button", "aria-label": t("chat.history") }, h("span", { class: "grabber" }));
  toggle.onclick = () => {
    if (document.body.dataset.transcript === "expanded") delete document.body.dataset.transcript; else document.body.dataset.transcript = "expanded";
    const s = app.querySelector<HTMLElement>(".cs-scroll"); if (s) s.scrollTop = s.scrollHeight;
  };
  app.replaceChildren(h("div", { class: "cs" },
    h("div", { class: "cs-main" },
      h("section", { class: "cs-stage", "data-kind": b.kind }, art, o.live),
      h("section", { class: "cs-chat" }, h("div", { class: "cs-scroll" }, ...o.scroll), toggle, o.composer),
      // 顶栏压在台上，但不放在台里面：台自成一层，手机上聊天层盖在台上面，「⋯」的小卡会被聊天层挡住
      h("header", { class: "cs-head" }, h("h1", { class: "cs-name" }, o.name), h("div", { class: "cs-controls" }, more, menu)))));
}
/** 新消息之后滚到底：台版式滚聊天栏，其余滚整页。 */
function scrollChat(log: HTMLElement) {
  const s = log.closest<HTMLElement>(".cs-scroll");
  if (s) s.scrollTop = s.scrollHeight; else window.scrollTo(0, document.body.scrollHeight);
}

// ── 状态 ────────────────────────────────────────────────────────────────────

const state = {
  ask: new Set<string>(DEFAULT_ASK),
  seedText: "",
  // 开聊前必填的四项（docs：根仓库 docs/1T-persona/steps/step8_birth_required.md）
  gender: "" as "" | "masculine" | "feminine", // 必选（step14_gender_required.md）
  birthDate: "",
  birthTime: "",
  birthPlace: "",
  residence: "",
  removed: [] as string[], // 陌生人页整层删掉的，「再抽一个」时沿用（step15）
};

/** 首页表单只在内存里；从草稿补回来（刷新后、从陌生人页回首页时用）。 */
function restoreBasics(k: Skeleton) {
  const g = k.overrides["body.gender_present"];
  if (g === "feminine" || g === "masculine") state.gender = g;
  if (k.birth) {
    const [date, time] = k.birth.wall.split(" ");
    state.birthDate = date ?? ""; state.birthTime = time ?? "";
    if (k.birth.place && placeById(k.birth.place.id)) state.birthPlace = k.birth.place.id;
  }
  const city = k.overrides["world.city"];
  if (city) state.residence = city;
  state.ask = new Set(k.ask);
  state.removed = [...(k.removed ?? [])];
}

const CITIES = LAYERS.find((l) => l.id === "world")!.fields.find((f) => f.id === "city")!.values;

/** 四项里还没填的，按表单顺序。 */
function missingBasics(): string[] {
  const out: string[] = [];
  if (!state.gender) out.push(t("missing.gender"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.birthDate)) out.push(t("missing.date"));
  if (!/^\d{2}:\d{2}$/.test(state.birthTime)) out.push(t("missing.time"));
  if (!placeById(state.birthPlace)) out.push(t("missing.place"));
  if (!CITIES.some((c) => c.id === state.residence)) out.push(t("missing.home"));
  return out;
}

/** 首页每一层的显示文字（按当前语言）。 */
function layerText(): Record<string, { name: string; what: string; parts: string[]; ask: string }> {
  const out: Record<string, { name: string; what: string; parts: string[]; ask: string }> = {
    bazi: { name: t("layer.bazi.name"), what: t("layer.bazi.what"), parts: [t("chip.year"), t("chip.month"), t("chip.day"), t("chip.hour")], ask: t("layer.bazi.ask") },
  };
  for (const l of localizedLayers(lang())) {
    out[l.id] = { name: l.name, what: l.blurb, parts: l.fields.map((f) => `${lang() === "en" ? f.label.toLowerCase() : f.label} ${f.values.length}`), ask: t("layer.ask", { layer: lang() === "en" ? l.name.toLowerCase() : l.name }) };
  }
  return out;
}

function makeSkeleton(): Skeleton {
  let seed: bigint;
  try { seed = state.seedText.trim() ? parseSeed(state.seedText) : randomSeed(); } catch (e) { throw new Error((e as Error).message); }
  state.seedText = formatSeed(seed);
  const missing = missingBasics();
  if (missing.length) throw new Error(t("missing.prefix", { list: joinList(missing) }));
  const [year, month, day] = state.birthDate.split("-").map(Number) as [number, number, number];
  const [hour, minute] = state.birthTime.split(":").map(Number) as [number, number];
  const place = placeById(state.birthPlace)!;
  return buildSkeleton({
    seed,
    birth: { wall: { year, month, day, hour, minute }, tz: place.tz, place: { id: place.id, label: `${place.label}, ${place.country}` } },
    ask: ALL_LAYERS.filter((id) => state.ask.has(id)),
    overrides: { "world.city": state.residence, "body.gender_present": state.gender },
    removed: state.removed,
  });
}

// ── 1. 选维度 ───────────────────────────────────────────────────────────────

function startView() {
  if (!state.birthDate) { const d = loadDraft(); if (d) restoreBasics(d.skeleton); }
  const counter = h("div", { class: "counter" });
  const list = h("div", {});
  const footTxt = h("div", { class: "txt" });
  const goBtn = h("button", { class: "btn primary" });
  const err = h("div", { class: "error" });

  const seedInput = h("input", { class: "input mono", placeholder: t("seed.placeholder"), value: state.seedText,
    oninput: (e: Event) => { state.seedText = (e.target as HTMLInputElement).value; } });
  const missingTxt = h("div", { class: "missing" });
  const onBasics = (key: "birthDate" | "birthTime" | "birthPlace" | "residence") => (e: Event) => {
    state[key] = (e.target as HTMLInputElement | HTMLSelectElement).value;
    err.textContent = "";
    render();
  };
  const dateInput = h("input", { id: "b-date", class: "input", type: "date", min: "1900-01-01", max: "2100-12-31", value: state.birthDate, required: "",
    oninput: onBasics("birthDate") });
  const timeInput = h("input", { id: "b-time", class: "input", type: "time", value: state.birthTime, required: "", oninput: onBasics("birthTime") });
  const L = lang();
  const collator = new Intl.Collator(L === "zh" ? "zh-CN" : L);
  const countries = [...new Set(BIRTHPLACES.map((p) => p.country))].sort((a, b) => collator.compare(countryLabel(a, L), countryLabel(b, L)));
  const placeSelect = h("select", { id: "b-place", class: "input", required: "", onchange: onBasics("birthPlace") },
    h("option", { value: "" }, t("basics.choose")),
    ...countries.map((c) => h("optgroup", { label: countryLabel(c, L) }, ...BIRTHPLACES.filter((p) => p.country === c)
      .map((p) => h("option", { value: p.id, ...(p.id === state.birthPlace ? { selected: "" } : {}) }, placeLabel(p.id, L))))));
  const cities = localizedLayers(L).find((l) => l.id === "world")!.fields.find((f) => f.id === "city")!.values;
  const residenceSelect = h("select", { id: "b-home", class: "input", required: "", onchange: onBasics("residence") },
    h("option", { value: "" }, t("basics.choose")),
    ...cities.map((c) => h("option", { value: c.id, ...(c.id === state.residence ? { selected: "" } : {}) }, c.label)));
  const LAYER_TEXT = layerText();
  const genderBtns = (["feminine", "masculine"] as const).map((g) => h("button", { type: "button", class: "btn seg", "aria-pressed": "false",
    onclick: () => { state.gender = g; err.textContent = ""; render(); } }, t(g === "feminine" ? "gender.female" : "gender.male")));

  function render() {
    genderBtns.forEach((b, i) => { const on = state.gender === (i === 0 ? "feminine" : "masculine"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    const sel = ALL_LAYERS.filter((id) => state.ask.has(id));
    const total = sel.reduce((a, id) => a * layerCount(id), 1);
    const num = fmtCount(total);
    const ticks = scaleTicks();
    counter.replaceChildren(
      h("div", { class: "label" }, sel.length ? t("count.label") : t("count.none")),
      h("div", { class: "num" }, sel.length ? num : "—", h("small", {}, sel.length ? t("count.people") : ""), h("span", { class: `badge${total >= 1e12 && sel.length ? " show" : ""}` }, t("count.badge"))),
      h("div", { class: "scale" }, h("div", { class: "fill", style: `width:${sel.length ? Math.min(100, (Math.log10(total) / 25) * 100) : 0}%` }),
        ...ticks.map(([e, l]) => h("div", { class: `tick${e === 12 ? " t1t" : ""}`, style: `left:${(e / 25) * 100}%` }, h("span", {}, l)))),
    );
    list.replaceChildren(...ALL_LAYERS.map((id, i) => {
      const tx = LAYER_TEXT[id]!;
      const on = state.ask.has(id);
      return h("div", { class: `dim${on ? " on" : ""}`, role: "switch", "aria-checked": String(on), tabindex: "0",
        onclick: () => { if (on) state.ask.delete(id); else state.ask.add(id); render(); },
        onkeydown: (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } } },
        h("div", { class: "top" }, h("div", { class: "idx" }, String(i + 1)),
          h("div", { class: "main" }, h("div", { class: "name" }, tx.name), h("div", { class: "what" }, tx.what)),
          h("div", { class: "count" }, layerCount(id).toLocaleString("en-US")), h("div", { class: "toggle" })),
        h("div", { class: "chips" }, ...tx.parts.map((p) => h("span", { class: "chip" }, p))),
        h("div", { class: "state" }, on ? tx.ask : t("layer.off")),
      );
    }));
    const rounds = sel.reduce((a, id) => a + (id === "bazi" ? 2 : 1), 0);
    footTxt.replaceChildren(...(sel.length
      ? [t("foot.pre"), h("b", {}, t(sel.length === 1 ? "foot.bold1" : "foot.boldN", { n: sel.length, m: rounds + 3 })), sel.length < ALL_LAYERS.length ? t("foot.restSeed") : t("foot.restAll")]
      : [t("foot.none")]));
    goBtn.textContent = t("start.roll");
    const missing = missingBasics();
    (goBtn as HTMLButtonElement).disabled = missing.length > 0;
    missingTxt.textContent = missing.length ? t("missing.prefix", { list: joinList(missing) }) : "";
  }
  goBtn.onclick = () => {
    try {
      const k = makeSkeleton();
      saveDraft({ skeleton: k, turns: [] });
      go("#/stranger");
    } catch (e) { err.textContent = (e as Error).message; }
  };
  const preset = (label: string, ids: string[]) => h("button", { class: "btn", onclick: () => { state.ask = new Set(ids); render(); } }, label);
  render();
  page("#/",
    h("div", { class: "eyebrow" }, t("start.eyebrow")),
    h("h1", {}, t("start.h1a"), h("em", {}, t("start.h1em")), t("start.h1b")),
    h("p", { class: "lead" }, t("start.lead")),
    counter,
    h("div", { class: "row" }, preset(t("preset.inner"), ["bazi"]), preset(t("preset.trillion"), DEFAULT_ASK), preset(t("preset.all"), ALL_LAYERS), preset(t("preset.none"), [])),
    h("div", { class: "seedbox" },
      h("div", { class: "field" }, h("label", {}, t("seed.label")), h("div", { class: "row" }, seedInput,
        h("button", { class: "btn", onclick: () => { state.seedText = formatSeed(randomSeed()); seedInput.value = state.seedText; } }, t("seed.random")))),
    ),
    h("div", { class: "seedbox basics" },
      h("div", { class: "label" }, t("basics.intro")),
      h("div", { class: "field" }, h("label", {}, t("basics.gender")), h("div", { class: "row seg-row", role: "group", "aria-label": t("basics.gender") }, ...genderBtns)),
      h("div", { class: "grid2" },
        h("div", { class: "field" }, h("label", { for: "b-date" }, t("basics.date")), dateInput),
        h("div", { class: "field" }, h("label", { for: "b-time" }, t("basics.time")), timeInput),
        h("div", { class: "field" }, h("label", { for: "b-place" }, t("basics.place")), placeSelect),
        h("div", { class: "field" }, h("label", { for: "b-home" }, t("basics.home")), residenceSelect)),
    ),
    list,
    err,
    h("p", { class: "note" }, t("start.note")),
    h("div", { class: "foot" }, h("div", { class: "in" }, h("div", { class: "txt" }, footTxt, missingTxt), goBtn)),
  );
}

// ── 2. 看陌生人 ─────────────────────────────────────────────────────────────

/** 陌生人页的卡：外在每个字段可以改，五层可以整层删（step15_edit_stranger.md）。 */
function strangerCards(k: Skeleton, edit?: Editor): HTMLElement[] {
  const d = describe(k, lang());
  const i = d.inner;
  const tag = (asked: boolean) => h("span", { class: `tag${asked ? " ask" : ""}` }, asked ? t("tag.you") : t("tag.seed"));
  const fieldsOf = new Map(localizedLayers(lang()).map((l) => [l.id, l.fields]));
  const innerLink = h("a", { href: "#/", onclick: (e: Event) => { e.preventDefault(); restoreBasics(k); go("#/"); } }, t("edit.innerLink"));
  return [
    h("div", { class: "card drive" },
      h("h3", {}, t("layer.bazi.name"), tag(i.asked)),
      h("p", {}, h("b", {}, t("card.wants")), i.wants.join(t("card.and"))),
      h("p", {}, h("b", {}, t("card.price")), i.cost.join(" ")),
      h("p", {}, h("b", {}, t("card.breaks")), i.breaks),
      h("ul", { class: "faces" }, ...i.masks.map((m) => h("li", {}, h("span", {}, `${m.position} · ${m.name}`), m.line.replace(/^[^:：]+[:：]\s*/, "")))),
      h("p", { class: "muted" }, t("card.chart", { pillars: i.pillars, strength: i.strength, lean: i.typeLean })),
      edit ? h("p", { class: "muted edit-note" }, t("edit.innerNote"), innerLink) : null,
    ),
    ...d.layers.map((l) => {
      const values = fieldsOf.get(l.id)!;
      if (!edit) return h("div", { class: "card" }, h("h3", {}, l.name, tag(l.asked)), h("dl", { class: "kv" }, ...l.fields.flatMap((f) => [h("dt", {}, f.label), h("dd", {}, f.valueLabel)])));
      return h("div", { class: `card${edit.flash.layer === l.id ? " flashed" : ""}` },
        h("h3", {}, l.name, tag(l.asked),
          REMOVABLE_LAYERS.includes(l.id) ? h("button", { class: "btn-link remove-layer", onclick: () => edit.remove(l.id) }, t("edit.remove")) : null),
        h("dl", { class: "kv edit" }, ...l.fields.flatMap((f) => {
          const path = `${l.id}.${f.id}`;
          let opts = values.find((x) => x.id === f.id)!.values;
          if (path === "body.gender_present") opts = opts.filter((o) => o.id === "feminine" || o.id === "masculine" || o.id === f.value);
          const sel = h("select", { class: "input edit-sel", "aria-label": f.label, onchange: (e: Event) => edit.set(path, (e.target as HTMLSelectElement).value) },
            ...opts.map((o) => {
              const fits = o.id === f.value || edit.fits(path, o.id);
              return h("option", { value: o.id, ...(o.id === f.value ? { selected: "" } : {}), ...(fits ? {} : { disabled: "" }) }, fits ? o.label : t("edit.doesntFit", { value: o.label }));
            }));
          return [h("dt", {}, f.label), h("dd", { class: edit.flash.changed.includes(path) ? "changed" : "" }, sel, f.pinned ? h("span", { class: "yours" }, t("edit.yours")) : null)];
        })),
        edit.flash.layer === l.id && edit.flash.note ? h("p", { class: "edit-flash" }, edit.flash.note) : null,
      );
    }),
    ...(edit && d.removed.length ? [h("div", { class: "removed-row" }, ...d.removed.map((r) =>
      h("span", { class: "removed-item" }, t("edit.removed", { name: r.name }), " ", h("button", { class: "btn-link", onclick: () => edit.restore(r.id) }, t("edit.restore")))))] : []),
  ];
}

interface Editor {
  set(path: string, value: string): void;
  /** 选这个值合不合得上（生日定的年代 / 年龄、钉住的其他字段）；合不上的选项灰掉 */
  fits(path: string, value: string): boolean;
  remove(layer: string): void;
  restore(layer: string): void;
  flash: { layer?: string; changed: string[]; note?: string };
}

/** 「1998-04-12 07:30 生于纽约 · 2026 年 28 岁 · 现居东京」 */
function basicsLine(k: Skeleton): string {
  const b = k.birth!;
  const [date, time] = b.wall.split(" ");
  const city = describe(k, lang()).layers.find((l) => l.id === "world")!.fields.find((f) => f.id === "city")!.valueLabel;
  const place = b.place ? (placeById(b.place.id) ? `${placeLabel(b.place.id, lang())}${lang() === "en" ? ", " : "，"}${countryLabel(placeById(b.place.id)!.country, lang())}` : b.place.label) : b.tz;
  const line = t("stranger.basics", { date: date!, time: time!, place: lang() === "ja" ? place.replace("，", "、") : place, age: b.age, year: b.storyYear, city });
  const g = k.overrides["body.gender_present"];
  return g === "feminine" || g === "masculine" ? `${t(g === "feminine" ? "gender.female" : "gender.male")} · ${line}` : line;
}

let strangerFlash: Editor["flash"] = { changed: [] };

function strangerView() {
  const draft = loadDraft();
  if (!draft) return go("#/");
  const k = draft.skeleton;
  const link = `${location.origin}${location.pathname}#seed=${k.seed}`;
  const copied = h("span", { class: "muted" });
  const flash: Editor["flash"] = strangerFlash; strangerFlash = { changed: [] };
  const apply = (layer: string, path: string | null, make: () => Skeleton) => {
    const y = window.scrollY; // page() 会滚回顶上；改完留在原处
    const rerender = () => { strangerView(); window.scrollTo(0, y); };
    let next: Skeleton;
    try { next = make(); } catch (e) { strangerFlash = { layer, changed: [], note: t("edit.conflict", { msg: (e as Error).message }) }; return rerender(); }
    const before = describe(k, lang()), after = describe(next, lang());
    const changed: string[] = [], names: string[] = [];
    for (const l of after.layers) for (const f of l.fields) {
      const p = `${l.id}.${f.id}`;
      const old = before.layers.find((x) => x.id === l.id)?.fields.find((x) => x.id === f.id);
      if (old && old.value !== f.value && p !== path) { changed.push(p); names.push(`${f.label}→${f.valueLabel}`); }
    }
    saveDraft({ skeleton: next, turns: draft.turns });
    state.removed = [...(next.removed ?? [])];
    strangerFlash = { layer, changed, ...(names.length ? { note: t("edit.alsoChanged", { list: joinList(names) }) } : {}) };
    rerender();
  };
  const edit: Editor = {
    flash,
    set: (path, value) => apply(path.split(".")[0]!, path, () => rebuildSkeleton(k, { ...k.overrides, [path]: value })),
    fits: (path, value) => { try { rebuildSkeleton(k, { ...k.overrides, [path]: value }); return true; } catch { return false; } },
    remove: (layer) => apply(layer, null, () => rebuildSkeleton(k, k.overrides, [...(k.removed ?? []), layer])),
    restore: (layer) => apply(layer, null, () => rebuildSkeleton(k, k.overrides, (k.removed ?? []).filter((x) => x !== layer))),
  };
  if (!state.birthDate) restoreBasics(k);
  page("#/stranger",
    h("div", { class: "eyebrow" }, t("stranger.eyebrow")),
    h("h1", {}, t("stranger.h1a"), h("em", {}, t("stranger.h1em")), t("stranger.h1b")),
    h("div", { class: "row", style: "margin-top:12px" }, h("span", { class: "seedcode" }, k.seed),
      h("button", { class: "btn", onclick: async () => { try { await navigator.clipboard.writeText(link); copied.textContent = t("stranger.copied"); } catch { copied.textContent = link; } } }, t("stranger.copy")),
      h("button", { class: "btn", onclick: () => { state.seedText = ""; state.ask = new Set(k.ask); state.removed = [...(k.removed ?? [])]; try { const nk = makeSkeleton(); saveDraft({ skeleton: nk, turns: [] }); strangerView(); } catch { go("#/"); } } }, t("stranger.again")),
      copied),
    ...(k.birth ? [h("p", { class: "lead basics-line" }, basicsLine(k))] : []),
    h("p", { class: "muted edit-hint" }, t("edit.hint")),
    ...strangerCards(k, edit),
    h("div", { class: "foot" }, h("div", { class: "in" },
      h("div", { class: "txt" }, ...(k.ask.length ? [t("stranger.startPre"), h("b", {}, k.ask.includes("bazi") ? t("stranger.innerLife") : (layerText()[k.ask[0]!]?.name ?? "")), t("stranger.startPost")] : [t("stranger.onlyName")])),
      h("button", { class: "btn primary", onclick: () => go(ready(loadSettings()) ? "#/chat" : "#/settings?next=chat") }, t("talkTo", { name: DESIGNER_NAME })))),
  );
}

// ── 3. 和 Elise 聊 ──────────────────────────────────────────────────────────

let busy = false;

async function chatView() {
  const draft = loadDraft();
  if (!draft) return go("#/");
  const settings = loadSettings();
  if (!ready(settings)) return go("#/settings?next=chat");
  let model;
  try { model = modelFrom(settings); } catch (e) { return go(`#/settings?next=chat&error=${encodeURIComponent((e as Error).message)}`); }
  const session = new DesignerSession(draft.skeleton, model, LANG_NAME[lang()]);
  session.turns.push(...draft.turns);
  const persist = () => saveDraft({ skeleton: session.skeleton, turns: session.turns });

  const log = h("div", { class: "chat", "aria-live": "polite" });
  const status = h("div", { class: "typing" });
  const box = h("textarea", { class: "input", rows: "1", placeholder: t("chat.placeholder") }) as HTMLTextAreaElement;
  const send = h("button", { class: "btn primary" }, t("chat.send"));
  const done = h("button", { class: "btn" }, t("chat.done"));
  const bubble = (role: "them" | "me" | "sys", text: string) =>
    h("div", { class: `bubble ${role}` }, role === "them" ? h("span", { class: "who" }, DESIGNER_NAME) : null, text);
  const redraw = () => {
    log.replaceChildren(...session.turns.map((t) => bubble(t.role === "designer" ? "them" : "me", t.text)), status);
    scrollChat(log);
  };
  const run = async (what: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    busy = true; send.disabled = done.disabled = true; status.textContent = what;
    try { await fn(); status.textContent = ""; } catch (e) { status.textContent = ""; log.append(bubble("sys", t("chat.error", { msg: (e as Error).message }))); }
    finally { busy = false; send.disabled = done.disabled = false; persist(); }
  };
  send.onclick = () => {
    const text = box.value.trim();
    if (!text) return;
    box.value = "";
    if (text === "/done") return done.click();
    session.turns.push({ role: "user", text }); redraw(); session.turns.pop();
    void run(t("chat.typing", { name: DESIGNER_NAME }), async () => { await session.reply(text); redraw(); });
  };
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.click(); } };
  done.onclick = () => void run(t("chat.reading"), async () => {
    const f = await finalize(model, session.skeleton, session.transcript(), session.language);
    if (!f.enough) { await session.nudge(f.missing); redraw(); return; }
    persist();
    sessionStorage.setItem("1t.final", JSON.stringify({ name: f.name, relationToUser: f.relationToUser, skeleton: f.skeleton, dropped: f.dropped }));
    go("#/writing");
  });

  stagePage("#/chat", {
    name: DESIGNER_NAME, backdrop: { kind: "portrait", src: ELISE_PORTRAIT },
    scroll: [
      h("div", { class: "eyebrow" }, t("chat.eyebrow", { name: DESIGNER_NAME, seed: draft.skeleton.seed })),
      h("details", {}, h("summary", { class: "muted" }, t("chat.showStranger")), ...strangerCards(session.skeleton)),
      log,
    ],
    composer: h("div", { class: "composer" }, h("div", { class: "in" }, box, send, done)),
  });
  redraw();
  if (session.turns.length === 0) await run(t("chat.readingSeed", { name: DESIGNER_NAME }), async () => { await session.open(); redraw(); });
}

// ── 4. 写人设 ───────────────────────────────────────────────────────────────

async function writingView() {
  const draft = loadDraft();
  const finalRaw = sessionStorage.getItem("1t.final");
  if (!draft || !finalRaw) return go("#/");
  const f = JSON.parse(finalRaw) as { name: string; relationToUser: string; skeleton: Skeleton; dropped: { path: string; value: string }[] };
  const steps = ["identity", "drive", "speech", "life", "schedule"];
  const labels: Record<string, string> = { identity: t("writing.identity"), drive: t("writing.drive"), speech: t("writing.speech"), life: t("writing.life"), schedule: t("writing.schedule") };
  const list = h("ul", { class: "progress" });
  const err = h("div", { class: "error" });
  const mark = (now: number) => list.replaceChildren(...steps.map((s, i) => h("li", { class: i < now ? "done" : i === now ? "now" : "" }, labels[s]!)));
  mark(0);
  page("#/writing",
    h("div", { class: "eyebrow" }, t("writing.eyebrow")),
    h("h1", {}, h("em", {}, f.name), t("writing.h1Post")),
    h("p", { class: "lead" }, t("writing.lead")),
    list, err,
    f.dropped.length ? h("p", { class: "note" }, t("writing.dropped", { list: joinList(f.dropped.map((d) => `${d.path} = ${d.value}`)) })) : null,
  );
  try {
    const model = modelFrom(loadSettings());
    const transcript = new DesignerSession(f.skeleton, model);
    transcript.turns.push(...draft.turns);
    const language = LANG_NAME[lang()];
    const { text, slots } = await generatePersona(model, { name: f.name, relationToUser: f.relationToUser, skeleton: f.skeleton, transcript: transcript.transcript(), language },
      (stage) => mark(steps.indexOf(stage) + 1));
    const schedule = await generateSchedule(model, f.name, slots, f.skeleton, language);
    mark(5);
    const c: SavedCharacter = {
      id: crypto.randomUUID(), name: f.name, age: slots.age, location: slots.location, tagline: slots.coreArchetype,
      relationToUser: f.relationToUser, persona: text, schedule, skeleton: f.skeleton, createdAt: new Date().toISOString(), chat: [], lang: lang(),
    };
    if (!saveCharacter(c)) err.textContent = t("writing.saveFail");
    sessionStorage.setItem("1t.unsaved", JSON.stringify(c));
    saveDraft(null);
    sessionStorage.removeItem("1t.final");
    go(`#/result/${c.id}`);
  } catch (e) {
    err.replaceChildren(t("writing.failed", { msg: (e as Error).message }), h("button", { class: "btn", onclick: () => writingView() }, t("writing.retry")));
  }
}

// ── 5. 结果 ─────────────────────────────────────────────────────────────────

function findCharacter(id: string): SavedCharacter | null {
  const c = getCharacter(id);
  if (c) return c;
  try { const u = JSON.parse(sessionStorage.getItem("1t.unsaved") ?? "null") as SavedCharacter | null; return u?.id === id ? u : null; } catch { return null; }
}

async function downloadAnone(c: SavedCharacter) {
  const s = c.schedule as { era: string; blocks: Record<string, unknown>[]; work: unknown };
  const buf = await packAnone({ name: c.name, age: c.age, location: c.location, tagline: c.tagline, persona: c.persona, schedule: s, skeleton: c.skeleton!, ...(c.avatarId ? { avatarId: c.avatarId } : {}) });
  download(`${fileBase(c.name)}.anone`, buf as Uint8Array<ArrayBuffer>, "application/x-anone");
}
function downloadCard(c: SavedCharacter) {
  const card = toCardV2(cardInputFromPersona(c.persona, c.skeleton!, c.relationToUser));
  download(`${fileBase(c.name)}.card.json`, JSON.stringify(card, null, 2), "application/json");
}

function resultView(id: string) {
  const c = findCharacter(id);
  if (!c) return go("#/library");
  page("#/library",
    h("div", { class: "eyebrow" }, t("result.eyebrow")),
    h("h1", {}, h("em", {}, c.name), ` · ${c.tagline}`),
    h("p", { class: "lead" }, t("result.age", { age: c.age, location: bare(c.location) }), c.relationToUser ? h("br") : null, c.relationToUser ? t("result.you", { rel: bare(c.relationToUser) }) : null),
    h("div", { class: "row", style: "margin:16px 0" },
      h("button", { class: "btn primary", onclick: () => go(`#/c/${c.id}`) }, t("talkTo", { name: c.name })),
      h("button", { class: "btn", onclick: () => void downloadAnone(c) }, t("result.anone")),
      h("button", { class: "btn", onclick: () => downloadCard(c) }, t("result.card")),
    ),
    h("p", { class: "note" }, t("result.note")),
    clipStrip(t("promo.resultTitle"), t("promo.resultNote"), ["n04", "n05", "n06", "n07"]),
    h("h2", {}, "persona.txt"),
    h("div", { class: "persona" }, c.persona),
  );
}

// ── 6. 角色库 ───────────────────────────────────────────────────────────────

function libraryView() {
  const err = h("div", { class: "error" });
  const file = h("input", { type: "file", accept: ".anone,.json,application/x-anone,application/zip,application/json", style: "display:none" }) as HTMLInputElement;
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try { await importFile(f); libraryView(); } catch (e) { err.textContent = t("lib.importFail", { msg: (e as Error).message }); }
    file.value = "";
  };
  // 「导出全部」：角色和聊天打成一个文件（不含 key），拖进桌宠就搬过去了（第 21 步）
  const exportAll = () => download(`1t-persona-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(makeBackup(listCharacters()), null, 1), "application/json");
  const all = listCharacters();
  const anonePeople = all.filter((c) => c.anoneId).sort((a, b) => a.anoneId!.localeCompare(b.anoneId!)), rarePeople = all.filter((c) => c.rareId), mine = all.filter((c) => !c.anoneId && !c.rareId);
  const item = (c: SavedCharacter) => h("div", { class: "item" },
    c.anonePoster ? h("img", { class: "lib-face", src: c.anonePoster, alt: "", loading: "lazy" }) : null,
    h("div", { class: "who" }, h("b", {}, c.name), h("div", {}, `${c.tagline} · ${c.age}${c.skeleton ? ` · ${c.skeleton.seed}` : ""}`)),
    h("button", { class: "btn primary", onclick: () => go(`#/c/${c.id}`) }, t("lib.talk")),
    h("button", { class: "btn", onclick: () => go(`#/result/${c.id}`) }, t("lib.open")),
    h("button", { class: "btn", "aria-label": t("lib.deleteAria", { name: c.name }), onclick: () => { if (confirm(t("lib.deleteConfirm", { name: c.name }))) { deleteCharacter(c.id); libraryView(); } } }, t("lib.delete")),
  );
  page("#/library",
    h("div", { class: "eyebrow" }, t("lib.eyebrow")),
    h("h1", {}, t("lib.h1a"), h("em", {}, t("lib.h1em")), t("lib.h1b")),
    h("div", { class: "row", style: "margin-top:14px" }, h("button", { class: "btn primary", onclick: () => go("#/") }, t("lib.new")), h("button", { class: "btn", onclick: () => file.click() }, t("lib.import")),
      all.length ? h("button", { class: "btn", onclick: exportAll }, t("lib.exportAll")) : null, file),
    err,
    // 桌宠里只说「导出全部」怎么用；网页 / 手机上出「下载桌宠」按钮，按这台电脑挑 Mac（Apple 芯片 / Intel）或 Windows（第 24 步）
    inShell() ? (all.length ? h("p", { class: "muted lib-desk" }, t("lib.deskShell")) : null) : desktopDownload(),
    // 第 23 步：分组——anone.life 的人（会动）、奇人、你造的
    h("section", { class: "lib-group" }, h("h2", {}, t("lib.anoneTitle")), h("p", { class: "muted" }, t("lib.anoneNote")),
      anonePeople.length ? h("div", { class: "lib" }, ...anonePeople.map(item))
        : anoneReady(loadAnone()) && !lastSyncRejected ? h("p", { class: lastSyncError ? "lib-callout" : "muted" }, lastSyncError ? t("lib.anoneFailed", { msg: lastSyncError }) : t("lib.anoneLoading"))
        // 第 24 步：没 key 也出四张卡，点了 TA 登场、亲口请你去注册，讲完出场
        : h("div", {}, h("p", { class: "muted" }, t("demo.groupNote")),
            h("div", { class: "demo-grid" }, ...DEMO_PEOPLE.map((p) => demoCard(p, { onDone: (to) => { if (to === "settings") go("#/settings"); } }))),
            h("p", { class: "lib-callout" }, t(lastSyncRejected && anoneReady(loadAnone()) ? "lib.anoneKeyRejected" : "lib.anoneNeedKey"), " ", h("a", { href: "#/settings" }, t("nav.model"))))),
    rarePeople.length ? h("section", { class: "lib-group" }, h("h2", {}, t("rare.nav")), h("div", { class: "lib" }, ...rarePeople.map(item))) : null,
    h("section", { class: "lib-group" }, h("h2", {}, t("lib.mineTitle")),
      mine.length ? h("div", { class: "lib" }, ...mine.map(item)) : h("div", {}, h("p", { class: "muted" }, t("lib.empty")),
        clipStrip(t("promo.libTitle"), t("promo.libNote"), ["x07", "x06", "x05", "x08"]))),
  );
  // 第一次打开（有 anone.life key）把那四位下载下来，下完重画
  void syncAnonePeopleOnce(loadAnone(), lang()).then((n) => { if ((n || lastSyncError) && location.hash.startsWith("#/library") && !document.querySelector(".lib-group .lib-callout")) libraryView(); });
}

// ── 7. 和角色聊 ─────────────────────────────────────────────────────────────

function characterView(id: string) {
  const c = getCharacter(id);
  if (!c) return go("#/library");
  const settings = loadSettings();
  // 一期一会没填自己的模型也能聊：走 anone.life 的免费试聊（第 28 步）；别的人照旧要先填模型
  if (!ready(settings) && !c.rareId) return go(`#/settings?next=c/${id}`);
  const anone = loadAnone();
  const free = usesFree(c);
  let quota: RareQuota | null = null;
  let stop: string | null = null; // 上一句被拒的原因（RareStop.code）
  let pendingPick = false;
  const freeState = () => (stop ? ({ ok: false, code: stop } as const) : rareStatus(c, quota, pendingPick));
  const model = free ? freeModel(c, anone, () => { const st = freeState(); return st.ok ? st.pay : "default"; }, (q) => { quota = q; }) : modelFrom(settings);
  const rare = c.rareId ? RARE.find((r) => r.id === c.rareId) ?? null : null;
  // 奇人在别的语言下开的：界面换了语言就换到这个人这一语言的版本（人设、情境都跟着换；原来那段聊天留着）
  if (rare && c.lang && c.lang !== lang() && hasRarePersona(rare.id, lang())) return void openRare(rare);
  // 第 23 步：不再换脸。会动的只有带着 anone.life 脸的人（「anone.life 的人」那四位；v0.2 时选过脸的旧角色也照旧）。
  // 奇人用自己的照片；自己造的人可以上传一张照片，都不动。
  const live = !rare && !!c.avatarId && anoneReady(anone);
  const photo = rare ? rarePhoto(rare.id) : loadPhoto(c.id);
  const stage = new Stage();
  let face: Face | null = null;
  const faceBar = h("div", { class: "facebar" });
  const opening = /^## First line[^\n]*\n"(.+)"$/m.exec(c.persona)?.[1];
  if (c.chat.length === 0 && opening) { c.chat.push({ role: "assistant", content: opening }); saveCharacter(c); }
  const log = h("div", { class: "chat", "aria-live": "polite" });
  const status = h("div", { class: "typing" });
  const box = h("textarea", { class: "input", rows: "1", placeholder: t("char.placeholder", { name: c.name }) }) as HTMLTextAreaElement;
  const send = h("button", { class: "btn primary" }, t("chat.send"));
  const shown = (m: { role: string; content: string }) => (m.role === "assistant" ? takeEmotion(m.content).text : m.content);
  // 「告诉 Elise」（第 10 步）：每条回复旁一个小按钮，面板挂在聊天记录下面
  const retuneSlot = h("div", {});
  const openRetune = (index: number) => {
    if (busy) return;
    retuneSlot.replaceChildren(retunePanel({
      character: c, index, model, shown: (s) => takeEmotion(s).text,
      onDone: ({ retry }) => {
        if (!retry) return;
        c.chat = c.chat.slice(0, index); // 拿掉被点的那条和之后的，用新人设重回那句话
        saveCharacter(c); redraw();
        respond().catch(() => {}); // 错误已在聊天里显示
      },
    }));
    retuneSlot.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const redraw = () => {
    log.replaceChildren(...c.chat.map((m, i) => h("div", { class: `bubble ${m.role === "assistant" ? "them" : "me"}` },
      m.role === "assistant" ? h("span", { class: "who" }, c.name) : null, ...(m.role === "assistant" ? withActions(shown(m)) : [shown(m)]),
      m.role === "assistant" && i > 0 && !isSpent(c) && !free ? h("button", { class: "bubble-tool", title: t("retune.tip"), onclick: () => openRetune(i) }, t("retune.button")) : null,
    )), status);
    scrollChat(log);
  };

  const photoInput = h("input", { type: "file", accept: "image/*", hidden: true }) as HTMLInputElement;
  photoInput.onchange = async () => {
    const f = photoInput.files?.[0]; photoInput.value = "";
    if (!f) return;
    try {
      const url = await shrinkPhoto(f);
      if (!savePhoto(c.id, url)) { faceBar.append(h("p", { class: "error" }, t("photo.full"))); return; }
      characterView(c.id);
    } catch (e) { faceBar.append(h("p", { class: "error" }, t("photo.fail", { msg: (e as Error).message }))); }
  };
  const drawFaceBar = (faces: Face[] | null, err?: string) => {
    if (c.avatarId) {
      // 带着 anone.life 脸的人：没 key 时提示一句；有 key 就把那张脸接上，不给选
      if (!anoneReady(anone)) { faceBar.replaceChildren(h("p", { class: "muted" }, t("pet.needKey", { name: c.name }), " ", h("a", { href: "#/settings" }, t("nav.model")))); return; }
      if (err) { faceBar.replaceChildren(h("p", { class: "error" }, err)); return; }
      if (!faces) { faceBar.replaceChildren(h("p", { class: "muted" }, t("face.loading"))); return; }
      face = faces.find((f) => f.id === c.avatarId) ?? null;
      stage.setFace(face);
      faceBar.replaceChildren(...(face ? [] : [h("p", { class: "muted" }, t("pet.faceGone"))]));
      return;
    }
    // 自己造的人：上传一张照片（只存在这台设备上）
    faceBar.replaceChildren(h("div", { class: "photo-bar" },
      h("button", { class: "btn", type: "button", onclick: () => photoInput.click() }, photo ? t("photo.change") : t("photo.upload")),
      photo ? h("button", { class: "linkish", type: "button", onclick: () => { removePhoto(c.id); characterView(c.id); } }, t("photo.remove")) : null,
      photoInput), h("p", { class: "muted photo-note" }, t("photo.note")));
  };
  if (live) listFaces(anone).then((f) => drawFaceBar(f), (e) => drawFaceBar(null, t("face.loadFail", { msg: (e as Error).message })));
  if (!rare) drawFaceBar(null);

  /** 对着聊天记录的最后一句（他说的）生成她的回复；发消息和「从这句重来」共用。逻辑在 talk.ts，和桌宠同一份。 */
  const respond = async () => {
    if (busy) return;
    busy = true; send.disabled = true;
    try {
      await reply(c, model, { face, stage, anone }, {
        status: (s) => { status.textContent = s; },
        sys: (s) => { log.append(h("div", { class: "bubble sys" }, s)); scrollChat(log); },
        redraw,
      });
    } finally { busy = false; send.disabled = false; status.textContent = ""; }
  };
  send.onclick = async () => {
    const text = box.value.trim();
    if (!text || busy || turnsLeft(c) <= 0) return;
    if (free && !freeState().ok) return;
    box.value = "";
    c.chat.push({ role: "user", content: text }); redraw();
    try {
      await respond();
      pendingPick = false; stop = null;
    } catch (e) {
      c.chat.pop(); saveCharacter(c); redraw();
      // 一期一会卡住了：他那句放回输入框，下面换成三选一的卡
      if (e instanceof RareStop) { stop = e.code; if (e.quota) quota = e.quota; box.value = text; }
    }
    if (free) drawComposer();
    // 第 25 步：这一句是第 10 句，回完就换成收尾卡
    if (isSpent(c) && location.hash === `#/c/${c.id}`) characterView(c.id);
  };
  // 「anone.life 的人」：剩 2 回合以内提示一句（第 25 步）
  if (isLimited(c) && turnsLeft(c) <= 2 && turnsLeft(c) > 0) box.placeholder = t("limit.left", { n: turnsLeft(c), name: c.name });
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.click(); } };
  // 输入框那一格：平时是输入框；「anone.life 的人」用完 10 回合换收尾卡（第 25 步）；一期一会试聊卡住换三选一（第 28 步）
  const composerSlot = h("div", { class: "composer-slot" });
  const normal = h("div", { class: "composer" }, h("div", { class: "in" }, box, send));
  const defaultHint = box.placeholder;
  function drawComposer() {
    if (isSpent(c!)) { composerSlot.replaceChildren(limitCard(c!, anone)); return; }
    if (!free) { composerSlot.replaceChildren(normal); return; }
    const st = freeState();
    if (st.ok) { box.placeholder = st.hint || defaultHint; composerSlot.replaceChildren(normal); return; }
    composerSlot.replaceChildren(freeCard(rareCard(st.code, c!, quota, anone, {
      refresh: () => { stop = null; void fetchQuota(c!, anone).then((q) => { quota = q; if (!q) stop = "offline"; drawComposer(); }); },
      pick: () => { pendingPick = true; stop = null; drawComposer(); box.focus(); },
      stamps: (on) => { c!.prefs = { ...c!.prefs, stamps: on }; saveCharacter(c!); stop = null; drawComposer(); },
      ownApi: () => go(`#/settings?next=c/${c!.id}`),
      open: (url) => void window.open(url, "_blank", "noopener"),
    })));
  }
  const backdrop: Backdrop = photo ? { kind: "photo", src: photo }
    : rare?.layers["body.embodiment"] === "voice-only" ? { kind: "none", note: t("rare.voiceOnly") }
    : { kind: "none" };
  stagePage(rare ? "#/rare" : "#/library", {
    name: c.name, backdrop, live: live ? stage.el : undefined,
    scroll: [h("div", { class: "eyebrow" }, `${c.name} · ${c.tagline}`), rare ? contextCard(c, rare) : null, chatOptions(c), rare ? null : faceBar, log, retuneSlot],
    composer: composerSlot,
  });
  redraw();
  drawComposer();
  if (free) void fetchQuota(c, anone).then((q) => { quota = q; drawComposer(); });
}

/**
 * 「anone.life 的人」聊满 10 回合后的收尾卡（第 25 步），占输入框的位置（手机上平时只露最后一轮，放在记录里会被藏掉）。
 * TA 口吻的一句 +「带着这段对话去 anone.life」/「不带，直接去」；带过的只剩「去 anone.life 继续」。
 */
function limitCard(c: SavedCharacter, anone: AnoneSettings): HTMLElement {
  const msg = h("p", { class: "error" });
  // 弹窗要在点击那一刻开（等完请求再开会被浏览器拦）；桌宠外壳里由主进程交给系统浏览器
  const openTo = async (get: () => Promise<string> | string) => {
    const w = inShell() ? null : window.open("", "_blank");
    try {
      const url = await get();
      if (w) { w.opener = null; w.location.href = url; } else window.open(url, "_blank", "noopener");
      if (c.handedOffAt) characterView(c.id);
    } catch (e) { w?.close(); msg.textContent = t("limit.fail", { msg: (e as Error).message }); }
  };
  return h("div", { class: "composer limit-card" },
    h("p", { class: "limit-say" }, closingLine(c)),
    c.handedOffAt
      ? h("button", { class: "btn primary", type: "button", onclick: () => void openTo(() => directUrl(c, anone)) }, t("limit.again"))
      : h("button", { class: "btn primary", type: "button", onclick: () => void openTo(() => handOff(c, anone)) }, t("limit.bring")),
    c.handedOffAt ? null : h("button", { class: "btn", type: "button", onclick: () => void openTo(() => directUrl(c, anone)) }, t("limit.direct")),
    h("p", { class: "muted limit-note" }, c.handedOffAt ? t("limit.done", { name: c.name }) : t("limit.note")),
    msg);
}

/** 一期一会试聊卡住时的那张卡（第 28 步），和第 25 步的收尾卡同一个样子、占输入框的位置。 */
function freeCard(card: RareCard): HTMLElement {
  return h("div", { class: "composer limit-card" },
    h("p", { class: "limit-say" }, card.text),
    ...card.choices.map((x) => h("button", { class: x.primary ? "btn primary" : "btn", type: "button", onclick: x.run }, x.label)),
    card.note ? h("p", { class: "muted limit-note" }, card.note) : null);
}

/** 回复里的 `*动作*` 显示成灰色斜体（动作描写开着时才会有；第 22 步）。 */
function withActions(text: string): (Node | string)[] {
  return text.split(/(\*[^*\n]+\*)/g).filter(Boolean).map((part) => /^\*[^*]+\*$/.test(part) ? h("em", { class: "act" }, part.slice(1, -1)) : part);
}

/** 聊天页的开关：动作描写、播音（第 22 步）。存进这个角色的 prefs，刷新后还在。
 * 播音一打开就在下面说清楚：没填 TTS key 给链接；填了就出音色下拉（每个角色各选一个）。 */
function chatOptions(c: SavedCharacter): HTMLElement {
  const below = h("div", { class: "chat-opts-below" });
  const g = c.skeleton?.layers.body?.gender_present;
  const gender = g === "masculine" ? "male" : g === "feminine" ? "female" : null;
  const drawBelow = () => {
    below.replaceChildren();
    if (!c.prefs?.voice) return;
    const v = loadVoice();
    if (!voiceReady(v) || v.provider === "none") {
      below.append(h("p", { class: "opt-hint" }, t("chat.opt.voiceNoKeyA"), h("a", { href: "#/settings" }, t("nav.model")), t("chat.opt.voiceNoKeyB")));
      return;
    }
    const list = VOICES[v.provider];
    const cur = c.prefs?.voiceId && list.includes(c.prefs.voiceId) ? c.prefs.voiceId : defaultVoice(v.provider, gender);
    const sel = h("select", { class: "input opt-voice", "aria-label": t("chat.opt.voicePick"),
      onchange: (ev: Event) => { c.prefs = { ...c.prefs, voiceId: (ev.target as HTMLSelectElement).value }; saveCharacter(c); } },
      ...list.map((id) => h("option", { value: id, ...(id === cur ? { selected: true } : {}) }, id[0]!.toUpperCase() + id.slice(1))));
    below.append(h("label", { class: "opt-voice-row" }, t("chat.opt.voicePick"), sel));
  };
  const sw = (key: "actions" | "voice", label: string) => {
    const b = h("button", { type: "button", class: "opt-switch", "aria-pressed": String(!!c.prefs?.[key]) }, label) as HTMLButtonElement;
    b.onclick = () => { c.prefs = { ...c.prefs, [key]: !c.prefs?.[key] }; saveCharacter(c); b.setAttribute("aria-pressed", String(!!c.prefs[key])); drawBelow(); };
    return b;
  };
  drawBelow();
  return h("div", { class: "chat-opts-wrap" }, h("div", { class: "chat-opts" }, sw("actions", t("chat.opt.actions")), sw("voice", t("chat.opt.voice"))), below);
}

/** 奇人聊天页上方的情境卡：TA 是谁、你是谁、你们的关系、初见和冲突点（第 22 步）。可收起，记住。 */
function contextCard(c: SavedCharacter, r: Rare): HTMLElement {
  const L = lang(); // 情境卡跟界面语言
  const ctx = RARE_CONTEXT[r.id];
  const row = (label: string, ...body: (Node | string)[]) => h("div", { class: "ctx-row" }, h("dt", {}, label), h("dd", {}, ...body));
  const d = h("details", { class: "ctx-card", ...(c.prefs?.ctxOpen === false ? {} : { open: "" }) },
    h("summary", {}, t("chat.ctx.title")),
    h("dl", {},
      row(t("chat.ctx.who"), h("b", {}, RARE_NAMES[r.id]?.[L] ?? c.name), ` · ${r.name[L]}`, h("div", { class: "muted" }, r.hook[L])),
      ...(ctx ? [row(t("chat.ctx.you"), ctx.you[L]), row(t("chat.ctx.relation"), ctx.relation[L])] : []),
      row(t("chat.ctx.scene"), r.scene[L]),
      ...(ctx ? [row(t("chat.ctx.tension"), ctx.tension[L])] : []),
    ), rareProfile(r, L)) as HTMLDetailsElement;
  d.addEventListener("toggle", () => { c.prefs = { ...c.prefs, ctxOpen: d.open }; saveCharacter(c); });
  return d;
}

/** 奇人开聊：用本机预生成的人设（按界面语言）存成一个角色，同一个人同一种语言只建一份（第 20 步）。 */
async function openRare(r: Rare) {
  const L = lang();
  const id = `rare-${r.id}-${L}`;
  if (getCharacter(id)) return go(`#/c/${id}`);
  try {
    const { persona, schedule } = await loadRarePersona(r.id, L);
    const title = /^# (.+)$/m.exec(persona)?.[1] ?? r.name[L];
    const [name, ...rest] = title.split(" · ");
    const line = (label: string) => new RegExp(`^- ${label}:? (.+)$`, "m").exec(persona)?.[1]?.trim() ?? "";
    let skeleton: Skeleton | null = null;
    try { skeleton = rareSkeleton(r); } catch { /* 没生日的人照样能聊，只是没骨架 */ }
    const c: SavedCharacter = {
      id, rareId: r.id, name: name!.trim(), age: Number(/^- Age (\d+)/m.exec(persona)?.[1] ?? 0), location: bare(line("Lives in").split(/[，,]/)[0] ?? ""),
      tagline: rest.join(" · ") || r.name[L], relationToUser: bare(line("The person in front of (?:her|him|them)")),
      persona, schedule, skeleton, createdAt: new Date().toISOString(), chat: [], lang: L,
    };
    saveCharacter(c);
    go(`#/c/${id}`);
  } catch (e) { alert((e as Error).message); route(); }
}

// ── 8. 模型设置 ─────────────────────────────────────────────────────────────

function settingsView(next: string | null, error: string | null) {
  const s = loadSettings();
  const msg = h("div", { class: error ? "error" : "muted" }, error ?? "");
  const field = (label: string, key: keyof Settings, attrs: Record<string, unknown> = {}) =>
    h("div", { class: "field" }, h("label", {}, label), h("input", { class: "input", value: s[key], oninput: (e: Event) => { s[key] = (e.target as HTMLInputElement).value; }, ...attrs }));
  const form = h("div", {});
  const draw = () => form.replaceChildren(
    field(t("settings.baseUrl"), "baseUrl", { class: "input mono" }),
    field(t("settings.apiKey"), "apiKey", { type: "password", class: "input mono", autocomplete: "off", placeholder: s.baseUrl.startsWith("/") ? t("settings.keyLocal") : "sk-…" }),
    field(t("settings.model"), "model", { class: "input mono" }),
    field(t("settings.extra"), "extraBody", { class: "input mono", placeholder: '{"temperature": 0.8}' }),
  );
  draw();
  page("#/settings",
    h("div", { class: "eyebrow" }, t("settings.eyebrow")),
    h("h1", {}, t("settings.h1a"), h("em", {}, t("settings.h1em")), t("settings.h1b")),
    h("p", { class: "lead" }, t("settings.lead")),
    h("div", { class: "row", style: "margin:14px 0" }, ...PRESETS.map((p) => h("button", { class: "btn", onclick: () => { Object.assign(s, { apiKey: "", extraBody: "" }, p.settings); draw(); } }, p.label))),
    form,
    h("div", { class: "row", style: "margin-top:12px" },
      h("button", { class: "btn primary", onclick: () => {
        try { if (s.extraBody.trim()) JSON.parse(s.extraBody); } catch { msg.textContent = t("settings.badJson"); return; }
        saveSettings(s);
        if (!ready(s)) { msg.textContent = t("settings.savedNeed"); return; }
        if (next) go(`#/${next}`); else msg.textContent = t("settings.saved");
      } }, next ? t("settings.saveContinue") : t("settings.save")),
      h("button", { class: "btn", onclick: async () => {
        msg.textContent = t("settings.testing");
        try { const r = await modelFrom(s).chat([{ role: "user", content: "Reply with the single word: ready" }], { maxTokens: 10, temperature: 0 }); msg.textContent = t("settings.works", { reply: r.slice(0, 40) }); }
        catch (e) { msg.textContent = t("settings.failed", { msg: (e as Error).message }); }
      } }, t("settings.test")),
    ),
    msg,
    DEV_PROXY ? h("p", { class: "note" }, t("settings.devNote")) : null,
    anoneSection(),
  );
}

/**
 * 可选：anone.life 的 key（借脸）+ 你自己的 TTS key（出声）。
 * 台词只发给你自己的 TTS；anone.life 只收情绪、脸、开口时刻和时长（docs/ANONE_API.md）。
 * 一个「保存」键存两样——第一次用的人曾经存错了地方。
 */
function anoneSection() {
  const a = loadAnone();
  const v = loadVoice();
  const provider = h("select", { class: "input", onchange: (e: Event) => { v.provider = (e.target as HTMLSelectElement).value as VoiceProvider; } },
    ...(["xai", "openai", "none"] as const).map((p) => h("option", { value: p, ...(v.provider === p ? { selected: true } : {}) }, t(`voice.provider.${p}`))));
  const voiceKey = h("input", { class: "input mono", type: "password", autocomplete: "off", value: v.key, placeholder: "xai-… / sk-…", oninput: (e: Event) => { v.key = (e.target as HTMLInputElement).value; } });
  const msg = h("div", { class: "muted" });
  const base = h("input", { class: "input mono", value: a.base, oninput: (e: Event) => { a.base = (e.target as HTMLInputElement).value; } });
  const key = h("input", { class: "input mono", type: "password", autocomplete: "off", value: a.key, placeholder: "ak_…", oninput: (e: Event) => { a.key = (e.target as HTMLInputElement).value; } });
  return h("section", { style: "margin-top:36px" },
    h("div", { class: "eyebrow" }, t("anone.eyebrow")),
    h("h2", {}, t("anone.h2")),
    h("p", { class: "lead" }, t("anone.leadA"), h("a", { href: `${a.base.replace(/\/+$/, "")}/console`, target: "_blank", rel: "noopener" }, t("anone.console")), t("anone.leadB")),
    clipStrip(t("promo.facesTitle"), t("promo.facesNote"), ["x02", "x03", "x04", "x09"]),
    h("div", { class: "field" }, h("label", {}, t("anone.address")), base),
    h("div", { class: "field" }, h("label", {}, t("anone.key")), key),
    h("p", { class: "muted" }, t("voice.lead")),
    GROK_ONLY ? null : h("div", { class: "field" }, h("label", {}, t("voice.provider")), provider),
    h("div", { class: "field" }, h("label", {}, t("voice.key")), voiceKey),
    h("div", { class: "row", style: "margin-top:10px" },
      h("button", { class: "btn primary", onclick: () => { saveAnone(a); saveVoice(v); resetFaces(); msg.textContent = anoneReady(loadAnone()) ? t("settings.saved") : t("anone.savedNotKey"); } }, t("settings.save")),
      h("button", { class: "btn", onclick: async () => {
        saveAnone(a); saveVoice(v); resetFaces(); msg.textContent = t("anone.checking");
        try { const f = await listFaces(loadAnone()); msg.textContent = t("anone.works", { n: f.length }); }
        catch (e) { msg.textContent = t("anone.failed", { msg: (e as Error).message }); }
      } }, t("settings.test")),
      h("button", { class: "btn", onclick: () => { a.key = ""; saveAnone(a); resetFaces(); (key as HTMLInputElement).value = ""; msg.textContent = t("anone.removed"); } }, t("anone.remove")),
    ),
    msg,
  );
}

// ── 路由 ────────────────────────────────────────────────────────────────────

// ── 首页（第 11 步）──────────────────────────────────────────────────────────

const SEEN_ABOUT = "1t.seenAbout";
function aboutView() {
  try { localStorage.setItem(SEEN_ABOUT, "1"); } catch { /* 记不住就每次都先看首页，无害 */ }
  page("#/about", ...aboutContent(go));
}
/** 第一次打开（没看过首页、没有角色、地址里没指定页面）先进首页。分享来的种子链接照走种子那条路。 */
function firstVisit(): boolean {
  if (location.hash && location.hash !== "#/" && location.hash !== "#") return false;
  try { return !localStorage.getItem(SEEN_ABOUT) && listCharacters().length === 0; } catch { return false; }
}

declare const __LANDING__: string;
/** 不带 #/… 打开时落在哪一页（vite.config.ts）：托管版是 "rare"，开源版是 "about"（只在第一次）。 */
const LANDING = typeof __LANDING__ !== "undefined" ? __LANDING__ : "about";

function route() {
  // 托管版（anone.life/1t）：光秃秃的地址一律先进奇人角色库；点「新建」是 #/，照常进新建页
  if (LANDING === "rare" && !location.hash) history.replaceState(null, "", "#/rare");
  if (firstVisit()) { history.replaceState(null, "", "#/about"); return aboutView(); }
  const hash = location.hash || "#/";
  const seed = /^#seed=([0-9A-Za-z-]+)/.exec(hash);
  if (seed) {
    try {
      // 分享来的种子：带上种子回首页，生日这几项还得自己填
      state.seedText = seed[1]!;
      if (missingBasics().length) { history.replaceState(null, "", "#/"); return startView(); }
      saveDraft({ skeleton: makeSkeleton(), turns: [] });
      history.replaceState(null, "", "#/stranger");
      return strangerView();
    } catch { return startView(); }
  }
  const [path, query] = hash.slice(1).split("?");
  const params = new URLSearchParams(query ?? "");
  // 桌宠页（第 21 步）：#/pet 或 #/pet/<角色 id>；去别的页时把穿透关掉、拆掉监听
  const pet = /^\/pet(?:\/(.+))?$/.exec(path ?? "");
  if (pet) return petView(app, pet[1] ?? null);
  leavePet();
  if (path === "/" || path === "") return startView();
  if (path === "/about") return aboutView();
  if (path === "/rare") return page("#/rare", ...rareContent(go, { can: (r) => hasRarePersona(r.id, lang()), open: (r) => void openRare(r) }));
  if (path === "/stranger") return strangerView();
  if (path === "/chat") return void chatView();
  if (path === "/writing") return void writingView();
  if (path === "/library") return libraryView();
  if (path === "/settings") return settingsView(params.get("next"), params.get("error"));
  const m = /^\/(result|c)\/(.+)$/.exec(path ?? "");
  if (m?.[1] === "result") return resultView(m[2]!);
  if (m?.[1] === "c") return characterView(m[2]!);
  startView();
}
window.addEventListener("hashchange", route);
route();
// 第 23 步：启动时把「anone.life 的人」下载到本地（有 key 才会做；每次打开只做一次）
void syncAnonePeopleOnce(loadAnone(), lang());
