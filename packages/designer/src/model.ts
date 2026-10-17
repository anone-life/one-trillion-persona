// OpenAI 兼容的聊天接口。任何兼容服务都能接：OpenAI、DeepSeek、OpenRouter、Novita、本地 Ollama。

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 额外塞进请求体的字段，比如关掉隐藏推理：{ "chat_template_kwargs": { "thinking": false } } */
  extraBody?: Record<string, unknown>;
  timeoutMs?: number;
}

export class ModelError extends Error {
  constructor(message: string) { super(message); this.name = "ModelError"; }
}

/** 从环境变量读：OPENAI_BASE_URL、OPENAI_API_KEY、ONE_T_MODEL、ONE_T_EXTRA_BODY（JSON）。 */
export function modelFromEnv(env: Record<string, string | undefined> = process.env): ModelConfig {
  const baseUrl = env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const apiKey = env.OPENAI_API_KEY ?? "";
  const model = env.ONE_T_MODEL ?? "gpt-4o-mini";
  if (!apiKey) throw new ModelError("set OPENAI_API_KEY (and OPENAI_BASE_URL / ONE_T_MODEL for non-OpenAI providers)");
  let extraBody: Record<string, unknown> | undefined;
  if (env.ONE_T_EXTRA_BODY) extraBody = JSON.parse(env.ONE_T_EXTRA_BODY) as Record<string, unknown>;
  return { baseUrl, apiKey, model, extraBody };
}

export interface Model {
  chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

export function openAICompatible(cfg: ModelConfig): Model {
  return {
    async chat(messages, opts = {}) {
      // 429 和 5xx 退避重试：Novita 这类服务限 30 次/分钟，一轮塑造加生成要二十来次请求
      const waits = [2000, 5000, 15000, 30000];
      for (let attempt = 0; ; attempt++) {
        try {
          return await once(messages, opts);
        } catch (e) {
          const status = (e as ModelError & { status?: number }).status ?? 0;
          if (attempt >= waits.length || !(status === 429 || status >= 500)) throw e;
          await new Promise((r) => setTimeout(r, waits[attempt]));
        }
      }
    },
  };

  async function once(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number }): Promise<string> {
    {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        // 没有 key 时不带这个头（网页版走本地开发代理时，key 由代理在服务器端加）
        headers: { "content-type": "application/json", ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: opts.temperature ?? 0.8,
          max_tokens: opts.maxTokens ?? 2000,
          ...cfg.extraBody,
        }),
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 120_000),
      });
      if (!res.ok) {
        const err = new ModelError(`model request failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`) as ModelError & { status?: number };
        err.status = res.status;
        throw err;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new ModelError("model returned no text");
      return text.trim();
    }
  }
}

/** 从模型输出里抠出第一个 JSON 对象（容忍前后多余文字和 ``` 围栏）。 */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ModelError("no JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

/** 要一个 JSON 对象；解析失败或校验失败就把错误告诉模型再要一次。 */
export async function askJson<T>(
  model: Model, system: string, user: string, validate: (v: unknown) => T, attempts = 2,
): Promise<T> {
  const messages: ChatMessage[] = [{ role: "system", content: system }, { role: "user", content: user }];
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    const raw = await model.chat(messages, { temperature: 0.7, maxTokens: 4000 });
    try {
      return validate(extractJson(raw));
    } catch (e) {
      last = e;
      messages.push({ role: "assistant", content: raw }, {
        role: "user",
        content: `That didn't work: ${(e as Error).message}. Output the whole JSON object again, fixed, and nothing else.`,
      });
    }
  }
  throw new ModelError(`model could not produce valid JSON: ${(last as Error)?.message}`);
}
