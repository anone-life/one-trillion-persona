// One-Trillion Persona 网页版。页面：选维度 → 看陌生人 → 和 Elise 聊 → 写人设 → 结果 → 角色库 → 和角色聊。
// 结构见 docs/ARCHITECTURE.md。
import "./app.css";
import {
  ALL_LAYERS, BIRTHPLACES, DEFAULT_ASK, LAYERS, buildSkeleton, countryLabel, describe, formatSeed, layerCount, localizedLayers,
  REMOVABLE_LAYERS, parseSeed, placeById, placeLabel, randomSeed, rebuildSkeleton, type Skeleton,
} from "@1t-persona/core";
import {
  DESIGNER_NAME, DesignerSession, finalize, generatePersona, generateSchedule, pronounsFor,
} from "@1t-persona/designer/browser";
import { cardInputFromPersona, packAnone, readAnone, toCardV2 } from "@1t-persona/files";
import { DEV_PROXY, PRESETS, loadSettings, modelFrom, ready, saveSettings, type Settings } from "./llm.ts";
import { AnoneError, EMOTIONS, anoneReady, listFaces, loadAnone, resetFaces, saveAnone, spokenText, takeEmotion, type Face } from "./anone.ts";
import { loadVoice, saveVoice, voiceLine, voiceReady, type VoiceProvider } from "./voice.ts";
import { Stage } from "./player.ts";
import { aboutContent } from "./about.ts";
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
    h("nav", {}, link("#/about", t("nav.about")), link("#/", t("nav.new")), link("#/library", t("nav.library")), link("#/settings", t("nav.model")),
      h("span", { class: "langs" }, ...LANG_OPTIONS.map((o) => h("button", {
        class: `lang${o.id === lang() ? " on" : ""}`, "aria-pressed": String(o.id === lang()),
        onclick: () => { if (o.id !== lang()) { setLang(o.id); route(); } },
      }, o.label)))),
  );
}
function page(active: string, ...children: Child[]) {
  app.replaceChildren(h("div", { class: "wrap" }, masthead(active), ...children));
  window.scrollTo(0, 0);
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
    window.scrollTo(0, document.body.scrollHeight);
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

  page("#/chat",
    h("div", { class: "eyebrow" }, t("chat.eyebrow", { name: DESIGNER_NAME, seed: draft.skeleton.seed })),
    h("details", {}, h("summary", { class: "muted" }, t("chat.showStranger")), ...strangerCards(session.skeleton)),
    log,
    h("div", { class: "composer" }, h("div", { class: "in" }, box, send, done)),
  );
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
  const file = h("input", { type: "file", accept: ".anone,application/x-anone,application/zip", style: "display:none" }) as HTMLInputElement;
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const a = await readAnone(new Uint8Array(await f.arrayBuffer()));
      const tagline = /^# .+? · (.+)$/m.exec(a.persona)?.[1] ?? String(a.info.tagline_en ?? "");
      saveCharacter({
        id: crypto.randomUUID(), name: String(a.info.name), age: Number(a.info.age), location: String(a.info.location ?? ""), tagline,
        relationToUser: /^- The person in front of \w+: (.+?)\.?$/m.exec(a.persona)?.[1] ?? "", persona: a.persona,
        schedule: a.schedule ?? {}, skeleton: a.skeleton ?? null, createdAt: a.manifest.createdAt, chat: [],
        ...(typeof a.info.avatarId === "string" ? { avatarId: a.info.avatarId } : {}),
      });
      libraryView();
    } catch (e) { err.textContent = t("lib.importFail", { msg: (e as Error).message }); }
    file.value = "";
  };
  const all = listCharacters();
  page("#/library",
    h("div", { class: "eyebrow" }, t("lib.eyebrow")),
    h("h1", {}, t("lib.h1a"), h("em", {}, t("lib.h1em")), t("lib.h1b")),
    h("div", { class: "row", style: "margin-top:14px" }, h("button", { class: "btn primary", onclick: () => go("#/") }, t("lib.new")), h("button", { class: "btn", onclick: () => file.click() }, t("lib.import")), file),
    err,
    all.length ? h("div", { class: "lib" }, ...all.map((c) => h("div", { class: "item" },
      h("div", { class: "who" }, h("b", {}, c.name), h("div", {}, `${c.tagline} · ${c.age}${c.skeleton ? ` · ${c.skeleton.seed}` : ""}`)),
      h("button", { class: "btn primary", onclick: () => go(`#/c/${c.id}`) }, t("lib.talk")),
      h("button", { class: "btn", onclick: () => go(`#/result/${c.id}`) }, t("lib.open")),
      h("button", { class: "btn", "aria-label": t("lib.deleteAria", { name: c.name }), onclick: () => { if (confirm(t("lib.deleteConfirm", { name: c.name }))) { deleteCharacter(c.id); libraryView(); } } }, t("lib.delete")),
    ))) : h("div", {}, h("p", { class: "muted", style: "margin-top:20px" }, t("lib.empty")),
      clipStrip(t("promo.libTitle"), t("promo.libNote"), ["x07", "x06", "x05", "x08"])),
  );
}

// ── 7. 和角色聊 ─────────────────────────────────────────────────────────────

