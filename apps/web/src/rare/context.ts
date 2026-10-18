// 奇人的初见情境：你是谁 / 你们的关系 / 冲突点（第 22 步）。三批由 context-{a,b,c}.ts 写，这里合并。
import type { L3 } from "../rare-data.ts";
import { CONTEXT_A } from "./context-a.ts";
import { CONTEXT_B } from "./context-b.ts";
import { CONTEXT_C } from "./context-c.ts";
export type RareContext = { you: L3; relation: L3; tension: L3 };
export const RARE_CONTEXT: Record<string, RareContext> = { ...CONTEXT_A, ...CONTEXT_B, ...CONTEXT_C };
