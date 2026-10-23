import type { CountMode, GridLayout, LinedResult, LinedRules } from "../engine";
import type { RevisionFeedback } from "./types";
import { ruleSummaryText } from "./prompts";

export type AnyResult = LinedResult | GridLayout;

export function resultCount(r: AnyResult): number {
  return r.mode === "lined" ? r.countedChars : r.countedOccupied;
}

/** 由校验结果构造回传给 AI 的结构化修订反馈 */
export function buildRevisionFeedback(
  result: AnyResult,
  mode: CountMode,
  lined: LinedRules,
  targetCount: number
): RevisionFeedback {
  const current = resultCount(result);
  const diff = targetCount - current;
  const abs = Math.abs(diff);
  const min = Math.max(10, Math.round(abs * 0.8));
  const max = Math.min(400, Math.round(abs * 1.2));
  return {
    currentCount: current,
    targetCount,
    diff,
    mode: mode === "lined" ? "横线本" : "作文本",
    ruleSummary: ruleSummaryText(mode, lined),
    instruction: diff > 0 ? `请扩写约 ${min}～${max} 字` : `请压缩约 ${min}～${max} 字`,
    maxAddOrReduce: max
  };
}
