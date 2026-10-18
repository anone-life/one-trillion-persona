// 和角色说一句：聊天页（main.ts 的 characterView）和桌宠（pet.ts）共用这一份。
// 两个入口各写一份的话，一边修了另一边不会跟着修（第 21 步）。
// 台词只给玩家自己的模型和 TTS；anone.life 只收情绪、脸、开口时刻和时长（第 19 步）。
import type { Model } from "@1t-persona/designer/browser";
import { pronounsFor } from "@1t-persona/designer/browser";
import { AnoneError, EMOTIONS, spokenText, takeEmotion, type AnoneSettings, type Face } from "./anone.ts";
import { defaultVoice, loadVoice, synthesize, voiceLine, voiceReady } from "./voice.ts";
import { pcmToWav, trimLeadingSilence } from "./audio.ts";
import type { Stage } from "./player.ts";
import { LANG_NAME, t } from "./i18n.ts";
import { saveCharacter, type SavedCharacter } from "./store.ts";
import { RARE } from "./rare-data.ts";
import { RARE_CONTEXT } from "./rare/context.ts";
import { RareStop } from "./rare-free.ts";

export function characterSystem(c: SavedCharacter, withEmotion: boolean): string {
  const p = c.skeleton ? pronounsFor(c.skeleton) : { subj: "they" };
  return [
    c.persona,
    "",
    "## This conversation",
    `You are ${c.name}. Stay in character. You're texting with the person described above (${c.relationToUser || "someone you know"}).`,
    `Reply the way ${c.name} would text: natural, usually short, ${c.prefs?.actions ? "and every reply includes exactly one very short action or expression written in *asterisks* (what they visibly do, not what they think)," : "no narration or stage directions,"} no lists. Never mention being an AI character or a persona file unless asked directly — and if asked directly whether ${p.subj === "they" ? "they're" : `${p.subj}'s`} an AI, say so honestly, in character.`,
    ...rareMeeting(c),
    ...(c.lang && c.lang !== "en" ? [`Reply in ${LANG_NAME[c.lang]}, unless the user clearly writes to you in another language.`] : []),
    ...(withEmotion ? [`Start every reply with exactly one tag for how ${c.name} feels saying it — one of ${EMOTIONS.map((e) => `[${e}]`).join(" ")} — then the reply. The tag is never shown; it moves ${c.name}'s face.`] : []),
  ].join("\n");
}

export interface TalkHooks {
  /** 「TA 正在打字…」「TA 正在说话…」；空字符串＝清掉 */
  status(text: string): void;
  /** 一条系统提示（出错、没声音、到了每天上限） */
  sys(text: string): void;
  /** 回复已经存进 c.chat，重画 */
  redraw(): void;
}
/** 接了 anone.life 的脸才有 stage；纯文字的角色 face、stage 都是 null。 */
export interface Live { face: Face | null; stage: Stage | null; anone: AnoneSettings }

/** 「还没有声音」只提示一次（每个角色、每次打开页面） */
const silentHinted = new Set<string>();

/**
 * 对着聊天记录的最后一句（他说的）生成回复、存下来；接了脸就配音、照时间表动。
 * 必须在一次点击里同步调到第一个 await 之前（stage.unlock() 要用户手势）。
 * 模型出错时抛出（调用方决定要不要撤回他那一句）；配音出错只提示，不抛。
 */
export async function reply(c: SavedCharacter, model: Model, live: Live, hooks: TalkHooks): Promise<void> {
  const stage = live.face ? live.stage : null;
  const face = stage ? live.face : null;
  if (face && stage) { stage.unlock(); stage.thinking(); }
  hooks.status(t("chat.typing", { name: c.name }));
  let text: string;
  try {
    text = await model.chat([{ role: "system", content: characterSystem(c, !!face || !!c.prefs?.voice) }, ...c.chat.slice(-30)], { temperature: 0.9, maxTokens: 400 });
  } catch (e) {
    hooks.status("");
    stage?.idle();
    // 一期一会试聊卡住了（第 28 步）：不是出错，调用方换成那张三选一的卡
    if (!(e instanceof RareStop)) hooks.sys(t("chat.error", { msg: (e as Error).message }));
    throw e;
  }
  c.chat.push({ role: "assistant", content: text });
  saveCharacter(c);
  hooks.status("");
  hooks.redraw();
  await speak(c, text, live, hooks);
}

/**
 * 把 TA 的一句回复说出来：接了脸就配音 + 照时间表动；没脸时开了播音只出声。
 * reply() 回完话调它；桌宠「播音」打开那一刻也调它补念最后一句（照 anone.life 桌宠 setBroadcast，第 21 步）。
 */
