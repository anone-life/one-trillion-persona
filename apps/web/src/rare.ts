// 「奇人」页 #/rare：10 个平时遇不到的人，每个都从「陌生人 · 初次见面」开始。
// 数据在 rare-data.ts；层的显示文字按界面语言从 1T 词表取。设计见根文档仓库 docs/1T-persona/steps/step16_rare_gallery.md。
import { godLabel, localizedLayers } from "@1t-persona/core";
import { lang, t } from "./i18n.ts";
import { RARE, type Rare } from "./rare-data.ts";
import { rarePhoto } from "./rare/assets.ts";
import { RARE_NAMES } from "./rare/names.ts";

type Kid = Node | string | null;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

/** 「和 TA 聊」：本机有这个人这种语言的预生成人设才出按钮（第 20 步）。 */
export interface RareTalk { can: (r: Rare) => boolean; open: (r: Rare) => void }

/** 八层档案表（内心 + 外在七层）。列表卡不再放，挪到聊天页情境卡里（第 23 步）。 */
export function rareProfile(r: Rare, L = lang()): HTMLElement {
  const layers = localizedLayers(L);
  const value = (path: string) => {
    const [lid, fid] = path.split(".");
    const f = layers.find((l) => l.id === lid)?.fields.find((x) => x.id === fid);
    return f?.values.find((v) => v.id === r.layers[path])?.label ?? r.layers[path]!;
  };
  const [g1, g2] = r.gods.map((g) => godLabel(g, L)!);
  const sep = L === "en" ? " · " : "・";
  return el("details", { class: "rare-profile" }, el("summary", {}, t("rare.profile")), el("table", {}, el("tbody", {},
    el("tr", {}, el("th", {}, t("rare.inner")), el("td", {},
      el("b", {}, `${g1!.name} + ${g2!.name}`),
      el("div", {}, el("span", { class: "rare-k" }, t("rare.wants")), `${g1!.want} ${g2!.want}`),
      el("div", {}, el("span", { class: "rare-k" }, t("rare.price")), g1!.cost),
      el("div", {}, el("span", { class: "rare-k" }, t("rare.breaks")), g1!.break))),
    ...layers.map((l) => el("tr", {}, el("th", {}, l.name), el("td", {}, l.fields.map((f) => value(`${l.id}.${f.id}`)).join(sep)))))));
}

/** 列表卡：照 anone.life 选角色页——上面整张图（带背景，不用抠图），下面真名、称呼、年代 · 城市；点卡就聊（第 23 步）。 */
function card(r: Rare, layers: ReturnType<typeof localizedLayers>, talk?: RareTalk): HTMLElement {
  const L = lang();
  const value = (path: string) => {
    const [lid, fid] = path.split(".");
    const f = layers.find((l) => l.id === lid)?.fields.find((x) => x.id === fid);
    return f?.values.find((v) => v.id === r.layers[path])?.label ?? r.layers[path]!;
  };
  const sep = L === "en" ? " · " : "・";
  const name = RARE_NAMES[r.id]?.[L] ?? r.name[L];
  const src = rarePhoto(r.id);
  const can = !!talk?.can(r);
  const c = el("article", { class: `rare-card${can ? " can" : ""}`, id: `rare-${r.id}`, ...(can ? { tabindex: "0", role: "button", "aria-label": `${name} · ${t("rare.talk")}` } : {}) },
    el("div", { class: "rc-img" },
      src ? el("img", { src, alt: name, loading: "lazy" }) : el("div", { class: "rc-blank", "aria-hidden": "true" }, [...name][0] ?? ""),
      el("span", { class: "rc-n" }, r.id)),
    el("div", { class: "rc-body" },
      el("h3", {}, name),
      el("div", { class: "rc-title" }, r.name[L]),
      el("div", { class: "rc-meta" }, [value("world.era"), value("world.city")].join(sep))));
  if (can) {
    const open = () => { if (c.classList.contains("opening")) return; c.classList.add("opening"); talk!.open(r); };
    c.onclick = open;
    c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
  }
  return c;
}

/** 顶部的筛选标签：同一组里选几个算「或」，不同组之间算「且」。只在这一页的内存里记，换页就清。 */
const FILTER_GROUPS = ["world.era", "body.embodiment", "body.gender_present", "world.city"] as const;
const picked = new Map<string, Set<string>>(FILTER_GROUPS.map((g) => [g, new Set<string>()]));

