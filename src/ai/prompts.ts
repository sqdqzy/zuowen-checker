import type { CountMode, LinedRules } from "../engine";
import type { RevisionFeedback } from "./types";

export const SYSTEM_PROMPT =
  "你是一位经验丰富的语文老师，擅长指导学生写作。你写出的作文语言自然、结构清晰、紧扣题目，不堆砌辞藻，不敷衍凑字。";

export function ruleSummaryText(mode: CountMode, lined: LinedRules): string {
  if (mode === "lined") {
    const parts = ["横线本模式"];
    parts.push(lined.countPunct ? "计入标点" : "不计标点");
    parts.push(lined.countLatin || lined.countDigits ? "计入英文和数字" : "不计英文和数字");
    if (!lined.countTitle) parts.push("不计标题");
    return parts.join("，");
  }
  return "作文本模式，标点占格（破折号、省略号占 2 格），每段首行缩进 2 格计入占格";
}

export function buildOutlinePrompt(topic: string, requirements: string, target: number): string {
  return [
    `作文题目：${topic.trim() || "（未提供）"}`,
    requirements.trim() ? `写作要求：${requirements.trim()}` : "",
    `目标字数：约 ${target} 字`,
    "",
    "请先输出一份作文大纲，包含：",
    "1. 主题立意",
    "2. 结构安排（开头 / 主体 / 结尾各写什么）",
    "3. 素材要点",
    "4. 字数分配建议",
    "只输出大纲本身，不要写正文。"
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildBodyPrompt(
  topic: string,
  requirements: string,
  target: number,
  outline: string,
  mode: CountMode,
  lined: LinedRules
): string {
  return [
    `作文题目：${topic.trim() || "（未提供）"}`,
    requirements.trim() ? `写作要求：${requirements.trim()}` : "",
    `目标字数：约 ${target} 字`,
    `统计规则：${ruleSummaryText(mode, lined)}`,
    outline.trim() ? `参考大纲：\n${outline.trim()}` : "",
    "",
    "请写出完整作文。输出格式要求：第一行为作文标题，空一行，然后输出正文。",
    "除标题外不要使用 Markdown 标记，不要输出评语、解释或字数说明。"
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRevisionPrompt(previousText: string, feedback: RevisionFeedback): string {
  const absDiff = Math.abs(feedback.diff);
  const min = Math.max(10, Math.round(absDiff * 0.8));
  const max = Math.min(400, Math.round(absDiff * 1.2));
  const action = feedback.diff > 0 ? "扩写" : "压缩";
  const verb = feedback.diff > 0 ? "增加" : "减少";
  return [
    "下面是一篇作文的当前版本：",
    '"""',
    previousText,
    '"""',
    "",
    `当前字数 ${feedback.currentCount}，目标字数 ${feedback.targetCount}，相差 ${feedback.diff} 字。`,
    `统计模式：${feedback.mode}；${feedback.ruleSummary}。`,
    `请在保持题意、结构与语言风格不变的前提下${action}，使字数${verb}约 ${min}～${max} 字。`,
    "禁止无意义重复，禁止堆砌标点凑数，禁止改变核心内容。",
    "只输出修改后的完整作文（第一行标题，空一行后正文），不要输出任何解释。"
  ].join("\n");
}
