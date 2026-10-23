import type { CharType, TextUnit } from "./types";

const HANZI_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3007]/;
const LATIN_RE = /[A-Za-z\u00c0-\u024f]/;
const DIGIT_RE = /[0-9\uff10-\uff19]/;
const SPACE_RE = /[ \t\u3000\u00a0]/;

/** 中文标点 + 常用半角标点 */
const PUNCT_SET = new Set(
  Array.from(
    "\u2018\u2019\u201c\u201d\u2014\u2026\u00b7\u2013\u301c\uff5e\u3001\u3002" +
      "\u3008\u3009\u300a\u300b\u300c\u300d\u300e\u300f\u3010\u3011" +
      "\uff08\uff09\uff3b\uff3d\uff5b\uff5d\uff0d\uff3c\uffe5\u3005" +
      "\u301d\u301f,.;:!?()[]{}'\"-~/"
  )
);

export const DASH = "\u2014";
export const ELLIPSIS = "\u2026";

export function classifyChar(ch: string): CharType {
  if (ch === "\n" || ch === "\r") return "newline";
  if (SPACE_RE.test(ch)) return "space";
  if (HANZI_RE.test(ch)) return "hanzi";
  if (PUNCT_SET.has(ch)) return "punct";
  if (LATIN_RE.test(ch)) return "latin";
  if (DIGIT_RE.test(ch)) return "digit";
  // 未识别字符（如 emoji）按标点处理：占 1 格
  return "punct";
}

/** 把文本切成字符单元；连续的破折号/省略号合并为占 2 格的单元 */
export function tokenize(text: string): TextUnit[] {
  const chars = Array.from(text.replace(/\r\n?/g, "\n"));
  const units: TextUnit[] = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    const next = chars[i + 1];
    if ((ch === DASH || ch === ELLIPSIS) && next === ch) {
      units.push({ char: ch + next, type: "punct", gridSpan: 2, countable: true });
      i += 2;
      continue;
    }
    const type = classifyChar(ch);
    units.push({
      char: ch,
      type,
      gridSpan: type === "space" || type === "newline" ? 0 : 1,
      countable: type !== "space" && type !== "newline"
    });
    i += 1;
  }
  return units;
}

export function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

export function firstNonEmptyLine(lines: string[]): number {
  return lines.findIndex((l) => l.trim().length > 0);
}

/** 至少两个非空行时才把第一行判定为标题（单行输入视为正文） */
export function hasTitleLine(lines: string[]): boolean {
  return lines.filter((l) => l.trim().length > 0).length >= 2;
}
