// 立绘播放器（开源，只照 anone.life 给的时间表放；怎么排的在 anone.life 那边）。
//
// - 两个 <video> 叠着：下一段先在藏着的那个里加载、停在起始帧，到点 play() 再换上来，避免切换时闪白。
// - 格式按浏览器挑：webm（VP9 透明）→ hevc.mp4（Safari 透明）→ mp4；表情脸没有 mp4 时用时间表给的 fallback。
// - 语音走 Web Audio：要在一次点击里先 unlock()，之后才能在请求回来时出声。
// - 本机切片耗时：每次量「play() → 第一帧真的画出来」，滑动平均，下次提前这么多切。
// - 留了一份调试记录（window.__1tPlayerLog）：每句的起播时刻、每段片子每一帧真正画出来的时刻——验收「声嘴对齐」用。
import type { Face, Spoken, TimelineEvent } from "./anone.ts";

type Ext = "webm" | "hevc.mp4" | "mp4";
const FPS = 24;

function pickExt(): Ext {
  const v = document.createElement("video");
  if (v.canPlayType('video/webm; codecs="vp9"')) return "webm";
  if (v.canPlayType('video/mp4; codecs="hvc1"')) return "hevc.mp4";
  return "mp4";
}

export interface FrameLog { clip: string; frames: { wall: number; mediaTime: number }[] }
export interface LineLog { audioStartWall: number; onsetMs: number; timeline: TimelineEvent[]; clips: FrameLog[] }
declare global { interface Window { __1tPlayerLog?: LineLog[] } }

export class Stage {
  readonly el: HTMLElement;
  private readonly videos: [HTMLVideoElement, HTMLVideoElement];
  private front = 0;
  private readonly ext: Ext = pickExt();
  private face: Face | null = null;
  private ctx: AudioContext | null = null;
  private leadMs = 120;
  private timers: number[] = [];
  private source: AudioBufferSourceNode | null = null;
  private log: LineLog | null = null;
  /** 每装一段 +1。换上来时不是最新那一次装的就作废——见 prepare()。 */
  private gen = 0;
  /** 每 stop() 一次 +1：playOnce 等片子放完的时候看它，被叫停就不再等（演示的「跳过」）。 */
  private runs = 0;

  /** crossOrigin：桌宠要读鼠标下那一点是不是透明（点击穿透），视频得按 CORS 加载才读得了像素；anone.life 的 CDN 回 `*`。 */
  constructor(opts: { crossOrigin?: boolean } = {}) {
    const mk = () => {
      const v = document.createElement("video");
      if (opts.crossOrigin) v.crossOrigin = "anonymous";
      v.muted = true;
      v.playsInline = true;
      v.loop = true;
      v.preload = "auto";
      v.className = "stage-video";
      return v;
    };
    this.videos = [mk(), mk()];
    this.videos[1].style.opacity = "0";
    this.el = document.createElement("div");
    this.el.className = "stage";
    this.el.append(...this.videos);
  }

  /** 正在显示的那一只（桌宠按它判点击穿透）。 */
  get current(): HTMLVideoElement { return this.videos[this.front]!; }

