import type { CountMode, CountStatus } from "../engine";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** 回传给 AI 的结构化修订反馈 */
export interface RevisionFeedback {
  currentCount: number;
  targetCount: number;
  /** 目标 - 当前，正值需扩写，负值需压缩 */
  diff: number;
  mode: string;
  ruleSummary: string;
  instruction: string;
  maxAddOrReduce: number;
}

export interface HistoryEntry {
  id: string;
  ts: number;
  topic: string;
  target: number;
  mode: CountMode;
  finalCount: number;
  status: CountStatus;
  rounds: number;
  tokens: number;
  text: string;
  adopted: boolean;
}
