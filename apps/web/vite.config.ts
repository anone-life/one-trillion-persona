// 本地开发：/llm 代理到 ONE_T_DEV_TARGET，并在服务器端加上 ONE_T_DEV_KEY——
// 这样开发时网页里不用填 key（key 只在这台机器的环境变量里）。正式部署没有这个代理。
import { defineConfig } from "vite";

const target = process.env.ONE_T_DEV_TARGET;
const key = process.env.ONE_T_DEV_KEY;

export default defineConfig({
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
    __DEV_MODEL__: JSON.stringify(process.env.ONE_T_DEV_MODEL ?? ""),
    __DEV_EXTRA_BODY__: JSON.stringify(process.env.ONE_T_DEV_EXTRA_BODY ?? ""),
  },
});