function characterSystem(c: SavedCharacter, withEmotion: boolean): string {
  const p = c.skeleton ? pronounsFor(c.skeleton) : { subj: "they" };
  return [
    c.persona,
    "",
    "## This conversation",
    `You are ${c.name}. Stay in character. You're texting with the person described above (${c.relationToUser || "someone you know"}).`,
    `Reply the way ${c.name} would text: natural, usually short, no narration or stage directions, no lists. Never mention being an AI character or a persona file unless asked directly — and if asked directly whether ${p.subj === "they" ? "they're" : `${p.subj}'s`} an AI, say so honestly, in character.`,
    ...(c.lang && c.lang !== "en" ? [`Reply in ${LANG_NAME[c.lang]}, unless the user clearly writes to you in another language.`] : []),
    ...(withEmotion ? [`Start every reply with exactly one tag for how ${c.name} feels saying it — one of ${EMOTIONS.map((e) => `[${e}]`).join(" ")} — then the reply. The tag is never shown; it moves ${c.name}'s face.`] : []),
  ].join("\n");
}

function characterView(id: string) {
  const c = getCharacter(id);
  if (!c) return go("#/library");
  const settings = loadSettings();
  if (!ready(settings)) return go(`#/settings?next=c/${id}`);
  const model = modelFrom(settings);
  const anone = loadAnone();
  const live = anoneReady(anone);
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
      m.role === "assistant" ? h("span", { class: "who" }, c.name) : null, shown(m),
      m.role === "assistant" && i > 0 ? h("button", { class: "bubble-tool", title: t("retune.button"), onclick: () => openRetune(i) }, t("retune.button")) : null,
    )), status);
    window.scrollTo(0, document.body.scrollHeight);
  };

  const drawFaceBar = (faces: Face[] | null, err?: string) => {
    if (!live) {
      const peekSlot = h("div", { class: "promo-peek" });
      const peek = h("button", { class: "linkish", type: "button", onclick: () => { peekSlot.replaceChildren(clipCard("x02")); peek.remove(); } }, t("promo.peek"));
      faceBar.replaceChildren(h("p", { class: "muted" }, t("face.textOnlyA", { name: c.name }), h("a", { href: "#/settings" }, t("nav.model")), t("face.textOnlyB"), " ", peek), peekSlot);
      return;
    }
    if (err) { faceBar.replaceChildren(h("p", { class: "error" }, err)); return; }
    if (!faces) { faceBar.replaceChildren(h("p", { class: "muted" }, t("face.loading"))); return; }
    face = faces.find((f) => f.id === c.avatarId) ?? null;
    stage.setFace(face);
    faceBar.replaceChildren(
      h("div", { class: "faces-pick" }, ...faces.map((f) => h("button", {
        class: `face-opt${f.id === c.avatarId ? " on" : ""}`, title: `${f.label}${f.gender ? ` · ${f.gender}` : ""}`,
        onclick: () => { c.avatarId = f.id; saveCharacter(c); drawFaceBar(faces); },
      }, h("img", { src: f.poster, alt: f.label, loading: "lazy" }), h("span", {}, f.label)))),
      ...(face ? [] : [h("p", { class: "muted" }, t("face.pick", { name: c.name }))]),
    );
  };
  if (live) listFaces(anone).then((f) => drawFaceBar(f), (e) => drawFaceBar(null, t("face.loadFail", { msg: (e as Error).message })));
  drawFaceBar(null);

  let silentHinted = false;
  /** 对着聊天记录的最后一句（他说的）生成她的回复；发消息和「从这句重来」共用。 */
  const respond = async () => {
    if (busy) return;
    if (face) { stage.unlock(); stage.thinking(); }
    busy = true; send.disabled = true;
    status.textContent = t("chat.typing", { name: c.name });
    try {
      const reply = await model.chat([{ role: "system", content: characterSystem(c, !!face) }, ...c.chat.slice(-30)], { temperature: 0.9, maxTokens: 400 });
      c.chat.push({ role: "assistant", content: reply });
      saveCharacter(c);
      status.textContent = ""; redraw();
      if (face) {
        const { emotion, text: said } = takeEmotion(reply);
        const line = spokenText(said);
        if (line) {
          status.textContent = t("char.speaking", { name: c.name });
          try {
            // 台词只给玩家自己的 TTS；anone.life 只收情绪、脸、开口时刻和时长
            const voice = loadVoice();
            const spoken = await voiceLine(anone, voice, face, { text: line.slice(0, 300), emotion, lang: c.lang ?? "en" });
            if (!voiceReady(voice) && !silentHinted) { silentHinted = true; log.append(h("div", { class: "bubble sys" }, t("face.silent"))); }
            await stage.play(spoken); // 时间表最后一段就是 idle，不用再切
          } catch (e) {
            const msg = e instanceof AnoneError && e.status === 429 ? t("face.dailyLimit") : t("face.voiceFail", { msg: (e as Error).message });
            log.append(h("div", { class: "bubble sys" }, msg));
            stage.idle();
          }
        }
      }
    } catch (e) { log.append(h("div", { class: "bubble sys" }, t("chat.error", { msg: (e as Error).message }))); throw e; }
    finally { busy = false; send.disabled = false; status.textContent = ""; }
  };
  send.onclick = async () => {
    const text = box.value.trim();
    if (!text || busy) return;
    box.value = "";
    c.chat.push({ role: "user", content: text }); redraw();
    try { await respond(); } catch { c.chat.pop(); saveCharacter(c); }
  };
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.click(); } };
  page("#/library",
    h("div", { class: "eyebrow" }, `${c.name} · ${c.tagline}`),
    faceBar,
    stage.el,
    log,
    retuneSlot,
    h("div", { class: "composer" }, h("div", { class: "in" }, box, send)),
  );
  redraw();
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
    ...(["none", "xai", "openai"] as const).map((p) => h("option", { value: p, ...(v.provider === p ? { selected: true } : {}) }, t(`voice.provider.${p}`))));
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
    h("div", { class: "field" }, h("label", {}, t("voice.provider")), provider),
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

function route() {
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
  if (path === "/" || path === "") return startView();
  if (path === "/about") return aboutView();
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
