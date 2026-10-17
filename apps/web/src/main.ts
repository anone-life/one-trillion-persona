// One-Trillion Persona 网页版。页面：选维度 → 看陌生人 → 和 Elise 聊 → 写人设 → 结果 → 角色库 → 和角色聊。
// 结构见 docs/ARCHITECTURE.md。
import "./app.css";
import {
  ALL_LAYERS, DEFAULT_ASK, LAYERS, buildSkeleton, describe, formatSeed, layerCount, parseSeed, randomSeed,
  type BirthInput, type Skeleton,
} from "@1t-persona/core";
import {
  DESIGNER_NAME, DesignerSession, finalize, generatePersona, generateSchedule, pronounsFor,
} from "@1t-persona/designer/browser";
import { cardInputFromPersona, packAnone, readAnone, toCardV2 } from "@1t-persona/files";
import { DEV_PROXY, PRESETS, loadSettings, modelFrom, ready, saveSettings, type Settings } from "./llm.ts";
import { AnoneError, EMOTIONS, anoneReady, listFaces, loadAnone, resetFaces, saveAnone, speak, spokenText, takeEmotion, type Face } from "./anone.ts";
import { Stage } from "./player.ts";
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
    h("div", { class: "mark", role: "img", "aria-label": "あのね" }),
    h("div", { class: "by" }, h("b", {}, "あのね"), "  open source 01"),
    h("nav", {}, link("#/", "New"), link("#/library", "Library"), link("#/settings", "Model")),
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
  birth: "",
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

function fmtCount(n: number): [string, string] {
  if (n < 1e4) return [n.toLocaleString("en-US"), "people"];
  if (n < 1e6) return [(n / 1e3).toFixed(0) + "K", "people"];
  if (n < 1e9) return [(n / 1e6).toFixed(1).replace(/\.0$/, "") + " million", "people"];
  if (n < 1e12) return [(n / 1e9).toFixed(1).replace(/\.0$/, "") + " billion", "people"];
  if (n < 1e15) return [(n / 1e12).toFixed(1).replace(/\.0$/, "") + " trillion", "people"];
  const e = Math.floor(Math.log10(n));
  return [`${(n / 10 ** e).toFixed(1)} × 10${String(e).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]).join("")}`, "people"];
}

const LAYER_TEXT: Record<string, { name: string; what: string; parts: string[]; ask: string }> = {
  bazi: { name: "Inner life", what: "What they want, what it costs them, what would break them — and how they are with strangers, at work, up close, and deep down.", parts: ["year pillar 60", "month 12", "day pillar 60", "hour 12"], ask: "Elise will ask: use your birthday, or a random moment?" },
};
for (const l of LAYERS) {
  LAYER_TEXT[l.id] = { name: l.name, what: l.blurb, parts: l.fields.map((f) => `${f.label.toLowerCase()} ${f.values.length}`), ask: `Elise will ask about their ${l.name.toLowerCase()}.` };
}

function makeSkeleton(): Skeleton {
  let seed: bigint;
  try { seed = state.seedText.trim() ? parseSeed(state.seedText) : randomSeed(); } catch (e) { throw new Error((e as Error).message); }
  state.seedText = formatSeed(seed);
  let birth: BirthInput | undefined;
  if (state.birth) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(state.birth);
    if (m) birth = { wall: { year: +m[1]!, month: +m[2]!, day: +m[3]!, hour: +m[4]!, minute: +m[5]! }, tz: state.tz };
  }
  return buildSkeleton({ seed, birth, ask: ALL_LAYERS.filter((id) => state.ask.has(id)) });
}

// ── 1. 选维度 ───────────────────────────────────────────────────────────────

