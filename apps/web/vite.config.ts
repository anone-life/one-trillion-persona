// 本地开发：/llm 代理到 ONE_T_DEV_TARGET，并在服务器端加上 ONE_T_DEV_KEY——
// 这样开发时网页里不用填 key（key 只在这台机器的环境变量里）。正式部署没有这个代理。
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const target = process.env.ONE_T_DEV_TARGET;
const key = process.env.ONE_T_DEV_KEY;

// 奇人的本机资产（runs/ 里的预生成人设和照片）只在本地开发时用；打包时换成空壳，除非 ONE_T_RARE_ASSETS=1（第 20 步）。
const keepRare = !!process.env.ONE_T_RARE_ASSETS;

export default defineConfig(({ command }) => ({
  plugins: command === "build" && !keepRare ? [{
    name: "rare-assets-stub",
    enforce: "pre" as const,
    resolveId(id: string) { return id.endsWith("/rare/assets.ts") ? fileURLToPath(new URL("./src/rare/assets.stub.ts", import.meta.url)) : null; },
  }] : [],
  // 挂在子路径下时设 ONE_T_BASE（anone.life 托管的那份是 /1t/）；默认 /，本地开发和自己部署不用管。
  base: process.env.ONE_T_BASE ?? "/",
  server: {
    port: 5190,
    proxy: target
      ? {
          "/llm": {
            target,
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/llm/, ""),
            headers: key ? { authorization: `Bearer ${key}` } : {},
          },
        }
      : undefined,
  },
  define: {
    __DEV_PROXY__: JSON.stringify(!!target),
    // anone.life 托管的那份（挂在 /1t/）只用 Grok（xAI）TTS；开源自己部署的可以换（第 22 步）
    __GROK_ONLY__: JSON.stringify(!!process.env.ONE_T_GROK_ONLY || process.env.ONE_T_BASE === "/1t/"),
    __DEV_MODEL__: JSON.stringify(process.env.ONE_T_DEV_MODEL ?? ""),
    __DEV_EXTRA_BODY__: JSON.stringify(process.env.ONE_T_DEV_EXTRA_BODY ?? ""),
  },
}));