  /** 必须在一次点击里调：之后请求回来时才放得出声音（浏览器的自动播放规则）。 */
  unlock(): void {
    this.ctx ??= new AudioContext();
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  /** `idle: false`：先不上人（演示要从入场片开始，第 24 步）。 */
  setFace(face: Face | null, idle = true): void {
    this.face = face;
    if (face && idle) void this.show(face.clips.idle[0] ?? "idle", 0, true);
  }

  /** 这段片子在这个浏览器里会用哪个地址（演示要提前下载，第 24 步）。 */
  clipUrl(clip: string, fallback?: string): string { return this.url(clip, fallback); }

  private url(clip: string, fallback?: string): string {
    const f = this.face!;
    const hasMp4 = !clip.startsWith("face_");
    const name = this.ext === "mp4" && !hasMp4 ? (fallback ?? f.clips.speaking[0] ?? "speaking") : clip;
    return `${f.base}/${name}.${this.ext}`;
  }

  /** 把 clip 装进藏着的那个 video、停在 startFrame，返回一个「换上来」的函数。 */
  private async prepare(clip: string, startFrame = 0, fallback?: string): Promise<() => Promise<void>> {
    // 两次装片可能同时在等加载（回复比 thinking 片子先到时：thinking 还在加载，speaking 已经装进同一只藏着的 video）。
    // 晚到的那次「换上来」不能再执行：它会把已经在前面的那只当成「旧的」藏掉，两只都透明，人就没了（2026-10-18 桌宠冒烟发现）。
    const my = ++this.gen;
    const back = this.videos[1 - this.front]!;
    const src = this.url(clip, fallback);
    back.loop = true; // playOnce 放出入场时会关掉，换下一段前恢复
    if (back.dataset["src"] !== src) {
      back.dataset["src"] = src;
      back.src = src;
    }
    back.pause();
    await new Promise<void>((resolve) => {
      if (back.readyState >= 1) return resolve();
      back.addEventListener("loadedmetadata", () => resolve(), { once: true });
      back.addEventListener("error", () => resolve(), { once: true });
    });
    back.currentTime = startFrame / FPS;
    await new Promise<void>((resolve) => {
      if (back.readyState >= 2) return resolve();
      back.addEventListener("canplay", () => resolve(), { once: true });
      setTimeout(resolve, 1500);
    });
    return async () => {
      if (my !== this.gen) return; // 后面又装了一段，这次作废
      if (back === this.videos[this.front]) { back.style.opacity = "1"; return; }
      const asked = performance.now();
      const frames: { wall: number; mediaTime: number }[] = [];
      this.log?.clips.push({ clip, frames });
      let first = true;
      const onFrame = (now: number, meta: { mediaTime: number }) => {
        frames.push({ wall: now, mediaTime: meta.mediaTime });
        if (first) {
          first = false;
          this.leadMs = this.leadMs * 0.7 + Math.min(600, now - asked) * 0.3;
        }
        if (frames.length < 200 && this.videos[this.front] === back) back.requestVideoFrameCallback(onFrame);
      };
      if ("requestVideoFrameCallback" in back) back.requestVideoFrameCallback(onFrame);
      await back.play().catch(() => undefined);
      back.style.opacity = "1";
      const old = this.videos[this.front]!;
      old.style.opacity = "0";
      old.pause();
      this.front = 1 - this.front;
    };
  }

  private async show(clip: string, startFrame = 0, _loop = true, fallback?: string): Promise<void> {
    const swap = await this.prepare(clip, startFrame, fallback);
    await swap();
  }

  thinking(): void {
    if (this.face) void this.show(this.face.clips.thinking[0] ?? "thinking");
  }

  idle(): void {
    if (this.face) void this.show(this.face.clips.idle[0] ?? "idle");
  }

  stop(): void {
    this.runs++;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    try { this.source?.stop(); } catch { /* 已经停了 */ }
    this.source = null;
  }

  /** 放一句：语音 + 按时间表换片子。返回在这句说完时 resolve。 */
  async play(line: Spoken): Promise<void> {
    if (!this.face || !this.ctx) return;
    this.stop();
    const bytes = Uint8Array.from(atob(line.audio.base64), (c) => c.charCodeAt(0));
    await this.run(await this.ctx.decodeAudioData(bytes.buffer), line.timeline, line.audio.onsetMs);
  }

  /** 同 play()，声音是现成的一段（演示包里事先合成好的 mp3，第 24 步）。 */
  async playBytes(bytes: ArrayBuffer, timeline: TimelineEvent[], onsetMs: number, onStart?: () => void): Promise<void> {
    if (!this.face || !this.ctx) return;
    this.stop();
    await this.run(await this.ctx.decodeAudioData(bytes.slice(0)), timeline, onsetMs, onStart);
  }

  /**
   * 放一支只放一遍的片子（出入场，第 24 步）：声音在片子第 `audioAtMs` 毫秒响起——
   * 演示包按片子里开始动嘴的时刻算好的。片子放完（或 stop()）时 resolve，停在最后一帧。
   */
  async playOnce(clip: string, bytes: ArrayBuffer | null, audioAtMs: number, clipMs: number, onStart?: () => void): Promise<void> {
    if (!this.face || !this.ctx) return;
    this.stop();
    const my = this.runs;
    const buffer = bytes ? await this.ctx.decodeAudioData(bytes.slice(0)) : null;
    const swap = await this.prepare(clip, 0);
    if (my !== this.runs) return;
    await swap();
    const v = this.current;
    v.loop = false;
    onStart?.();
    if (buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.ctx.destination);
      const latency = (this.ctx.outputLatency || this.ctx.baseLatency || 0);
      src.start(this.ctx.currentTime + Math.max(0, audioAtMs / 1000 - v.currentTime - latency));
      this.source = src;
    }
    await new Promise<void>((resolve) => {
      const done = () => { clearInterval(poll); resolve(); };
      v.addEventListener("ended", done, { once: true });
      // ended 偶尔不来（Safari 的 hevc），按时长兜底；stop() 也要能叫停
      const poll = window.setInterval(() => { if (my !== this.runs || v.currentTime * 1000 >= clipMs - 60) done(); }, 100);
    });
  }

  private async run(buffer: AudioBuffer, timeline: TimelineEvent[], onsetMs: number, onStart?: () => void): Promise<void> {
    if (!this.ctx) return;
    const line = { timeline, audio: { onsetMs } };
    // 先把说话那一段装好、停在起始帧，到点只剩 play() + 换层
    const events = line.timeline.slice(1);
    const ready = new Map<TimelineEvent, Promise<() => Promise<void>>>();
    for (const ev of events.slice(0, 1)) ready.set(ev, this.prepare(ev.clip, ev.startFrame ?? 0, ev.fallback));
    await Promise.all(ready.values());

    const startAt = this.ctx.currentTime + 0.05;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    src.start(startAt);
    this.source = src;
    onStart?.();
    const latency = (this.ctx.outputLatency || this.ctx.baseLatency || 0) * 1000;
    const audioStartWall = performance.now() + (startAt - this.ctx.currentTime) * 1000 + latency;
    this.log = { audioStartWall, onsetMs: line.audio.onsetMs, timeline: line.timeline, clips: [] };
    (window.__1tPlayerLog ??= []).push(this.log);

    for (const ev of events) {
      const due = audioStartWall + ev.atMs - this.leadMs - performance.now();
      this.timers.push(window.setTimeout(async () => {
        const swap = await (ready.get(ev) ?? this.prepare(ev.clip, ev.startFrame ?? 0, ev.fallback));
        await swap();
      }, Math.max(0, due)));
    }
    await new Promise<void>((resolve) => { src.onended = () => resolve(); });
    // 调试记录另存一份：页面被导航走也不丢（验收「声嘴对齐」时用）
    try { sessionStorage.setItem("1t.playerLog", JSON.stringify(window.__1tPlayerLog)); } catch { /* 存不了就算了 */ }
  }
}