function startView() {
  const counter = h("div", { class: "counter" });
  const list = h("div", {});
  const footTxt = h("div", { class: "txt" });
  const goBtn = h("button", { class: "btn primary" });
  const err = h("div", { class: "error" });

  const seedInput = h("input", { class: "input mono", placeholder: "Seed, e.g. 1T-3F9A-77C2-K8QX (empty = random)", value: state.seedText,
    oninput: (e: Event) => { state.seedText = (e.target as HTMLInputElement).value; } });
  const birthInput = h("input", { class: "input", type: "datetime-local", value: state.birth,
    oninput: (e: Event) => { state.birth = (e.target as HTMLInputElement).value; } });

  function render() {
    const sel = ALL_LAYERS.filter((id) => state.ask.has(id));
    const total = sel.reduce((a, id) => a * layerCount(id), 1);
    const [num, unit] = fmtCount(total);
    const ticks = [[4, "10K"], [8, "100M"], [12, "1 trillion"], [24, "10²⁴"]] as const;
    counter.replaceChildren(
      h("div", { class: "label" }, sel.length ? "The layers you'll decide can combine into" : "Leave everything to the seed — one tap, one complete person"),
      h("div", { class: "num" }, sel.length ? num : "—", h("small", {}, sel.length ? unit : ""), h("span", { class: `badge${total >= 1e12 && sel.length ? " show" : ""}` }, "one trillion ✓")),
      h("div", { class: "scale" }, h("div", { class: "fill", style: `width:${sel.length ? Math.min(100, (Math.log10(total) / 25) * 100) : 0}%` }),
        ...ticks.map(([e, l]) => h("div", { class: `tick${e === 12 ? " t1t" : ""}`, style: `left:${(e / 25) * 100}%` }, h("span", {}, l)))),
    );
    list.replaceChildren(...ALL_LAYERS.map((id, i) => {
      const t = LAYER_TEXT[id]!;
      const on = state.ask.has(id);
      return h("div", { class: `dim${on ? " on" : ""}`, role: "switch", "aria-checked": String(on), tabindex: "0",
        onclick: () => { if (on) state.ask.delete(id); else state.ask.add(id); render(); },
        onkeydown: (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } } },
        h("div", { class: "top" }, h("div", { class: "idx" }, String(i + 1)),
          h("div", { class: "main" }, h("div", { class: "name" }, t.name), h("div", { class: "what" }, t.what)),
          h("div", { class: "count" }, layerCount(id).toLocaleString("en-US")), h("div", { class: "toggle" })),
        h("div", { class: "chips" }, ...t.parts.map((p) => h("span", { class: "chip" }, p))),
        h("div", { class: "state" }, on ? t.ask : "Off: the seed decides."),
      );
    }));
    const rounds = sel.reduce((a, id) => a + (id === "bazi" ? 2 : 1), 0);
    footTxt.replaceChildren(...(sel.length
      ? ["Elise will ask about ", h("b", {}, `${sel.length} layer${sel.length > 1 ? "s" : ""}, about ${rounds + 3} exchanges`), sel.length < ALL_LAYERS.length ? "; the seed decides the rest." : "."]
      : ["No questions — the seed hands you someone whole."]));
    goBtn.textContent = "Roll someone";
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
    h("div", { class: "eyebrow" }, "One-Trillion Persona"),
    h("h1", {}, "Every seed is ", h("em", {}, "someone"), "."),
    h("p", { class: "lead" }, "Pick the layers you want to decide yourself. Elise, the designer, will ask about those; the seed fills in the rest. Every layer always exists — you always get a whole person."),
    counter,
    h("div", { class: "row" }, preset("Just their inner life", ["bazi"]), preset("The trillion: inner life + world + body", DEFAULT_ASK), preset("I'll decide everything", ALL_LAYERS), preset("Leave it all to the seed", [])),
    h("div", { class: "seedbox" },
      h("div", { class: "field" }, h("label", {}, "Seed (share it, and anyone gets the same person)"), h("div", { class: "row" }, seedInput,
        h("button", { class: "btn", onclick: () => { state.seedText = formatSeed(randomSeed()); seedInput.value = state.seedText; } }, "Random"))),
      h("div", { class: "field" }, h("label", {}, `Or a birthday for their inner life (time zone: ${state.tz})`), birthInput),
    ),
    list,
    err,
    h("p", { class: "note" }, "The numbers count combinations, not proven-different people. The inner life uses a Bazi-inspired structure: a grammar for fiction, not fortune-telling. Characters are always adults."),
    h("div", { class: "foot" }, h("div", { class: "in" }, footTxt, goBtn)),
  );
}

