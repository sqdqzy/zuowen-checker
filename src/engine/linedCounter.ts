import { classifyChar, firstNonEmptyLine, hasTitleLine, splitLines } from "./textUnits";
import type { CountStatus, LinedResult, LinedRules } from "./types";

export interface LinedCharFlag {
  ch: string;
  type: ReturnType<typeof classifyChar>;
  counted: boolean;
}

export interface LinedLine {
  chars: LinedCharFlag[];
  isTitle: boolean;
}

/** 逐字符标注是否计入字数（横线本模式），供统计与高亮预览共用 */
export function annotateLined(text: string, rules: LinedRules): LinedLine[] {
  const lines = splitLines(text);
  const firstIdx = firstNonEmptyLine(lines);
  const withTitle = hasTitleLine(lines);
  return lines.map((line, idx) => {
    const isTitle = withTitle && idx === firstIdx;
    const chars: LinedCharFlag[] = Array.from(line).map((ch) => {
      const type = classifyChar(ch);
      let counted: boolean;
      if (type === "hanzi") counted = true;
      else if (type === "punct") counted = rules.countPunct;
      else if (type === "latin") counted = rules.countLatin;
      else if (type === "digit") counted = rules.countDigits;
      else counted = false;
      if (isTitle && !rules.countTitle) counted = false;
      return { ch, type, counted };
    });
    return { chars, isTitle };
  });
}

export function judgeLined(counted: number, target: number, rules: LinedRules): { status: CountStatus; message: string } {
  if (!(target > 0)) {
    return { status: "invalidConfig", message: "目标字数必须大于 0，请重新设置。" };
  }
  if (rules.judgeMode === "tolerance") {
    const lo = target - rules.tolerance;
    const hi = target + rules.tolerance;
    if (counted < lo) {
      return { status: "below", message: `字数不达标：当前 ${counted} 字，目标 ${target}±${rules.tolerance} 字，还差 ${lo - counted} 字。` };
    }
    if (counted > hi) {
      return { status: "overflow", message: `超出容差上限：当前 ${counted} 字，目标 ${target}±${rules.tolerance} 字，多出 ${counted - hi} 字。` };
    }
    return { status: "qualified", message: `合格：当前 ${counted} 字，处于目标 ${target}±${rules.tolerance} 字范围内。` };
  }
  if (counted < target) {
    return { status: "below", message: `字数不达标：当前 ${counted} 字，目标 ${target} 字，还差 ${target - counted} 字。` };
  }
  if (counted > target + rules.tolerance) {
    return { status: "overflow", message: `已超出目标：当前 ${counted} 字，目标 ${target} 字（提醒阈值 +${rules.tolerance} 字），多出 ${counted - target} 字。` };
  }
  return { status: "qualified", message: `合格：当前 ${counted} 字，已达到目标 ${target} 字。` };
}

export function countLined(text: string, rules: LinedRules, targetCount: number): LinedResult {
  const annotated = annotateLined(text, rules);
  let totalChars = 0;
  let countedChars = 0;
  let titleCounted = 0;
  let bodyCounted = 0;
  let hanziCount = 0;
  let punctCount = 0;
  let latinCount = 0;
  let digitCount = 0;
  let paragraphCount = 0;
  for (const line of annotated) {
    if (line.chars.some((c) => c.ch.trim().length > 0)) paragraphCount += 1;
    for (const c of line.chars) {
      totalChars += 1;
      if (c.type === "hanzi") hanziCount += 1;
      else if (c.type === "punct") punctCount += 1;
      else if (c.type === "latin") latinCount += 1;
      else if (c.type === "digit") digitCount += 1;
      if (c.counted) {
        countedChars += 1;
        if (line.isTitle) titleCounted += 1;
        else bodyCounted += 1;
      }
    }
  }
  const { status, message } = judgeLined(countedChars, targetCount, rules);
  return {
    mode: "lined",
    totalChars,
    countedChars,
    titleCounted,
    bodyCounted,
    hanziCount,
    punctCount,
    latinCount,
    digitCount,
    paragraphCount,
    targetCount,
    status,
    message
  };
}
