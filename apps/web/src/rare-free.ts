// 一期一会免费试聊（第 28 步）：没填自己模型的人，和一期一会聊天走 anone.life 的 /v1/1t/rare/chat，由 anone.life 的模型回话。
// 每位免费 3 轮；之后两条路：注册 anone.life（挑 2 位一直聊，每位每天 20 轮；别的人用邮票，一轮 5 张），或者填自己的 API（不限）。
// 次数都由 anone.life 定（它的 config.json），这里只照着 /quota 回的数显示。聊天页和桌宠共用这一份。
// 系统提示照旧在这里拼（talk.ts 的 characterSystem），anone.life 只核对它以 TA 的人设开头——改过人设的就只能用自己的模型。
import type { Model } from "@1t-persona/designer/browser";
import { anoneReady, type AnoneSettings } from "./anone.ts";
import { loadSettings, ready } from "./llm.ts";
import { lang, t } from "./i18n.ts";
import { RARE } from "./rare-data.ts";
import { listCharacters, type SavedCharacter } from "./store.ts";

const DEVICE = "1t.device.v1";

/** 这个浏览器的随机编号（只用来数免费轮数，不和任何人连起来）。 */
export function deviceId(): string {
  try {
    const have = localStorage.getItem(DEVICE);
    if (have && /^[A-Za-z0-9_-]{8,64}$/.test(have)) return have;
    const id = `d${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem(DEVICE, id);
    return id;
  } catch { return `d${crypto.randomUUID().replace(/-/g, "")}`; }
}

/** 托管版（anone.life/1t）和 anone.life 同域：用登录 cookie 认人，地址就用当前这个域名。别处（桌宠、开源版）用设置里的 key。 */
const hosted = () => import.meta.env?.BASE_URL === "/1t/";
export const rareBase = (a: AnoneSettings) => (hosted() ? location.origin : a.base.replace(/\/+$/, ""));
const authHeaders = (a: AnoneSettings): Record<string, string> => (!hosted() && anoneReady(a) ? { authorization: `Bearer ${a.key}` } : {});

/** 一期一会、而且没填自己的模型 → 走免费试聊。填了自己的模型就照旧，不限。 */
export const usesFree = (c: SavedCharacter) => !!c.rareId && !ready(loadSettings());

export interface RareQuota {
  signedIn: boolean;
  trialLeft: number;
  ipLeft: number;
  member: { people: string[]; mine: boolean; canPick: boolean; leftToday: number } | null;
  /** 邮票余额（后台分；显示 ×5） */
  balance: number | null;
  limits: { trialTurns: number; memberPeople: number; memberDailyTurns: number; ipDailyCap: number; pointsPerTurn: number; stampsPerTurn: number };
}

/** 卡住的原因：trial_over 没登录、试聊用完；choose 登录了、要挑人或用邮票；member_daily_limit 今天 20 轮用完；
 * ip_daily_limit 这个网络今天的试聊用完；insufficient_stamps 邮票不够；persona_changed 改过人设；offline 连不上。 */
export class RareStop extends Error {
  readonly code: string;
  readonly quota: RareQuota | null;
  constructor(code: string, quota: RareQuota | null) { super(code); this.code = code; this.quota = quota; }
}

export async function fetchQuota(c: SavedCharacter, a: AnoneSettings): Promise<RareQuota | null> {
  try {
    const r = await fetch(`${rareBase(a)}/v1/1t/rare/quota?rareId=${encodeURIComponent(c.rareId ?? "")}&deviceId=${deviceId()}`, { headers: authHeaders(a), cache: "no-store" });
    return r.ok ? ((await r.json()) as RareQuota) : null;
  } catch { return null; }
}

/** 这一轮怎么付：默认先用试聊 / 已挑的人；pick＝把 TA 设为我的一位；stamps＝用邮票。 */
export type RarePay = "default" | "pick" | "stamps";

/** 走 anone.life 的「模型」：接口和自己的模型一样（reply() 不用分两套）。卡住时抛 RareStop。 */
export function freeModel(c: SavedCharacter, a: AnoneSettings, pay: () => RarePay, onQuota: (q: RareQuota) => void): Model {
  return {
    async chat(messages) {
      const [sys, ...rest] = messages;
      const how = pay();
      let r: Response;
      try {
        r = await fetch(`${rareBase(a)}/v1/1t/rare/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders(a) },
          body: JSON.stringify({
            rareId: c.rareId, lang: c.lang ?? "en", deviceId: deviceId(), system: sys?.content ?? "",
            messages: rest.map((m) => ({ role: m.role, content: m.content })),
            ...(how === "pick" ? { pick: true } : how === "stamps" ? { pay: "stamps" } : {}),
          }),
        });
      } catch { throw new RareStop("offline", null); }
      const body = (await r.json().catch(() => ({}))) as { text?: string; error?: string; message?: string; quota?: RareQuota };
      if (body.quota) onQuota(body.quota);
      if (r.ok && body.text) return body.text;
      if (r.status === 402 || r.status === 429 || r.status === 403) throw new RareStop(body.error ?? "choose", body.quota ?? null);
      throw new Error(body.message ?? `anone.life said HTTP ${r.status}`);
    },
  };
}

/** 注册入口：带来源 `f=1t-rare-<编号>`（第 26 步漏斗认 `1t` 开头的）。 */
export const signupUrl = (c: SavedCharacter, a: AnoneSettings) => `${rareBase(a)}/?f=1t-rare-${(c.rareId ?? "").replace(/[^0-9a-z]/gi, "")}`;
/** 桌宠 / 开源版：注册完要去这里建一把 key，填回设置页。 */
export const consoleUrl = (a: AnoneSettings) => `${rareBase(a)}/console`;
export const isHosted = hosted;