// ── 2. 看陌生人 ─────────────────────────────────────────────────────────────

function strangerCards(k: Skeleton): HTMLElement[] {
  const d = describe(k);
  const i = d.inner;
  const tag = (asked: boolean) => h("span", { class: `tag${asked ? " ask" : ""}` }, asked ? "you decide" : "from the seed");
  return [
    h("div", { class: "card drive" },
      h("h3", {}, "Inner life", tag(i.asked)),
      h("p", {}, h("b", {}, "Wants: "), i.wants.join(" And: ")),
      h("p", {}, h("b", {}, "The price: "), i.cost.join(" ")),
      h("p", {}, h("b", {}, "Breaks when: "), i.breaks),
      h("ul", { class: "faces" }, ...i.masks.map((m) => h("li", {}, h("span", {}, `${m.position} · ${m.name}`), m.line.replace(/^[^:]+:\s*/, "")))),
      h("p", { class: "muted" }, `Chart ${i.pillars} · ${i.strength} · leans ${i.typeLean} (a prior, not a test result)`),
    ),
    ...d.layers.map((l) => h("div", { class: "card" },
      h("h3", {}, l.name, tag(l.asked)),
      h("dl", { class: "kv" }, ...l.fields.flatMap((f) => [h("dt", {}, f.label), h("dd", {}, f.valueLabel)])),
    )),
  ];
}

function strangerView() {
  const draft = loadDraft();
  if (!draft) return go("#/");
  const k = draft.skeleton;
  const link = `${location.origin}${location.pathname}#seed=${k.seed}`;
  const copied = h("span", { class: "muted" });
  page("#/stranger",
    h("div", { class: "eyebrow" }, "The stranger"),
    h("h1", {}, "Someone ", h("em", {}, "nobody"), " has met yet."),
    h("div", { class: "row", style: "margin-top:12px" }, h("span", { class: "seedcode" }, k.seed),
      h("button", { class: "btn", onclick: async () => { try { await navigator.clipboard.writeText(link); copied.textContent = "link copied"; } catch { copied.textContent = link; } } }, "Copy link"),
      h("button", { class: "btn", onclick: () => { state.seedText = ""; state.birth = ""; state.ask = new Set(k.ask); const nk = makeSkeleton(); saveDraft({ skeleton: nk, turns: [] }); strangerView(); } }, "Roll again"),
      copied),
    ...strangerCards(k),
    h("div", { class: "foot" }, h("div", { class: "in" },
      h("div", { class: "txt" }, ...(k.ask.length ? ["Elise will start with ", h("b", {}, k.ask.includes("bazi") ? "their inner life" : (LAYER_TEXT[k.ask[0]!]?.name ?? "").toLowerCase()), "."] : ["Elise will only ask for a name and who you are to them."])),
      h("button", { class: "btn primary", onclick: () => go(ready(loadSettings()) ? "#/chat" : "#/settings?next=chat") }, `Talk to ${DESIGNER_NAME}`))),
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
  const session = new DesignerSession(draft.skeleton, model);
  session.turns.push(...draft.turns);
  const persist = () => saveDraft({ skeleton: session.skeleton, turns: session.turns });

  const log = h("div", { class: "chat", "aria-live": "polite" });
  const status = h("div", { class: "typing" });
  const box = h("textarea", { class: "input", rows: "1", placeholder: "Type to Elise…" }) as HTMLTextAreaElement;
  const send = h("button", { class: "btn primary" }, "Send");
  const done = h("button", { class: "btn" }, "I'm done");
  const bubble = (role: "them" | "me" | "sys", text: string) =>
    h("div", { class: `bubble ${role}` }, role === "them" ? h("span", { class: "who" }, DESIGNER_NAME) : null, text);
  const redraw = () => {
    log.replaceChildren(...session.turns.map((t) => bubble(t.role === "designer" ? "them" : "me", t.text)), status);
    window.scrollTo(0, document.body.scrollHeight);
  };
  const run = async (what: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    busy = true; send.disabled = done.disabled = true; status.textContent = what;
    try { await fn(); status.textContent = ""; } catch (e) { status.textContent = ""; log.append(bubble("sys", `Something went wrong: ${(e as Error).message}`)); }
    finally { busy = false; send.disabled = done.disabled = false; persist(); }
  };
  send.onclick = () => {
    const text = box.value.trim();
    if (!text) return;
    box.value = "";
    if (text === "/done") return done.click();
    session.turns.push({ role: "user", text }); redraw(); session.turns.pop();
    void run(`${DESIGNER_NAME} is typing…`, async () => { await session.reply(text); redraw(); });
  };
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.click(); } };
  done.onclick = () => void run("Reading the conversation…", async () => {
    const f = await finalize(model, session.skeleton, session.transcript());
    if (!f.enough) { await session.nudge(f.missing); redraw(); return; }
    persist();
    sessionStorage.setItem("1t.final", JSON.stringify({ name: f.name, relationToUser: f.relationToUser, skeleton: f.skeleton, dropped: f.dropped }));
    go("#/writing");
  });

  page("#/chat",
    h("div", { class: "eyebrow" }, `Designing with ${DESIGNER_NAME} · ${draft.skeleton.seed}`),
    h("details", {}, h("summary", { class: "muted" }, "Show the stranger"), ...strangerCards(session.skeleton)),
    log,
    h("div", { class: "composer" }, h("div", { class: "in" }, box, send, done)),
  );
  redraw();
  if (session.turns.length === 0) await run(`${DESIGNER_NAME} is reading the seed…`, async () => { await session.open(); redraw(); });
}

