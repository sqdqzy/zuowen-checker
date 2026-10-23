import { firstNonEmptyLine, hasTitleLine, splitLines, tokenize } from "./textUnits";
import type { CharType, CountStatus, GridCell, GridLayout, GridPageData, GridRules, TextUnit } from "./types";

type CellType = CharType | "empty" | "indent";

function emptyCell(): GridCell {
  return { char: "", span: 0, type: "empty", occupiedNo: 0, isTarget: false, isOver: false, isTitle: false };
}

function newRow(cols: number): GridCell[] {
  const row: GridCell[] = [];
  for (let c = 0; c < cols; c++) row.push(emptyCell());
  return row;
}

function newPage(pageIndex: number, rules: GridRules): GridPageData {
  const rows: GridCell[][] = [];
  for (let r = 0; r < rules.rows; r++) rows.push(newRow(rules.cols));
  return { pageIndex, rows, beyondCapacity: false };
}

/**
 * 作文本排版引擎：文本 → 占格数组 → 分页格子矩阵 → 状态判断。
 * 占格规则（MVP）：汉字 1 格；标点 1 格；破折号/省略号 2 格；
 * 英文数字每字符 1 格；空格不占格；每段首行缩进 2 格且计入占格；
 * 标题独占一行居中，占格默认计入目标。
 */
export function layoutEssayGrid(text: string, rules: GridRules, targetCount: number): GridLayout {
  const capacity = rules.rows * rules.cols * rules.pages;
  const invalidTarget = !(targetCount > 0) || targetCount > capacity;

  const lines = splitLines(text);
  const firstIdx = firstNonEmptyLine(lines);
  const withTitle = hasTitleLine(lines);

  const titleUnits: TextUnit[] =
    withTitle && firstIdx >= 0 ? tokenize(lines[firstIdx]).filter((u) => u.gridSpan > 0) : [];
  const paragraphs: TextUnit[][] = [];
  for (let i = 0; i < lines.length; i++) {
    if (withTitle && i === firstIdx) continue;
    if (lines[i].trim().length === 0) continue;
    paragraphs.push(tokenize(lines[i]).filter((u) => u.gridSpan > 0));
  }

  const pages: GridPageData[] = [newPage(0, rules)];
  let page = 0;
  let row = 0;
  let col = 0;
  let occupied = 0;
  let titleOccupied = 0;
  let indentOccupied = 0;
  let hanziOccupied = 0;
  let punctOccupied = 0;
  let latinDigitOccupied = 0;
  let maxPageUsed = 0;
  let targetMarked = false;

  const ensurePage = (p: number): void => {
    while (pages.length <= p) pages.push(newPage(pages.length, rules));
  };
  const ensureRow = (p: number, r: number): void => {
    ensurePage(p);
    while (pages[p].rows.length <= r) pages[p].rows.push(newRow(rules.cols));
  };
  const advanceLine = (): void => {
    col = 0;
    row += 1;
    if (row >= rules.rows) {
      row = 0;
      page += 1;
    }
  };

  const place = (char: string, span: number, type: CellType, isTitle: boolean): void => {
    if (col + span > rules.cols) advanceLine();
    if (page > maxPageUsed) maxPageUsed = page;
    for (let k = 0; k < span; k++) {
      occupied += 1;
      ensureRow(page, row);
      const cell = pages[page].rows[row][col + k];
      cell.char = k === 0 ? char : "";
      cell.span = span;
      cell.type = type;
      cell.occupiedNo = occupied;
      cell.isTitle = isTitle;
      if (!invalidTarget && occupied === targetCount) {
        cell.isTarget = true;
        targetMarked = true;
      }
      if (isTitle) titleOccupied += 1;
      else if (type === "hanzi") hanziOccupied += 1;
      else if (type === "punct") punctOccupied += 1;
      else if (type === "latin" || type === "digit") latinDigitOccupied += 1;
      else if (type === "indent") indentOccupied += 1;
    }
    col += span;
  };

  // 标题居中
  if (titleUnits.length > 0) {
    const titleSpan = titleUnits.reduce((sum, u) => sum + u.gridSpan, 0);
    col = titleSpan <= rules.cols ? Math.floor((rules.cols - titleSpan) / 2) : 0;
    for (const u of titleUnits) place(u.char, u.gridSpan, u.type, true);
    advanceLine();
  }

  // 正文段落（首行缩进 2 格）
  const indentWidth = Math.min(2, rules.cols);
  for (const para of paragraphs) {
    place("", indentWidth, "indent", false);
    for (const u of para) place(u.char, u.gridSpan, u.type, false);
    advanceLine();
  }

  // 内容不足目标时，沿书写流向投影出目标位置并标记
  if (!invalidTarget && !targetMarked) {
    let steps = targetCount - occupied - 1;
    let p = page;
    let r = row;
    let c = col;
    while (steps > 0) {
      c += 1;
      if (c >= rules.cols) {
        c = 0;
        r += 1;
        if (r >= rules.rows) {
          r = 0;
          p += 1;
        }
      }
      steps -= 1;
    }
    ensureRow(p, r);
    if (c < rules.cols) {
      pages[p].rows[r][c].isTarget = true;
      targetMarked = true;
    }
  }

  // 超出目标的占格标记为超额区
  if (!invalidTarget && targetCount > 0) {
    for (const pg of pages) {
      for (const r of pg.rows) {
        for (const cell of r) {
          if (cell.occupiedNo > targetCount) cell.isOver = true;
        }
      }
    }
  }

  // 补足配置页数（空白作文纸）
  while (pages.length < rules.pages) pages.push(newPage(pages.length, rules));
  pages.forEach((p, i) => {
    p.beyondCapacity = i >= rules.pages;
  });

  const totalOccupied = occupied;
  const countedOccupied = rules.countTitle ? totalOccupied : totalOccupied - titleOccupied;
  const pagesUsed = Math.max(maxPageUsed + 1, pages.length > rules.pages ? rules.pages : maxPageUsed + 1);

  let status: CountStatus;
  let message: string;
  if (invalidTarget) {
    status = "invalidConfig";
    message = `配置不合理：目标字数 ${targetCount} 格超出作文纸总容量 ${capacity} 格（${rules.pages} 页 × ${rules.rows} 行 × ${rules.cols} 列），请增加页数或调整行列。`;
  } else if (pagesUsed > rules.pages || totalOccupied > capacity) {
    status = "overflow";
    message = `超出作文纸：当前占格 ${totalOccupied} 格，已写满 ${pagesUsed} 页，超过配置的 ${rules.pages} 页（总容量 ${capacity} 格）。`;
  } else if (countedOccupied < targetCount) {
    status = "below";
    message = `字数不达标：当前占格 ${countedOccupied} 格，目标 ${targetCount} 格，还差 ${targetCount - countedOccupied} 格。`;
  } else {
    status = "qualified";
    message = `合格：当前占格 ${countedOccupied} 格，达到目标 ${targetCount} 格（总容量 ${capacity} 格）。`;
  }

  return {
    mode: "essayGrid",
    pages,
    totalOccupied,
    countedOccupied,
    titleOccupied,
    indentOccupied,
    hanziOccupied,
    punctOccupied,
    latinDigitOccupied,
    capacity,
    pagesUsed,
    targetCount,
    status,
    message
  };
}