/** 照 /quota 回的数，这一轮能不能聊、怎么付、输入框里写什么。pendingPick＝用户刚点了「设为我的一位」。 */
export type RareStatus = { ok: true; pay: RarePay; hint: string } | { ok: false; code: string };
export function rareStatus(c: SavedCharacter, q: RareQuota | null, pendingPick: boolean): RareStatus {
  if (!q) return { ok: true, pay: "default", hint: "" }; // 还没问到：让服务器决定，卡住了会回原因
  const name = c.name;
  if (q.member?.mine) return q.member.leftToday > 0 ? { ok: true, pay: "default", hint: t("free.memberLeft", { name, n: q.member.leftToday }) } : { ok: false, code: "member_daily_limit" };
  if (q.trialLeft > 0) return q.ipLeft > 0 ? { ok: true, pay: "default", hint: t("free.trialLeft", { name, n: q.trialLeft }) } : { ok: false, code: "ip_daily_limit" };
  if (!q.signedIn) return { ok: false, code: "trial_over" };
  if (pendingPick && q.member?.canPick) return { ok: true, pay: "pick", hint: t("free.pickNext", { name }) };
  if (c.prefs?.stamps && q.limits.pointsPerTurn > 0) {
    const n = q.balance ?? 0;
    return n >= q.limits.pointsPerTurn ? { ok: true, pay: "stamps", hint: t("free.stampsLeft", { per: q.limits.stampsPerTurn, n: n * 5 }) } : { ok: false, code: "insufficient_stamps" };
  }
  return { ok: false, code: "choose" };
}

export interface RareChoice { label: string; primary?: boolean; run: () => void }
export interface RareCard { text: string; note?: string; choices: RareChoice[] }
export interface RareActions {
  /** 重新问一次额度、重画 */
  refresh: () => void;
  /** 下一句把 TA 设为我的一位 */
  pick: () => void;
  /** 打开 / 关掉「用邮票聊」 */
  stamps: (on: boolean) => void;
  /** 去设置页填自己的 API（填完回到这里） */
  ownApi: () => void;
  /** 在浏览器里打开（桌宠外壳里交给系统浏览器） */
  open: (url: string) => void;
}

const nameOf = (rareId: string) =>
  listCharacters().find((x) => x.rareId === rareId)?.name ?? RARE.find((r) => r.id === rareId)?.name[lang()] ?? rareId;

/** 卡住时那张卡：一句话 + 几个按钮。聊天页画成卡片，桌宠画成字幕区的深色小卡。 */
export function rareCard(code: string, c: SavedCharacter, q: RareQuota | null, a: AnoneSettings, act: RareActions): RareCard {
  const L = q?.limits;
  const name = c.name;
  const own: RareChoice = { label: t("free.ownApi"), run: act.ownApi };
  const signup: RareChoice = { label: t("free.signup"), primary: true, run: () => act.open(signupUrl(c, a)) };
  const signedUp: RareChoice = isHosted()
    ? { label: t("free.signedUp"), run: act.refresh }
    : { label: t("free.signedUp"), run: () => { act.open(consoleUrl(a)); act.ownApi(); } };
  const signupNote = L ? t("free.signupNote", { people: L.memberPeople, turns: L.memberDailyTurns }) : undefined;
  const stampsLeft = (q?.balance ?? 0) * 5;
  switch (code) {
    case "trial_over":
      return { text: t("free.trialOver", { n: L?.trialTurns ?? 3, name }), note: isHosted() ? signupNote : `${signupNote ?? ""} ${t("free.needKey")}`.trim(), choices: [signup, signedUp, own] };
    case "ip_daily_limit":
      return { text: t("free.ipDone"), note: signupNote, choices: q?.signedIn ? [own] : [signup, signedUp, own] };
    case "member_daily_limit":
      return { text: t("free.memberDone", { name, turns: L?.memberDailyTurns ?? 20 }), choices: [own] };
    case "insufficient_stamps":
      return { text: t("free.noStamps", { n: stampsLeft, per: L?.stampsPerTurn ?? 5 }), choices: [{ label: t("free.earnStamps"), primary: true, run: () => act.open(rareBase(a)) }, own, { label: t("free.stopStamps"), run: () => act.stamps(false) }] };
    case "persona_changed":
      return { text: t("free.edited"), choices: [{ ...own, primary: true }] };
    case "offline":
      return { text: t("free.offline"), choices: [{ label: t("free.retry"), primary: true, run: act.refresh }, own] };
    default: { // choose：登录了、试聊用完、TA 还不是我的
      const stamps: RareChoice[] = L && L.pointsPerTurn > 0 ? [{ label: t("free.useStamps", { per: L.stampsPerTurn, n: stampsLeft }), run: () => act.stamps(true) }] : [];
      if (q?.member?.canPick) return { text: t("free.pickAsk", { name, people: L!.memberPeople, turns: L!.memberDailyTurns }), choices: [{ label: t("free.pick"), primary: true, run: act.pick }, ...stamps, own] };
      const names = (q?.member?.people ?? []).map(nameOf).join(lang() === "en" ? ", " : "、");
      return { text: t("free.yours", { people: L?.memberPeople ?? 2, names, name }), choices: [...stamps.map((x) => ({ ...x, primary: true })), own] };
    }
  }
}