// ── 4. 写人设 ───────────────────────────────────────────────────────────────

async function writingView() {
  const draft = loadDraft();
  const finalRaw = sessionStorage.getItem("1t.final");
  if (!draft || !finalRaw) return go("#/");
  const f = JSON.parse(finalRaw) as { name: string; relationToUser: string; skeleton: Skeleton; dropped: { path: string; value: string }[] };
  const steps = ["identity", "drive", "speech", "life", "schedule"];
  const labels: Record<string, string> = { identity: "Who they are", drive: "What drives them", speech: "How they talk", life: "Their past and right now", schedule: "Their day" };
  const list = h("ul", { class: "progress" });
  const err = h("div", { class: "error" });
  const mark = (now: number) => list.replaceChildren(...steps.map((s, i) => h("li", { class: i < now ? "done" : i === now ? "now" : "" }, labels[s]!)));
  mark(0);
  page("#/writing",
    h("div", { class: "eyebrow" }, "Writing"),
    h("h1", {}, h("em", {}, f.name), " is taking shape."),
    h("p", { class: "lead" }, "Five short passes. This takes a minute or two."),
    list, err,
    f.dropped.length ? h("p", { class: "note" }, `Kept as details rather than seed values: ${f.dropped.map((d) => `${d.path} = ${d.value}`).join(", ")}.`) : null,
  );
  try {
    const model = modelFrom(loadSettings());
    const transcript = new DesignerSession(f.skeleton, model);
    transcript.turns.push(...draft.turns);
    const { text, slots } = await generatePersona(model, { name: f.name, relationToUser: f.relationToUser, skeleton: f.skeleton, transcript: transcript.transcript() },
      (stage) => mark(steps.indexOf(stage) + 1));
    const schedule = await generateSchedule(model, f.name, slots, f.skeleton);
    mark(5);
    const c: SavedCharacter = {
      id: crypto.randomUUID(), name: f.name, age: slots.age, location: slots.location, tagline: slots.coreArchetype,
      relationToUser: f.relationToUser, persona: text, schedule, skeleton: f.skeleton, createdAt: new Date().toISOString(), chat: [],
    };
    if (!saveCharacter(c)) err.textContent = "This browser wouldn't let us save — download the .anone file on the next page so you don't lose them.";
    sessionStorage.setItem("1t.unsaved", JSON.stringify(c));
    saveDraft(null);
    sessionStorage.removeItem("1t.final");
    go(`#/result/${c.id}`);
  } catch (e) {
    err.replaceChildren(`Couldn't finish: ${(e as Error).message} `, h("button", { class: "btn", onclick: () => writingView() }, "Try again"));
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
    h("div", { class: "eyebrow" }, "Done"),
    h("h1", {}, h("em", {}, c.name), ` · ${c.tagline}`),
    h("p", { class: "lead" }, `Age ${c.age} · ${bare(c.location)}.`, c.relationToUser ? h("br") : null, c.relationToUser ? `You: ${bare(c.relationToUser)}.` : null),
    h("div", { class: "row", style: "margin:16px 0" },
      h("button", { class: "btn primary", onclick: () => go(`#/c/${c.id}`) }, `Talk to ${c.name}`),
      h("button", { class: "btn", onclick: () => void downloadAnone(c) }, "Download .anone"),
      h("button", { class: "btn", onclick: () => downloadCard(c) }, "SillyTavern card (.json)"),
    ),
    h("p", { class: "note" }, "They live in this browser. Clearing site data deletes them — keep the .anone file as your backup; you can import it here again, or into anone.life."),
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
    } catch (e) { err.textContent = `Couldn't import that file: ${(e as Error).message}`; }
    file.value = "";
  };
  const all = listCharacters();
  page("#/library",
    h("div", { class: "eyebrow" }, "Library"),
    h("h1", {}, "The people you've ", h("em", {}, "made"), "."),
    h("div", { class: "row", style: "margin-top:14px" }, h("button", { class: "btn primary", onclick: () => go("#/") }, "Make someone new"), h("button", { class: "btn", onclick: () => file.click() }, "Import .anone"), file),
    err,
    all.length ? h("div", { class: "lib" }, ...all.map((c) => h("div", { class: "item" },
      h("div", { class: "who" }, h("b", {}, c.name), h("div", {}, `${c.tagline} · ${c.age}${c.skeleton ? ` · ${c.skeleton.seed}` : ""}`)),
      h("button", { class: "btn primary", onclick: () => go(`#/c/${c.id}`) }, "Talk"),
      h("button", { class: "btn", onclick: () => go(`#/result/${c.id}`) }, "Open"),
      h("button", { class: "btn", "aria-label": `Delete ${c.name}`, onclick: () => { if (confirm(`Delete ${c.name} from this browser? Keep the .anone file if you want them back.`)) { deleteCharacter(c.id); libraryView(); } } }, "Delete"),
    ))) : h("p", { class: "muted", style: "margin-top:20px" }, "No one yet."),
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
  const box = h("textarea", { class: "input", rows: "1", placeholder: `Message ${c.name}…` }) as HTMLTextAreaElement;
  const send = h("button", { class: "btn primary" }, "Send");
  const shown = (m: { role: string; content: string }) => (m.role === "assistant" ? takeEmotion(m.content).text : m.content);
  const redraw = () => {
    log.replaceChildren(...c.chat.map((m) => h("div", { class: `bubble ${m.role === "assistant" ? "them" : "me"}` }, m.role === "assistant" ? h("span", { class: "who" }, c.name) : null, shown(m))), status);
    window.scrollTo(0, document.body.scrollHeight);
  };

  const drawFaceBar = (faces: Face[] | null, err?: string) => {
    if (!live) {
      faceBar.replaceChildren(h("p", { class: "muted" }, "Text only. Want ", c.name, " to move and speak? Add an anone.life API key under ", h("a", { href: "#/settings" }, "Model"), " (paid, from your anone.life console)."));
      return;
    }
    if (err) { faceBar.replaceChildren(h("p", { class: "error" }, err)); return; }
    if (!faces) { faceBar.replaceChildren(h("p", { class: "muted" }, "Loading faces…")); return; }
    face = faces.find((f) => f.id === c.avatarId) ?? null;
    stage.setFace(face);
    faceBar.replaceChildren(
      h("div", { class: "faces-pick" }, ...faces.map((f) => h("button", {
        class: `face-opt${f.id === c.avatarId ? " on" : ""}`, title: `${f.label}${f.gender ? ` · ${f.gender}` : ""}`,
        onclick: () => { c.avatarId = f.id; saveCharacter(c); drawFaceBar(faces); },
      }, h("img", { src: f.poster, alt: f.label, loading: "lazy" }), h("span", {}, f.label)))),
      ...(face ? [] : [h("p", { class: "muted" }, `Pick a face for ${c.name}.`)]),
    );
  };
  if (live) listFaces(anone).then((f) => drawFaceBar(f), (e) => drawFaceBar(null, `Couldn't load faces from anone.life: ${(e as Error).message}`));
  drawFaceBar(null);

  send.onclick = async () => {
    const text = box.value.trim();
    if (!text || busy) return;
    if (face) { stage.unlock(); stage.thinking(); }
    box.value = ""; busy = true; send.disabled = true;
    c.chat.push({ role: "user", content: text }); redraw(); status.textContent = `${c.name} is typing…`;
    try {
      const reply = await model.chat([{ role: "system", content: characterSystem(c, !!face) }, ...c.chat.slice(-30)], { temperature: 0.9, maxTokens: 400 });
      c.chat.push({ role: "assistant", content: reply });
      saveCharacter(c);
      status.textContent = ""; redraw();
      if (face) {
        const { emotion, text: said } = takeEmotion(reply);
        const line = spokenText(said);
        if (line) {
          status.textContent = `${c.name} is speaking…`;
          try {
            const spoken = await speak(anone, { text: line.slice(0, 300), emotion, faceId: face.id });
            await stage.play(spoken); // 时间表最后一段就是 idle，不用再切
          } catch (e) {
            const msg = e instanceof AnoneError && e.status === 402 ? "Out of stamps on your anone.life account — top up in the console." : `Voice failed: ${(e as Error).message}`;
            log.append(h("div", { class: "bubble sys" }, msg));
            stage.idle();
          }
        }
      }
    } catch (e) { c.chat.pop(); log.append(h("div", { class: "bubble sys" }, `Something went wrong: ${(e as Error).message}`)); }
    finally { busy = false; send.disabled = false; status.textContent = ""; }
  };
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.click(); } };
  page("#/library",
    h("div", { class: "eyebrow" }, `${c.name} · ${c.tagline}`),
    faceBar,
    stage.el,
    log,
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
    field("Base URL (any OpenAI-compatible API)", "baseUrl", { class: "input mono" }),
    field("API key", "apiKey", { type: "password", class: "input mono", autocomplete: "off", placeholder: s.baseUrl.startsWith("/") ? "not needed for the local proxy" : "sk-…" }),
    field("Model", "model", { class: "input mono" }),
    field("Extra request fields (JSON, optional)", "extraBody", { class: "input mono", placeholder: '{"temperature": 0.8}' }),
  );
  draw();
  page("#/settings",
    h("div", { class: "eyebrow" }, "Your model"),
    h("h1", {}, "Bring your ", h("em", {}, "own"), " model."),
    h("p", { class: "lead" }, "Elise and your characters run on whatever OpenAI-compatible model you choose. Your key stays in this browser and is only sent to the address you enter here."),
    h("div", { class: "row", style: "margin:14px 0" }, ...PRESETS.map((p) => h("button", { class: "btn", onclick: () => { Object.assign(s, { apiKey: "", extraBody: "" }, p.settings); draw(); } }, p.label))),
    form,
    h("div", { class: "row", style: "margin-top:12px" },
      h("button", { class: "btn primary", onclick: () => {
        try { if (s.extraBody.trim()) JSON.parse(s.extraBody); } catch { msg.textContent = "Extra request fields must be valid JSON."; return; }
        saveSettings(s);
        if (!ready(s)) { msg.textContent = "Saved — add a model name and an API key to start."; return; }
        if (next) go(`#/${next}`); else msg.textContent = "Saved.";
      } }, next ? "Save and continue" : "Save"),
      h("button", { class: "btn", onclick: async () => {
        msg.textContent = "Testing…";
        try { const r = await modelFrom(s).chat([{ role: "user", content: "Reply with the single word: ready" }], { maxTokens: 10, temperature: 0 }); msg.textContent = `It works — the model said: "${r.slice(0, 40)}"`; }
        catch (e) { msg.textContent = `Didn't work: ${(e as Error).message}. Some providers don't allow calls straight from a web page (CORS); OpenAI and OpenRouter do.`; }
      } }, "Test"),
    ),
    msg,
    DEV_PROXY ? h("p", { class: "note" }, "Local development: \"Local dev proxy\" forwards to the provider configured on this machine, which adds the key server-side.") : null,
    anoneSection(),
  );
}

