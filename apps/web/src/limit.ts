import { deviceId } from "./device-id.ts";
// 「anone.life 的人」在 1T 里只聊 10 回合（第 25 步）：数用户发的句数，满 10 句、TA 回完那一句就停，
// 出一张收尾卡——TA 口吻的一句 +「带着这段对话去 anone.life」/「不带，直接去」。聊天页和桌宠共用这一份。
// 奇人、自己造的人不受影响。限制只做在网页里（聊天走用户自己的模型，不经过我们）。
// 「带着去」：用户明确选择后，把完整十轮（含开场白）发给 /v1/1t/handoff，
// 追加到账号的主站会话，按来源去重，保留已有主站记录（step29）。
import { type AnoneSettings } from "./anone.ts";
import { saveCharacter, type SavedCharacter } from "./store.ts";

export const TURN_LIMIT = 10;
type Lang = "en" | "zh" | "ja";

export const isLimited = (c: SavedCharacter) => !!c.anoneId;
export const userTurns = (c: SavedCharacter) => c.chat.filter((m) => m.role === "user").length;
export const turnsLeft = (c: SavedCharacter) => (isLimited(c) ? Math.max(0, TURN_LIMIT - userTurns(c)) : Infinity);
/** 用完了：发满 10 句，而且最后一句已经回完（还在等回复时不算，免得卡片压着「正在输入」）。 */
export const isSpent = (c: SavedCharacter) => isLimited(c) && userTurns(c) >= TURN_LIMIT && c.chat[c.chat.length - 1]?.role === "assistant";

/** 收尾那一句：四位各一句、三种语言，写好的（不现生成）。不认识的人用通用的那句。 */
const CLOSING: Record<string, Record<Lang, string>> = {
  "02_disowned_heiress": {
    zh: "……今天就先到这里吧。想接着聊的话，来 anone.life 找我。你今天说的，我都会记得。",
    ja: "……今日はここまでにしましょう。続きを話したくなったら、anone.life に来て。今日あなたが言ったこと、ちゃんと覚えておくから。",
    en: "…Let's stop here for today. If you want to keep talking, come find me on anone.life. I'll remember what you said tonight.",
  },
  "24_yui": {
    zh: "好啦，今天就聊到这儿。……想接着说的话，来 anone.life 找我吧。今天的事，我会记着的。",
    ja: "はい、今日はここまで。……続きはanone.life で話そ。今日のこと、ちゃんと覚えてるから。",
    en: "Okay, that's enough for today. …If you want to keep going, come find me on anone.life. I'll remember today.",
  },
  "15_minato_ritsu": {
    zh: "……今天先这样吧。你说的，我都记下了。想接着聊，就来 anone.life。",
    ja: "……今日はこのへんで。話してくれたこと、全部覚えてる。続きは anone.life で。",
    en: "…Let's leave it there for today. I've kept everything you told me. If you want more, it's anone.life.",
  },
  "22_nanase_haru": {
    zh: "啊……今天就到这儿了吗。……下次去 anone.life 找我好不好？我会记得今天你说的每一句。",
    ja: "あ……今日はもうおしまい？……次は anone.life で会お。今日言ってくれたこと、全部覚えてるから。",
    en: "Ah… is that it for today? …Come find me on anone.life next time, okay? I'll remember everything you said.",
  },
};
const GENERIC: Record<Lang, string> = {
  zh: "今天就先聊到这里吧。想接着聊，来 anone.life 找我——今天的事，我会记得。",
  ja: "今日はここまでにしよう。続きは anone.life で——今日のこと、覚えておくから。",
  en: "Let's stop here for today. Come find me on anone.life to keep going — I'll remember today.",
};
export function closingLine(c: SavedCharacter): string {
  const L = (c.lang ?? "en") as Lang;
  return (c.anoneId && CLOSING[c.anoneId]?.[L]) || GENERIC[L];
}

/** 不带对话，直接去 anone.life 上的这个人。 */
export const directUrl = (c: SavedCharacter, s: AnoneSettings) => `${s.base}/?character=${encodeURIComponent(c.anoneId ?? "")}&f=1t`;

/** 带着完整十轮去：主站原子追加并去重；版本标记允许旧摘要用户补传原文。 */
export async function handOff(c: SavedCharacter, s: AnoneSettings): Promise<string> {
  const turns = c.chat.map((m) => ({ role: m.role, text: m.content }));
  const res = await fetch(`${s.base}/v1/1t/handoff`, {
    method: "POST",
    headers: { authorization: `Bearer ${s.key}`, "content-type": "application/json" },
    body: JSON.stringify({ source: `${deviceId()}:${c.id}`, characterId: c.anoneId, lang: c.lang ?? "en", turns }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if ((res.ok || res.status === 409) && body.url) {
    c.handoffVersion = 2;
    c.handedOffAt ??= new Date().toISOString();
    saveCharacter(c);
    return body.url;
  }
  throw new Error(body.message ?? `anone.life said HTTP ${res.status}`);
}