export function rareContent(go: (hash: string) => void, talk?: RareTalk): HTMLElement[] {
  const layers = localizedLayers(lang());
  const cta = el("button", { class: "btn primary" }, t("rare.cta"));
  cta.onclick = () => go("#/");
  const cards = new Map(RARE.map((r) => [r.id, card(r, layers, talk)]));
  // 「只有声音」的人没有照片，排在最后，前面隔一张同尺寸的分隔卡（用户 2026-10-18）。
  const voiceOnly = (r: Rare) => r.layers["body.embodiment"] === "voice-only";
  const divider = el("div", { class: "rare-card rare-divider", role: "separator" }, el("div", { class: "rc-img" }, el("div", { class: "rc-divtext" }, t("rare.voiceDivider"))));
  const grid = el("div", { class: "rare-grid" },
    ...RARE.filter((r) => !voiceOnly(r)).map((r) => cards.get(r.id)!), divider, ...RARE.filter(voiceOnly).map((r) => cards.get(r.id)!));
  const count = el("span", { class: "rare-count" });
  const empty = el("p", { class: "muted rare-empty" }, t("rare.none"));
  const fieldOf = (path: string) => { const [l, f] = path.split("."); return layers.find((x) => x.id === l)!.fields.find((x) => x.id === f)!; };
  const groups = FILTER_GROUPS.map((path) => {
    const f = fieldOf(path);
    const used = new Set(RARE.map((r) => r.layers[path]!));
    const chips = f.values.filter((v) => used.has(v.id)).map((v) => {
      const n = RARE.filter((r) => r.layers[path] === v.id).length;
      const b = el("button", { type: "button", class: "rare-chip", "aria-pressed": String(picked.get(path)!.has(v.id)) }, v.label, el("small", {}, ` ${n}`));
      b.onclick = () => { const s = picked.get(path)!; if (s.has(v.id)) s.delete(v.id); else s.add(v.id); b.setAttribute("aria-pressed", String(s.has(v.id))); apply(); };
      return b;
    });
    return el("div", { class: "rare-fgroup" }, el("span", { class: "rare-flabel" }, path === "body.gender_present" ? t("rare.gender") : f.label), ...chips);
  });
  const clear = el("button", { type: "button", class: "btn-link" }, t("rare.clear"));
  clear.onclick = () => { for (const s of picked.values()) s.clear(); for (const b of document.querySelectorAll(".rare-chip")) b.setAttribute("aria-pressed", "false"); apply(); };
  // 筛选标签默认收起，只露一行「筛选 ▾ · 计数 · 清除」；点「筛选」展开（第 23 步，用户 2026-10-18）。
  const body = el("div", { class: "rare-fbody", id: "rare-fbody" }, ...groups);
  const toggle = el("button", { type: "button", class: "rare-ftoggle", "aria-controls": "rare-fbody" });
  const setOpen = (o: boolean) => { body.hidden = !o; toggle.setAttribute("aria-expanded", String(o)); };
  toggle.onclick = () => setOpen(body.hidden);
  setOpen(false);
  function apply() {
    let n = 0;
    for (const r of RARE) {
      const show = FILTER_GROUPS.every((g) => { const s = picked.get(g)!; return s.size === 0 || s.has(r.layers[g]!); });
      cards.get(r.id)!.hidden = !show;
      if (show) n++;
    }
    divider.hidden = !RARE.some((r) => voiceOnly(r) && !cards.get(r.id)!.hidden);
    count.textContent = t("rare.count", { n: String(n), total: String(RARE.length) });
    const k = [...picked.values()].reduce((a, s) => a + s.size, 0);
    toggle.textContent = k ? `${t("rare.filters")} · ${k}` : t("rare.filters");
    empty.hidden = n > 0;
    clear.hidden = [...picked.values()].every((s) => s.size === 0);
  }
  apply();
  return [
    el("div", { class: "eyebrow" }, t("rare.eyebrow")),
    el("h1", {}, t("rare.title")),
    el("p", { class: "lead" }, t("rare.lead")),
    el("section", { class: "rare-rel" },
      el("h2", {}, t("rare.relTitle")),
      el("ol", {}, el("li", {}, t("rare.rel1")), el("li", {}, t("rare.rel2")), el("li", {}, t("rare.rel3")))),
    el("section", { class: "rare-filters", "aria-label": t("rare.filters") }, el("div", { class: "rare-fbar" }, toggle, count, clear), body),
    grid,
    empty,
    el("div", { class: "rare-foot" }, el("p", { class: "muted" }, t("rare.note")), cta),
  ];
}