/** 可选：anone.life 的 key——有了它，角色能借 anone.life 的脸边说边动（付费）。 */
function anoneSection() {
  const a = loadAnone();
  const msg = h("div", { class: "muted" });
  const base = h("input", { class: "input mono", value: a.base, oninput: (e: Event) => { a.base = (e.target as HTMLInputElement).value; } });
  const key = h("input", { class: "input mono", type: "password", autocomplete: "off", value: a.key, placeholder: "ak_…", oninput: (e: Event) => { a.key = (e.target as HTMLInputElement).value; } });
  return h("section", { style: "margin-top:36px" },
    h("div", { class: "eyebrow" }, "Optional · anone.life"),
    h("h2", {}, "Faces and voices"),
    h("p", { class: "lead" }, "Everything above works without this. An anone.life API key lets your characters borrow an anone.life face and voice — every line moves and speaks. It's paid per line; get a key from your ", h("a", { href: `${a.base.replace(/\/+$/, "")}/console`, target: "_blank", rel: "noopener" }, "anone.life console"), ". Your character's persona never leaves this browser — only each line, its emotion, and the face."),
    h("div", { class: "field" }, h("label", {}, "anone.life address"), base),
    h("div", { class: "field" }, h("label", {}, "anone.life API key"), key),
    h("div", { class: "row", style: "margin-top:10px" },
      h("button", { class: "btn primary", onclick: () => { saveAnone(a); resetFaces(); msg.textContent = anoneReady(loadAnone()) ? "Saved." : "Saved — that doesn't look like an anone.life key (ak_…)."; } }, "Save"),
      h("button", { class: "btn", onclick: async () => {
        saveAnone(a); resetFaces(); msg.textContent = "Checking…";
        try { const f = await listFaces(loadAnone()); msg.textContent = `It works — ${f.length} faces available.`; }
        catch (e) { msg.textContent = `Didn't work: ${(e as Error).message}`; }
      } }, "Test"),
      h("button", { class: "btn", onclick: () => { a.key = ""; saveAnone(a); resetFaces(); (key as HTMLInputElement).value = ""; msg.textContent = "Removed."; } }, "Remove key"),
    ),
    msg,
  );
}

// ── 路由 ────────────────────────────────────────────────────────────────────

function route() {
  const hash = location.hash || "#/";
  const seed = /^#seed=([0-9A-Za-z-]+)/.exec(hash);
  if (seed) {
    try {
      state.seedText = seed[1]!; state.birth = "";
      saveDraft({ skeleton: makeSkeleton(), turns: [] });
      history.replaceState(null, "", "#/stranger");
      return strangerView();
    } catch { return startView(); }
  }
  const [path, query] = hash.slice(1).split("?");
  const params = new URLSearchParams(query ?? "");
  if (path === "/" || path === "") return startView();
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
