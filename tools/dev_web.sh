#!/bin/bash
# 本地开发起网页版（npm run web 也行；这个脚本多做一件事：给 /llm 代理配上模型地址和 key）。模型走 Vite 的 /llm 代理，key 只在这台机器的环境变量里，由代理在服务器端加。
# 配置放 .env.local（不进 git）：
#   ONE_T_DEV_TARGET=https://api.example.com/v1
#   ONE_T_DEV_MODEL=deepseek/deepseek-v4-flash-0731
#   ONE_T_DEV_EXTRA_BODY='{"chat_template_kwargs":{"thinking":false}}'   # 单引号：不加的话 bash 会吃掉 JSON 里的双引号
#   ONE_T_DEV_KEY=...                      # 你的模型 key（只在这台机器上；或者用 ONE_T_DEV_KEY_FROM=某个环境变量名）
cd "$(dirname "$0")/.."
set -a
[ -f .env.local ] && . .env.local
set +a
if [ -n "$ONE_T_DEV_KEY_FROM" ]; then export ONE_T_DEV_KEY="${!ONE_T_DEV_KEY_FROM}"; fi
exec npm --workspace @1t-persona/web run dev -- --port "${PORT:-5190}" --strictPort
