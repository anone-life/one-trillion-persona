// 模型设置。key 只存在这个浏览器里，只发给用户自己填的 baseUrl。
import { openAICompatible, type Model, type ModelConfig } from "@1t-persona/designer/browser";

declare const __DEV_PROXY__: boolean;
declare const __DEV_MODEL__: string;
declare const __DEV_EXTRA_BODY__: string;

export interface Settings { baseUrl: string; apiKey: string; model: string; extraBody: string }
const KEY = "1t.model.v1";

export const DEV_PROXY = typeof __DEV_PROXY__ !== "undefined" && __DEV_PROXY__;

export const PRESETS: { label: string; settings: Partial<Settings> }[] = [
  { label: "OpenAI", settings: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" } },
  { label: "OpenRouter", settings: { baseUrl: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-chat" } },
  { label: "DeepSeek", settings: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" } },
  { label: "Ollama (local)", settings: { baseUrl: "http://localhost:11434/v1", model: "llama3.1" } },
  ...(DEV_PROXY ? [{ label: "Local dev proxy", settings: { baseUrl: "/llm", apiKey: "", model: __DEV_MODEL__, extraBody: __DEV_EXTRA_BODY__ } }] : []),
];

export function loadSettings(): Settings {
  const fallback: Settings = DEV_PROXY
    ? { baseUrl: "/llm", apiKey: "", model: __DEV_MODEL__, extraBody: __DEV_EXTRA_BODY__ }
    : { baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini", extraBody: "" };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Settings>) } : fallback;
  } catch {
    return fallback;
  }
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 存不了就只在这一页里有效 */ }
}

/** 能不能用：相对地址（本地代理）可以没有 key，其他必须有。 */
export function ready(s: Settings): boolean {
  return !!s.model && (s.baseUrl.startsWith("/") || !!s.apiKey);
}

export function modelFrom(s: Settings): Model {
  let extraBody: Record<string, unknown> | undefined;
  if (s.extraBody.trim()) {
    try { extraBody = JSON.parse(s.extraBody) as Record<string, unknown>; }
    catch { throw new Error("\"Extra request fields\" in Model settings isn't valid JSON"); }
  }
  const cfg: ModelConfig = { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model, extraBody };
  return openAICompatible(cfg);
}
