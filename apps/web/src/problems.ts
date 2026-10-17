// 介绍页「问题」一节：SillyTavern 玩家抱怨什么（r/SillyTavernAI 一年的帖子），每类由谁解决。
// 数字从 tools/st_pain_survey.ts 的输出（runs/st-survey/counts.json）手抄过来，网页不去现取。
// 方法和抽查结果：根文档仓库 docs/1T-persona/steps/step13_problem_data.md。
import { ANONE_URL } from "./promo.ts";
import { t, type Key } from "./i18n.ts";

export const SURVEY = {
  from: "2025-10-17", to: "2026-10-16",
  posts: 13054, complaints: 2690, accuracy: 83, // 抽查准确率（%）：第 2 轮人读 178 条对 148 条；model 再分 60 条对 49 条（82%）
  rows: [ // runs/st-survey/counts.json（2026-10-18 第 2 轮），按帖子数排；不含 other
    // 原来的「模型本身」921 篇按第 2 次修订再分成三行（runs/st-survey/model_split.jsonl，抽查 49/60）
    { id: "quality", posts: 324 }, { id: "refusal", posts: 306 }, { id: "prompt", posts: 291 }, { id: "slop", posts: 286 }, { id: "setup", posts: 278 }, { id: "memory", posts: 244 },
    { id: "sameness", posts: 192 }, { id: "cost", posts: 160 }, { id: "cards", posts: 93 },
    { id: "visual_voice", posts: 19 }, { id: "proactive", posts: 19 },
  ] as { id: Problem; posts: number }[],
  other: 478,
  // 「拒绝、审查」占抱怨帖的比例：前 3 个月（到 2026-01-16）vs 后 9 个月（按月统计，step13 文档第 4 次修订前那段）
  refusalTrend: { before: 6.7, after: 12.5 },
};

type Problem = "memory" | "sameness" | "slop" | "cards" | "visual_voice" | "setup" | "cost" | "proactive" | "prompt" | "refusal" | "quality";
type Owner = "1t" | "anone" | "anonePartial" | "both" | "partial" | "none";
/** 谁解决：照 Learning_from_Silly_Tavern.md §1 和 1T-persona.md §16.2 已经定下的。 */
const OWNER: Record<Problem, Owner> = {
  memory: "anone", sameness: "1t", slop: "partial", cards: "1t",
  visual_voice: "anone", cost: "none", proactive: "both", prompt: "partial", quality: "none",
  setup: "both", // anone.life 打开网站就能聊，比 1T 更彻底（第 5 次修订）
  refusal: "anonePartial", // 2026-10-18 用户：anone.life 用开源模型、开放度更好；数据：拒绝帖里 32% 只提开源模型，所以是「部分」
};

type Kid = Node | string | null;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

const ORDER: (Owner | "other")[] = ["1t", "partial", "both", "anone", "anonePartial", "none", "other"];

/** 导语后面的总览：一条按「谁解决」分段的堆叠横条 + 三条发现。数都从上面的 SURVEY 现算。 */
export function problemsSummary(): HTMLElement {
  const total = SURVEY.complaints;
  const by = new Map<Owner | "other", number>([["other", SURVEY.other]]);
  for (const r of SURVEY.rows) by.set(OWNER[r.id], (by.get(OWNER[r.id]) ?? 0) + r.posts);
  const pct = (n: number) => Math.round((n / total) * 100);
  const label = (o: Owner | "other") => t(`about.problem.owner.${o}` as Key);
  const bar = el("div", { class: "pb-stack", role: "img", "aria-label": ORDER.map((o) => `${label(o)} ${pct(by.get(o) ?? 0)}%`).join(", ") });
  const legend = el("ul", { class: "pb-legend" });
  for (const o of ORDER) {
    const n = by.get(o) ?? 0;
    if (!n) continue;
    bar.append(el("span", { class: `pb-seg pb-${o}`, style: `width:${((n / total) * 100).toFixed(2)}%` }));
    legend.append(el("li", { class: `pb-${o}` }, el("i", {}), label(o), el("b", {}, ` ${pct(n)}%`)));
  }
  const fixable = total - SURVEY.other - (by.get("none") ?? 0);
  const model = SURVEY.rows.filter((r) => r.id === "quality" || r.id === "refusal" || r.id === "prompt").reduce((s, r) => s + r.posts, 0);
  const prompt = SURVEY.rows.find((r) => r.id === "prompt")!.posts;
  const finding = (big: string, key: Key, vars: Record<string, string>) =>
    el("div", { class: "pb-finding" }, el("div", { class: "pb-big" }, big), el("p", {}, t(key, vars)));
  return el("div", { class: "pb-summary" },
    bar, legend,
    el("div", { class: "pb-findings" },
      finding(`${pct(fixable)}%`, "about.problem.f1", { none: String(pct(by.get("none") ?? 0)) }),
      finding(`${Math.round((prompt / model) * 100)}%`, "about.problem.f2", { model: String(pct(model)), prompt: prompt.toLocaleString("en-US"), all: model.toLocaleString("en-US") }),
      finding(`×${(SURVEY.refusalTrend.after / SURVEY.refusalTrend.before).toFixed(1)}`, "about.problem.f3", { before: String(SURVEY.refusalTrend.before), after: String(SURVEY.refusalTrend.after) }),
    ),
  );
}

