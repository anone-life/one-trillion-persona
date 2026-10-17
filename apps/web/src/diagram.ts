// 八层图，在网页里现画：字跟界面语言走，颜色用页面的 CSS 变量（深浅色自动跟），每层的组合数从规则里取。
// 静态版（README / DESIGN.md 用）由 tools/gen_layers_diagram.py 生成，两边布局一致。
import { layerCount } from "@1t-persona/core";
import { t, type Key } from "./i18n.ts";

const W = 1200, H = 664, CX = 600, CY = 332;
const LAYERS: { id: string; name: Key; what: Key; theory: Key }[] = [
  { id: "world", name: "about.dia.world", what: "about.dia.worldWhat", theory: "about.dia.worldTheory" },
  { id: "body", name: "about.dia.body", what: "about.dia.bodyWhat", theory: "about.dia.bodyTheory" },
  { id: "skills", name: "about.dia.skills", what: "about.dia.skillsWhat", theory: "about.dia.skillsTheory" },
  { id: "status", name: "about.dia.standing", what: "about.dia.standingWhat", theory: "about.dia.standingTheory" },
  { id: "signs", name: "about.dia.signs", what: "about.dia.signsWhat", theory: "about.dia.signsTheory" },
  { id: "drama", name: "about.dia.drama", what: "about.dia.dramaWhat", theory: "about.dia.dramaTheory" },
  { id: "glitch", name: "about.dia.quirk", what: "about.dia.quirkWhat", theory: "about.dia.quirkTheory" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const txt = (x: number, y: number, s: string, cls: string, anchor = "middle") =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;

export function layersDiagram(): string {
  const out: string[] = [`<svg class="layers-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("about.dia.aria"))}">`];
  const rx = 410, ry = 270, cw = 262, ch = 100;
  LAYERS.forEach((l, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / LAYERS.length;
    const x = CX + rx * Math.cos(a) - cw / 2;
    const y = CY + ry * Math.sin(a) - ch / 2;
    out.push(`<line x1="${(CX + 150 * Math.cos(a)).toFixed(1)}" y1="${(CY + 118 * Math.sin(a)).toFixed(1)}" x2="${(x + cw / 2).toFixed(1)}" y2="${(y + ch / 2).toFixed(1)}" class="d-link"/>`);
    out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw}" height="${ch}" rx="6" class="d-card"/>`);
    out.push(txt(x + 16, y + 30, t(l.name), "d-name", "start"));
    out.push(txt(x + cw - 16, y + 30, layerCount(l.id).toLocaleString("en-US"), "d-count", "end"));
    out.push(txt(x + 16, y + 56, t(l.what), "d-what", "start"));
    out.push(txt(x + 16, y + 80, t(l.theory), "d-theory", "start"));
  });
  out.push(`<ellipse cx="${CX}" cy="${CY}" rx="150" ry="118" class="d-core"/>`);
  out.push(txt(CX, CY - 70, t("about.dia.inner"), "d-core-name"));
  out.push(txt(CX, CY - 48, t("about.dia.innerCount", { n: layerCount("bazi").toLocaleString("en-US") }), "d-count"));
  out.push(txt(CX, CY - 20, t("about.dia.drive"), "d-what d-strong"));
  out.push(txt(CX, CY - 2, t("about.dia.driveTheory"), "d-theory"));
  out.push(`<line x1="${CX - 110}" y1="${CY + 12}" x2="${CX + 110}" y2="${CY + 12}" class="d-rule"/>`);
  out.push(txt(CX, CY + 34, t("about.dia.faces"), "d-what d-strong"));
  out.push(txt(CX, CY + 52, t("about.dia.facesWhat"), "d-what"));
  out.push(txt(CX, CY + 72, t("about.dia.facesTheory"), "d-theory"));
  out.push("</svg>");
  return out.join("");
}

/** 窄屏版：同样的内容排成一列（环形图在手机上一屏只看得到一角）。 */
export function layersList(): HTMLElement {
  const el = (tag: string, cls: string, text?: string) => { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const wrap = el("div", "layers-list");
  const core = el("div", "ll-card ll-core");
  const coreHead = el("div", "ll-head");
  core.append(
    coreHead,
    el("div", "ll-what ll-strong", t("about.dia.drive")), el("div", "ll-theory", t("about.dia.driveTheory")),
    el("div", "ll-what ll-strong", `${t("about.dia.faces")} · ${t("about.dia.facesWhat")}`), el("div", "ll-theory", t("about.dia.facesTheory")),
  );
  coreHead.append(el("span", "ll-name", t("about.dia.inner")), el("span", "ll-count", t("about.dia.innerCount", { n: layerCount("bazi").toLocaleString("en-US") })));
  wrap.append(core, el("div", "ll-sep", t("about.dia.outerNote")));
  for (const l of LAYERS) {
    const c = el("div", "ll-card");
    const head = el("div", "ll-head");
    head.append(el("span", "ll-name", t(l.name)), el("span", "ll-count", layerCount(l.id).toLocaleString("en-US")));
    c.append(head, el("div", "ll-what", t(l.what)), el("div", "ll-theory", t(l.theory)));
    wrap.append(c);
  }
  return wrap;
}
