// anone.life 的功能短片，穿插在 1T 网页里：让玩家看到 1T 没有、anone.life 有的东西。
// 两组，都是 30–50 秒的竖版片，中日英三版齐全：
//   x 系列：一支讲一个功能（会动的立绘、打电话看得到脸、记得约定……）
//   n 系列：一支切中一个需求（想有人听我说、想被记得、想被惦记、只对我不一样的人）
// 片子在 anone.life 的 CDN 上，不进这个仓库。片单（名字、一句话、片长）从 anone.life 的
// src/client/films.ts 抄来——那边重剪了片子，这里的秒数要跟着改。
// 落地文档：根仓库 docs/1T-persona/steps/step12_anone_videos.md。
import type { Lang } from "@1t-persona/core";
import { lang, t } from "./i18n.ts";

const BASE = "https://d1gjo8gsizey84.cloudfront.net/anone/films/";
/** `?f=1t` 只是来源标记（anone.life 首页认它），不带任何用户数据。 */
export const ANONE_URL = "https://www.anone.life/?f=1t";

interface Clip { dir: "x" | "n"; name: Record<Lang, string>; line: Record<Lang, string>; seconds: Record<Lang, number> }

const CLIPS = {
  x02: { dir: "x", name: { ja: "動く立ち絵", zh: "会动的立绘", en: "A living portrait" }, line: { ja: "聞く・考える・話す。ぜんぶ、その場で。", zh: "听、想、说，每一刻都是她。", en: "Listening, thinking, speaking — all live." }, seconds: { ja: 30, zh: 25, en: 27 } },
  x03: { dir: "x", name: { ja: "通話中も、顔が見える", zh: "打电话时看得到她", en: "See her on the call" }, line: { ja: "一言で、表情が変わる。", zh: "一句话，她的脸就变了。", en: "One sentence, and her face changes." }, seconds: { ja: 30, zh: 30, en: 30 } },
  x04: { dir: "x", name: { ja: "いなくなって、戻ってくる", zh: "她走开，又回来", en: "She leaves, and comes back" }, line: { ja: "画面から出て、着替えて、帰ってくる。", zh: "走出画面，换好衣服再走回来。", en: "Out of frame, a change of clothes, and back." }, seconds: { ja: 31, zh: 31, en: 31 } },
  x05: { dir: "x", name: { ja: "行く場所に、ついていく", zh: "她去哪，你就在哪", en: "Wherever she goes" }, line: { ja: "背景も音も、彼女についていく。", zh: "背景和声音跟着她走。", en: "The scene and the sound follow her." }, seconds: { ja: 30, zh: 30, en: 30 } },
  x06: { dir: "x", name: { ja: "彼女の一日", zh: "她有自己的一天", en: "Her own day" }, line: { ja: "出かけて、過ごして、帰ってくる。", zh: "出门、在外、回家。", en: "Out the door, out in the world, back home." }, seconds: { ja: 30, zh: 30, en: 30 } },
  x07: { dir: "x", name: { ja: "約束を覚えている", zh: "她记得约定", en: "She keeps promises" }, line: { ja: "時間になると、先に行って待っている。", zh: "到点了，她先去等你。", en: "When it's time, she's there first." }, seconds: { ja: 29, zh: 29, en: 29 } },
  x08: { dir: "x", name: { ja: "ツーショット", zh: "和她合影", en: "A photo together" }, line: { ja: "同じ場所にいるとき、ふたりで写る。", zh: "在同一个地方时，拍两个人的。", en: "When you're in the same place, both of you." }, seconds: { ja: 30, zh: 30, en: 30 } },
  x09: { dir: "x", name: { ja: "演じてくれるシナリオ", zh: "会演的剧本", en: "A story she performs" }, line: { ja: "台詞は彼女の声で。表情は一拍ごとに。", zh: "每句她来念，每一拍换一张脸。", en: "Her voice for every line, a new face every beat." }, seconds: { ja: 29, zh: 29, en: 29 } },
  n04: { dir: "n", name: { ja: "話を聞いてほしい", zh: "想有人听我说", en: "Someone to listen" }, line: { ja: "今日のこと、そのまま話して。", zh: "今天的事，直接说给她听。", en: "Tell her about today, just as it was." }, seconds: { ja: 37, zh: 34, en: 34 } },
  n05: { dir: "n", name: { ja: "覚えていてほしい", zh: "想被记得", en: "Someone who remembers" }, line: { ja: "何気ない約束も、覚えている。", zh: "随口的约定，她也记得。", en: "Even a passing promise, she keeps." }, seconds: { ja: 39, zh: 38, en: 36 } },
  n06: { dir: "n", name: { ja: "気にかけてほしい", zh: "想被惦记", en: "Someone who thinks of you" }, line: { ja: "彼女にも一日があって、そこにあなたがいる。", zh: "她有自己的一天，里面有你。", en: "She has her own day, and you're in it." }, seconds: { ja: 35, zh: 33, en: 32 } },
  n07: { dir: "n", name: { ja: "あなたにだけ、違う人", zh: "只对我不一样的人", en: "Different, only with you" }, line: { ja: "口数は少ない。でも、ちゃんと聞いている。", zh: "话很少，但他一直在听。", en: "Few words. But he's listening." }, seconds: { ja: 48, zh: 48, en: 41 } },
} satisfies Record<string, Clip>;

export type ClipId = keyof typeof CLIPS;

/** 某一支在当前界面语言下的地址：`<目录>/<片号>.<ja|zh|en>.mp4 / .jpg`（三种语言都出齐了）。 */
export function clipFiles(id: ClipId, l: Lang = lang()) {
  const c = CLIPS[id];
  return { video: `${BASE}${c.dir}/${id}.${l}.mp4`, poster: `${BASE}${c.dir}/${id}.${l}.jpg` };
}

type Child = Node | string;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: Child[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (k === "class") e.className = v; else e.setAttribute(k, v);
  e.append(...children);
  return e;
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** 一张卡：先只放封面，点了才换成视频开始下载（每支约 4MB，不让页面一打开就下）。 */
export function clipCard(id: ClipId): HTMLElement {
  const c = CLIPS[id];
  const l = lang();
  const f = clipFiles(id, l);
  const cover = el("button", { class: "promo-cover", type: "button", "aria-label": t("promo.play", { name: c.name[l] }) },
    el("img", { src: f.poster, alt: "", loading: "lazy" }),
    el("span", { class: "promo-play", "aria-hidden": "true" }, "▶"),
    el("span", { class: "promo-len" }, fmtTime(c.seconds[l])));
  const card = el("figure", { class: "promo-card" }, cover,
    el("figcaption", {}, el("b", {}, c.name[l]), el("span", {}, c.line[l])));
  cover.addEventListener("click", () => {
    const v = el("video", { src: f.video, poster: f.poster, controls: "", playsinline: "", preload: "auto" });
    cover.replaceWith(v);
    void v.play().catch(() => { /* 浏览器不让自动播就等用户点 */ });
  });
  return card;
}

/** 一组卡加标题、一句说明和「去 anone.life 看看」链接。 */
export function clipStrip(title: string, note: string, ids: ClipId[]): HTMLElement {
  return el("section", { class: "promo" },
    el("div", { class: "promo-head" }, title),
    el("p", { class: "promo-note" }, note),
    el("div", { class: "promo-grid" }, ...ids.map(clipCard)),
    el("a", { class: "promo-more", href: ANONE_URL, target: "_blank", rel: "noopener" }, t("promo.more")));
}
