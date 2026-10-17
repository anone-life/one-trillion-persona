// 首页 #/about：这是什么、八层的理论、那张图、数量级、我们不说什么、参考文献。
// 第一次打开网页时先到这里（main.ts 的 route()）。设计见根文档仓库 docs/1T-persona/steps/step11_theory_page.md。
import { layersDiagram, layersList } from "./diagram.ts";
import { problemsChart, problemsSummary, SURVEY } from "./problems.ts";
import { t, type Key } from "./i18n.ts";

type Kid = Node | string | null;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

/** 10¹⁸ 这种：底数 + 上标指数。 */
function power(mant: string, exp: string): HTMLElement {
  return el("span", { class: "pow" }, `${mant} × 10`, el("sup", {}, exp));
}

const REFERENCES = [
  "Mischel, W., & Shoda, Y. (1995). A cognitive-affective system theory of personality. Psychological Review, 102(2), 246–268.",
  "McAdams, D. P., & Pals, J. L. (2006). A new Big Five: Fundamental principles for an integrative science of personality. American Psychologist, 61(3), 204–217.",
  "Fleeson, W., & Gallagher, P. (2009). The implications of Big Five standing for the distribution of trait manifestation in behavior. Journal of Personality and Social Psychology, 97(6), 1097–1114.",
  "Cheung, F. M., et al. (2001). Indigenous Chinese personality constructs: Is the five-factor model complete? Journal of Cross-Cultural Psychology, 32(4), 407–433.",
  "McAdams, D. P., & McLean, K. C. (2013). Narrative identity. Current Directions in Psychological Science, 22(3), 233–238.",
  "Goffman, E. (1959). The Presentation of Self in Everyday Life. Doubleday.",
  "Allport, G. W. (1937). Personality: A Psychological Interpretation. Holt.",
  "Jung, S. A., & Yang, C. S. (2015). Relations between Eastern Four Pillars Theory and Western measures of personality traits. Yonsei Medical Journal, 56(3), 698–704.",
  "Forer, B. R. (1949). The fallacy of personal validation. Journal of Abnormal and Social Psychology, 44(1), 118–123.",
];

export function aboutContent(go: (hash: string) => void): HTMLElement[] {
  const cta = (label: Key) => { const b = el("button", { class: "btn primary about-cta" }, t(label)); b.onclick = () => go("#/"); return b; };
  const section = (id: string, eyebrow: Key, title: Key, ...kids: Kid[]) =>
    el("section", { class: "about-sec", id }, el("div", { class: "eyebrow" }, t(eyebrow)), el("h2", {}, t(title)), ...kids);

  const hero = el("header", { class: "about-hero" },
    el("div", { class: "eyebrow" }, t("about.eyebrow")),
    el("h1", { class: "about-h1" }, t("about.h1a"), el("em", {}, t("about.h1em")), t("about.h1b")),
    el("p", { class: "lead" }, t("about.lead")),
    el("ul", { class: "about-points" },
      el("li", {}, el("b", {}, t("about.point1")), " ", t("about.point1b")),
      el("li", {}, el("b", {}, t("about.point2")), " ", t("about.point2b")),
    ),
    el("div", { class: "row" }, cta("about.ctaRoll"), (() => { const a = el("a", { class: "btn", href: "#about-layers" }, t("about.ctaHow")); a.onclick = (e) => { e.preventDefault(); document.getElementById("about-layers")?.scrollIntoView({ behavior: "smooth" }); }; return a; })()),
  );

  const scale = el("section", { class: "about-scale" },
    el("div", { class: "scale-item" }, el("div", { class: "scale-num" }, power("1.07", "12")), el("div", { class: "scale-what" }, t("about.scale1")), el("div", { class: "scale-like" }, t("about.scale1b"))),
    el("div", { class: "scale-item" }, el("div", { class: "scale-num" }, power("4.19", "18")), el("div", { class: "scale-what" }, t("about.scale2")), el("div", { class: "scale-like" }, t("about.scale2b"))),
    el("div", { class: "scale-item big" }, el("div", { class: "scale-num" }, power("2.17", "24")), el("div", { class: "scale-what" }, t("about.scale3")), el("div", { class: "scale-like" }, t("about.scale3b"))),
  );

  const fig = el("figure", { class: "layers-fig" });
  fig.innerHTML = layersDiagram();
  fig.append(layersList(), el("figcaption", { class: "muted" }, t("about.figCaption")));

  const card = (title: Key, body: Key, cite: Key) => el("div", { class: "about-card" }, el("h3", {}, t(title)), el("p", {}, t(body)), el("p", { class: "about-cite" }, t(cite)));
  const theory = el("div", { class: "about-cards" },
    card("about.t1", "about.t1b", "about.t1c"),
    card("about.t2", "about.t2b", "about.t2c"),
    card("about.t3", "about.t3b", "about.t3c"),
    card("about.t4", "about.t4b", "about.t4c"),
    card("about.t5", "about.t5b", "about.t5c"),
  );

  const step = (n: string, title: Key, body: Key) => el("li", {}, el("span", { class: "step-n" }, n), el("div", {}, el("b", {}, t(title)), el("p", {}, t(body))));
  const how = el("ol", { class: "about-steps" },
    step("1", "about.s1", "about.s1b"), step("2", "about.s2", "about.s2b"), step("3", "about.s3", "about.s3b"), step("4", "about.s4", "about.s4b"),
  );

  const nots = el("ul", { class: "about-nots" }, el("li", {}, t("about.n1")), el("li", {}, t("about.n2")), el("li", {}, t("about.n3")));

  return [
    hero,
    scale,
    // 调查数字填进 problems.ts 之前不显示这一节
    ...(SURVEY.rows.length ? [section("about-problem", "about.problem.eyebrow", "about.problem.title",
      el("p", { class: "lead" }, t("about.problem.lead", { posts: SURVEY.posts.toLocaleString("en-US"), complaints: SURVEY.complaints.toLocaleString("en-US") })),
      problemsSummary(), problemsChart())] : []),
    section("about-layers", "about.layersEyebrow", "about.layersTitle", el("p", { class: "lead" }, t("about.layersLead")), fig),
    section("about-theory", "about.theoryEyebrow", "about.theoryTitle", theory),
    section("about-how", "about.howEyebrow", "about.howTitle", how),
    section("about-not", "about.notEyebrow", "about.notTitle", nots),
    section("about-refs", "about.refsEyebrow", "about.refsTitle", el("ol", { class: "about-refs" }, ...REFERENCES.map((r) => el("li", {}, r)))),
    el("div", { class: "about-final" }, el("p", { class: "about-final-line" }, t("about.final")), cta("about.ctaRoll")),
  ];
}