/** 1T 那几行出自同一套方法：问题 → 方法的对照，再跳到八层图（第 6 次修订）。 */
function methodBridge(): HTMLElement {
  const rows: [Problem, Key][] = [["sameness", "about.problem.m.sameness"], ["prompt", "about.problem.m.prompt"], ["cards", "about.problem.m.cards"], ["slop", "about.problem.m.slop"]];
  const go = el("a", { class: "btn", href: "#about-layers" }, t("about.problem.methodCta"));
  go.onclick = (e) => { e.preventDefault(); document.getElementById("about-layers")?.scrollIntoView({ behavior: "smooth" }); };
  return el("div", { class: "pb-method-bridge" },
    el("div", { class: "eyebrow" }, t("about.problem.methodEyebrow")),
    el("h3", {}, t("about.problem.methodTitle")),
    el("p", { class: "pb-mb-lead" }, t("about.problem.methodLead")),
    el("ul", { class: "pb-mb-list" }, ...rows.map(([id, k]) =>
      el("li", {}, el("span", { class: "pb-mb-problem" }, t(`about.problem.cat.${id}` as Key)), el("span", { class: "pb-mb-arrow" }, "→"), el("span", { class: "pb-mb-method" }, t(k))))),
    go,
  );
}

export function problemsChart(): HTMLElement {
  const max = Math.max(...SURVEY.rows.map((r) => r.posts));
  const pct = (n: number) => `${Math.round((n / SURVEY.complaints) * 100)}%`;
  const list = el("ol", { class: "problems" });
  for (const r of SURVEY.rows) {
    const owner = OWNER[r.id];
    const how = el("p", { class: "pb-how" }, t(`about.problem.how.${r.id}` as Key));
    if (owner === "anone" || owner === "anonePartial" || owner === "both") how.append(" ", el("a", { href: ANONE_URL, target: "_blank", rel: "noopener" }, t("about.problem.toAnone")));
    if (r.id === "prompt" || r.id === "sameness" || r.id === "slop" || r.id === "cards" || r.id === "proactive") { // 理论那节讲得到的才链
      const a = el("a", { href: "#about-theory" }, t("about.problem.toTheory"));
      a.onclick = (e) => { e.preventDefault(); document.getElementById("about-theory")?.scrollIntoView({ behavior: "smooth" }); };
      how.append(" ", a);
    }
    list.append(el("li", { class: `pb-row pb-${owner}` },
      el("div", { class: "pb-top" },
        el("span", { class: "pb-name" }, t(`about.problem.cat.${r.id}` as Key)),
        el("span", { class: "pb-tag" }, t(`about.problem.owner.${owner}` as Key)),
      ),
      el("div", { class: "pb-barline" },
        el("div", { class: "pb-track" }, el("div", { class: "pb-bar", style: `width:${((r.posts / max) * 100).toFixed(1)}%` })),
        el("span", { class: "pb-num" }, pct(r.posts), el("small", {}, ` · ${r.posts.toLocaleString("en-US")}`)),
      ),
      how,
    ));
  }
  return el("div", { class: "problems-wrap" },
    list,
    methodBridge(),
    el("p", { class: "pb-method" }, t("about.problem.method", {
      posts: SURVEY.posts.toLocaleString("en-US"), complaints: SURVEY.complaints.toLocaleString("en-US"),
      other: SURVEY.other.toLocaleString("en-US"), acc: String(SURVEY.accuracy), from: SURVEY.from, to: SURVEY.to,
    })),
  );
}
