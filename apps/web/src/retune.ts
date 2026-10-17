// 「告诉 Elise」面板：在和角色聊天时，对某条回复说「不对」→ Elise 诊断、给两个改法 → 只改人设的一两节 →
// 从那句重来 / 撤销。逻辑在 @1t-persona/designer 的 retune.ts；设计见根文档仓库 docs/1T-persona/steps/step10_retune_from_chat.md。
import { DESIGNER_NAME, diagnose, rewrite, type Diagnosis, type Model, type Rewrite } from "@1t-persona/designer/browser";
import { LANG_NAME, lang, t, type Key } from "./i18n.ts";
import { saveCharacter, type SavedCharacter } from "./store.ts";

/** 面板字串在 locales/ 的 retune.* 里。 */
const rt = (k: string, vars: Record<string, string> = {}) => t(`retune.${k}` as Key, vars);

type El = HTMLElement;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

export interface RetuneOptions {
  character: SavedCharacter;
  /** 被点的那条回复在 character.chat 里的下标 */
  index: number;
  model: Model;
  /** 去掉情绪标签后给人看的文字 */
  shown: (content: string) => string;
  /** 改好、或撤销后，让聊天页重画；retry=true 表示要从那句重来 */
  onDone: (opts: { retry: boolean }) => void;
}

/** 生成面板（挂在聊天记录下面）。 */
export function retunePanel(o: RetuneOptions): El {
  const c = o.character;
  const box = el("div", "retune");
  const flagged = c.chat[o.index]!;
  const head = el("div", "retune-head", el("span", "who", DESIGNER_NAME), el("button", "btn retune-close", rt("close")));
  (head.lastChild as HTMLButtonElement).onclick = () => box.remove();
  const quote = el("blockquote", "retune-quote", o.shown(flagged.content));
  const body = el("div", "retune-body");
  box.append(head, quote, body);

  const input = { name: c.name, persona: c.persona, chat: c.chat.slice(0, o.index + 1), complaint: "", uiLanguage: LANG_NAME[lang()] };
  const status = (text: string, cls = "typing") => body.replaceChildren(el("p", cls, text));

  const askStep = () => {
    const ta = el("textarea", "input");
    ta.rows = 2;
    const send = el("button", "btn primary", rt("send"));
    const quick = (k: string) => { const b = el("button", "btn", rt(k)); b.onclick = () => { ta.value = rt(k); send.click(); }; return b; };
    send.onclick = () => { const v = ta.value.trim(); if (v) void diagnoseStep(v); };
    body.replaceChildren(el("p", "", rt("ask")), el("div", "row", quick("quick1"), quick("quick2"), quick("quick3")), ta, el("div", "row", send));
    ta.focus();
  };

  const diagnoseStep = async (complaint: string) => {
    input.complaint = complaint;
    status(rt("thinking"));
    let d: Diagnosis;
    try { d = await diagnose(o.model, input); } catch (e) { status(rt("error", { msg: (e as Error).message }), "error"); return; }
    const own = el("textarea", "input");
    own.rows = 2;
    own.placeholder = rt("ownPh");
    const ownSend = el("button", "btn", rt("send"));
    ownSend.onclick = () => { const v = own.value.trim(); if (v) void rewriteStep({ plan: v }); };
    body.replaceChildren(
      el("p", "retune-elise", d.reply),
      el("p", "muted", rt("pick")),
      ...d.options.map((opt) => { const b = el("button", "btn retune-opt", opt.label); b.onclick = () => void rewriteStep(opt); return b; }),
      el("details", "", el("summary", "muted", rt("own")), own, el("div", "row", ownSend)),
    );
  };

  const rewriteStep = async (choice: { plan: string; sections?: string[] }) => {
    status(rt("writing"));
    let r: Rewrite;
    try { r = await rewrite(o.model, input, choice); } catch (e) { status(rt("error", { msg: (e as Error).message }), "error"); return; }
    c.previousPersona = c.persona;
    c.persona = r.persona;
    c.retunes = [...(c.retunes ?? []), { at: new Date().toISOString(), complaint: input.complaint, changed: r.changed, summary: r.summary }];
    saveCharacter(c);
    const retry = el("button", "btn primary", rt("retry"));
    retry.onclick = () => { box.remove(); o.onDone({ retry: true }); };
    const undo = el("button", "btn", rt("undo"));
    undo.onclick = () => {
      if (c.previousPersona) { c.persona = c.previousPersona; c.previousPersona = undefined; c.retunes = c.retunes?.slice(0, -1); saveCharacter(c); }
      body.replaceChildren(el("p", "muted", rt("undone")));
      o.onDone({ retry: false });
    };
    body.replaceChildren(
      el("p", "retune-elise", r.summary),
      el("p", "muted", `${rt("changed")}: ${r.changed.map((t) => t.replace(/\s*\(.*\)$/, "")).join(" · ")}`),
      el("details", "", el("summary", "muted", rt("showDiff")), ...r.diff.flatMap((d) => [
        el("p", "muted", `${rt("before")} — ${d.title}`), el("pre", "retune-diff", d.before),
        el("p", "muted", `${rt("after")} — ${d.title}`), el("pre", "retune-diff", d.after),
      ])),
      el("div", "row", retry, undo),
    );
    o.onDone({ retry: false });
  };

  askStep();
  return box;
}