export async function speak(c: SavedCharacter, text: string, live: Live, hooks: TalkHooks): Promise<void> {
  const { anone } = live;
  const stage = live.face ? live.stage : null;
  const face = stage ? live.face : null;
  // 没有脸时，开了播音就只出声（第 22 步）
  if (!face || !stage) { if (c.prefs?.voice) await speakWithoutFace(c, text, hooks); return; }
  stage.unlock();
  // 今天这把 key 的句数用完了（第 24 步）：不再每句都去撞 429——立绘停在 idle，有配音就只出声，文字照常
  if (limitDay === tokyoDay()) { stage.idle(); if (voiceReady(loadVoice())) await speakWithoutFace(c, text, hooks); return; }
  const { emotion, text: said } = takeEmotion(text);
  const line = spokenText(said);
  if (!line) { stage.idle(); return; }
  hooks.status(t("char.speaking", { name: c.name }));
  try {
    const voice = loadVoice();
    const spoken = await voiceLine(anone, voice, face, { text: line.slice(0, 300), emotion, lang: c.lang ?? "en" });
    if (!voiceReady(voice) && !silentHinted.has(c.id)) { silentHinted.add(c.id); hooks.sys(t("face.silent")); }
    const u = spoken.usage;
    if (u && u.linesLimit - u.linesToday <= 5 && u.linesToday < u.linesLimit && warnDay !== tokyoDay()) {
      warnDay = tokyoDay();
      hooks.sys(t("face.limitSoon", { n: u.linesLimit - u.linesToday, limit: u.linesLimit }));
    }
    await stage.play(spoken); // 时间表最后一段就是 idle，不用再切
  } catch (e) {
    stage.idle();
    if (e instanceof AnoneError && e.status === 429) {
      // 只提示一次；这一句照样念出来（有配音的话）
      if (limitDay !== tokyoDay()) { limitDay = tokyoDay(); hooks.sys(t("face.dailyLimit")); }
      if (voiceReady(loadVoice())) await speakWithoutFace(c, text, hooks);
    } else hooks.sys(t("face.voiceFail", { msg: (e as Error).message }));
  } finally {
    hooks.status("");
  }
}

/** anone.life 的句数按东京时间的一天算（服务端 config.usage.timeZone）。 */
const tokyoDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
/** 今天撞过 429 的那一天 / 今天提醒过「快用完了」的那一天（只在这一页的内存里）。 */
let limitDay = "", warnDay = "";

/** 没脸时正在念的那一段（桌宠关掉播音时要能停）。 */
let playing: HTMLAudioElement | null = null;
/** 停掉正在念的：没脸的那段声音；有脸的由调用方 stage.stop()。 */
export function stopSpeaking(): void {
  if (playing) { playing.pause(); playing.dispatchEvent(new Event("ended")); playing = null; }
}

/** 没有脸（奇人、没挑脸的角色）时的播音：只出声、不动嘴，用玩家自己的 TTS。没填 TTS 就提示一次（第 22 步）。 */
async function speakWithoutFace(c: SavedCharacter, reply: string, hooks: TalkHooks): Promise<void> {
  const voice = loadVoice();
  if (!voiceReady(voice)) {
    if (!silentHinted.has(c.id)) { silentHinted.add(c.id); hooks.sys(t("chat.opt.voiceNoKey")); }
    return;
  }
  const { emotion, text } = takeEmotion(reply);
  const line = spokenText(text);
  if (!line) return;
  const g = c.skeleton?.layers.body?.gender_present;
  const gender = g === "masculine" ? "male" : g === "feminine" ? "female" : null;
  hooks.status(t("char.speaking", { name: c.name }));
  try {
    const raw = await synthesize(voice, { text: line.slice(0, 300), emotion, lang: c.lang ?? "en", voice: c.prefs?.voiceId ?? defaultVoice(voice.provider, gender), gender });
    const url = URL.createObjectURL(new Blob([new Uint8Array(pcmToWav(trimLeadingSilence(raw).pcm))], { type: "audio/wav" }));
    const audio = new Audio(url);
    playing = audio;
    await new Promise<void>((done) => { audio.onended = audio.onerror = () => done(); audio.play().catch(() => done()); });
    URL.revokeObjectURL(url);
  } catch (e) {
    hooks.sys(t("face.voiceFail", { msg: (e as Error).message }));
  } finally {
    hooks.status("");
  }
}

/** 奇人：把情境卡上的那几句也告诉 TA，和页面上用户看到的一致（第 22 步）。 */
function rareMeeting(c: SavedCharacter): string[] {
  const r = c.rareId ? RARE.find((x) => x.id === c.rareId) : undefined;
  const ctx = r ? RARE_CONTEXT[r.id] : undefined;
  if (!r || !ctx) return [];
  return [
    "",
    "## This first meeting (the user sees the same)",
    `Where: ${r.scene.en}`,
    `The user: ${ctx.you.en}`,
    `Between you: ${ctx.relation.en}`,
    `The tension: ${ctx.tension.en}`,
    "Let the tension show in what you do and say; don't explain it.",
  ];
}
