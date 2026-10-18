// 「下载桌宠」按钮（根文档仓库 docs/1T-persona/steps/step24_anone_demo_entrance.md「下载桌宠」）：
// 判出这台电脑是 Windows、Mac（Apple 芯片）还是 Mac（Intel），直接下对的那个 zip。
// zip 的名字带版本号（apps/desktop/scripts/pack.mjs），所以不写死地址：问 GitHub 公开接口最新一版有哪些文件，按名字挑；
// 拿不到（还没发版、被限流、没网）就退回 Releases 页。
import { t } from "./i18n.ts";
import { RELEASES_URL } from "./pet.ts";

export type Target = "mac-arm64" | "mac-x64" | "win-x64";
const PICK: Record<Target, RegExp> = { "mac-arm64": /macOS-AppleSilicon.*\.zip$/i, "mac-x64": /macOS-Intel.*\.zip$/i, "win-x64": /Windows-x64.*\.zip$/i };
const LATEST = "https://api.github.com/repos/anone-life/one-trillion-persona/releases/latest";

/** 这台电脑：确定的一种、「是 Mac 但分不清芯片」、或者不是电脑（手机 / Linux）。 */
export async function detectTarget(): Promise<Target | "mac-unknown" | null> {
  const ua = navigator.userAgent;
  const uad = (navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean; getHighEntropyValues?: (h: string[]) => Promise<{ architecture?: string }> } }).userAgentData;
  if (uad?.mobile || /iPhone|iPad|Android/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))) return null;
  if (/Windows/i.test(ua) || uad?.platform === "Windows") return "win-x64";
  if (!/Macintosh|Mac OS X/i.test(ua) && uad?.platform !== "macOS") return null;
  // ① Chrome / Edge：直接问 CPU 架构
  try {
    const arch = (await uad?.getHighEntropyValues?.(["architecture"]))?.architecture;
    if (arch === "arm") return "mac-arm64";
    if (arch === "x86") return "mac-x64";
  } catch { /* 不给就往下看 */ }
  // ② 看显卡名：Apple 芯片报 "Apple M…"，Intel Mac 报 Intel / AMD 的显卡
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const r = String((ext && gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL)) ?? "");
    if (/Apple M\d/i.test(r)) return "mac-arm64";
    if (/Intel|AMD|Radeon/i.test(r)) return "mac-x64";
  } catch { /* 拿不到 */ }
  return "mac-unknown";
}

let assets: Promise<Record<Target, string> | null> | null = null;
/** 最新一版三个 zip 的下载地址；没发版 / 出错回 null。一页只问一次。 */
function latestAssets(): Promise<Record<Target, string> | null> {
  assets ??= fetch(LATEST, { headers: { accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((rel: { assets?: { name: string; browser_download_url: string }[] } | null) => {
      const list = rel?.assets ?? [];
      const out = {} as Record<Target, string>;
      for (const k of Object.keys(PICK) as Target[]) {
        const a = list.find((x) => PICK[k].test(x.name));
        if (a) out[k] = a.browser_download_url;
      }
      return Object.keys(out).length ? out : null;
    })
    .catch(() => null);
  return assets;
}

type Kid = Node | string | null;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

const LABEL: Record<Target, () => string> = { "mac-arm64": () => t("desk.macArm"), "mac-x64": () => t("desk.macIntel"), "win-x64": () => t("desk.win") };

/** 「我的」页上那一块：按钮 + 一句怎么搬角色过去 + 「其他版本」。 */
export function desktopDownload(): HTMLElement {
  const buttons = el("div", { class: "desk-dl-buttons" });
  const note = el("p", { class: "muted desk-dl-note" });
  const after = el("p", { class: "muted" }, t("desk.after"));
  // 第一次打开会被系统拦（还没有苹果公证 / 微软签名）：按判出来的系统说怎么放行（用户 2026-10-18 下载后被 macOS 拦住）
  const firstOpen = el("p", { class: "desk-dl-first", hidden: "" });
  const box = el("section", { class: "desk-dl" }, el("b", {}, t("desk.title")), buttons, firstOpen, after, note);
  const showFirst = (key: "desk.firstMac" | "desk.firstWin") => { firstOpen.textContent = t(key); firstOpen.hidden = false; };
  const button = (k: Target, primary: boolean) => {
    const a = el("a", { class: `btn${primary ? " primary" : ""}`, href: RELEASES_URL, target: "_blank", rel: "noopener" }, `${t("desk.download")} · ${LABEL[k]()}`);
    // 有最新一版就换成直接下载那个 zip；没有就留着 Releases 页
    void latestAssets().then((m) => { if (m?.[k]) { a.href = m[k]; a.removeAttribute("target"); } });
    return a;
  };
  const others = el("a", { class: "btn-link", href: RELEASES_URL, target: "_blank", rel: "noopener" }, t("desk.others"));
  void detectTarget().then((k) => {
    if (k === null) { buttons.replaceChildren(); after.hidden = true; note.replaceChildren(t("desk.notHere"), " ", others); return; }
    showFirst(k === "win-x64" ? "desk.firstWin" : "desk.firstMac");
    if (k === "mac-unknown") { buttons.replaceChildren(button("mac-arm64", true), button("mac-x64", false)); note.replaceChildren(t("desk.whichMac"), " ", others); return; }
    buttons.replaceChildren(button(k, true));
    note.replaceChildren(others);
  });
  return box;
}
