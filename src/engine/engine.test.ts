import { describe, expect, it } from "vitest";
import { countLined, layoutEssayGrid, tokenize } from "./index";
import type { GridRules, LinedRules } from "./index";

const LINED_DEFAULT: LinedRules = {
  countTitle: true,
  countPunct: false,
  countLatin: false,
  countDigits: false,
  judgeMode: "strict",
  tolerance: 50
};

const lined = (over: Partial<LinedRules> = {}): LinedRules => ({ ...LINED_DEFAULT, ...over });

const GRID_DEFAULT: GridRules = {
  rows: 20,
  cols: 20,
  pages: 2,
  countTitle: true,
  showCellNumbers: true,
  showTargetMarker: true
};

const grid = (over: Partial<GridRules> = {}): GridRules => ({ ...GRID_DEFAULT, ...over });

const rep = (ch: string, n: number): string => ch.repeat(n);

describe("字符分类与切分", () => {
  it("破折号与省略号合并为占 2 格的单元", () => {
    const units = tokenize("甲——乙……丙");
    expect(units.map((u) => u.char)).toEqual(["甲", "——", "乙", "……", "丙"]);
    expect(units.map((u) => u.gridSpan)).toEqual([1, 2, 1, 2, 1]);
  });

  it("英文字母、数字、标点、空格分别归类", () => {
    const units = tokenize("a1， b");
    expect(units.map((u) => u.type)).toEqual(["latin", "digit", "punct", "space", "latin"]);
  });
});

describe("横线本统计", () => {
  it("用例1：单行纯汉字，全部计入，无标题", () => {
    const r = countLined(rep("字", 100), lined(), 100);
    expect(r.countedChars).toBe(100);
    expect(r.titleCounted).toBe(0);
    expect(r.paragraphCount).toBe(1);
    expect(r.status).toBe("qualified");
  });

  it("用例2：标题默认计入，可关闭", () => {
    const text = "我的标题\n" + rep("文", 50);
    const on = countLined(text, lined(), 60);
    expect(on.titleCounted).toBe(4);
    expect(on.countedChars).toBe(54);
    const off = countLined(text, lined({ countTitle: false }), 60);
    expect(off.titleCounted).toBe(0);
    expect(off.countedChars).toBe(50);
    expect(off.status).toBe("below");
  });

  it("用例3：标点默认不计，开启后计入", () => {
    const text = "你好，世界。";
    expect(countLined(text, lined(), 4).countedChars).toBe(4);
    expect(countLined(text, lined({ countPunct: true }), 6).countedChars).toBe(6);
  });

  it("用例4：英文数字默认不计，可分别开启", () => {
    const text = "Hello世界123";
    expect(countLined(text, lined(), 2).countedChars).toBe(2);
    expect(countLined(text, lined({ countLatin: true }), 7).countedChars).toBe(7);
    expect(countLined(text, lined({ countLatin: true, countDigits: true }), 10).countedChars).toBe(10);
  });

  it("用例5：缩进与换行永不计入", () => {
    const text = "  你好\n\n  世界  ";
    const r = countLined(text, lined(), 4);
    expect(r.countedChars).toBe(4);
    expect(r.totalChars).toBe(10); // 含空格，不含换行（4 + 0 + 6）
    expect(r.paragraphCount).toBe(2);
  });

  it("用例6：严格模式边界（低于/达标/超出提醒）", () => {
    expect(countLined(rep("字", 799), lined(), 800).status).toBe("below");
    expect(countLined(rep("字", 800), lined(), 800).status).toBe("qualified");
    expect(countLined(rep("字", 851), lined(), 800).status).toBe("overflow");
  });

  it("用例7：容差模式（目标 ±N）", () => {
    expect(countLined(rep("字", 749), lined({ judgeMode: "tolerance", tolerance: 50 }), 800).status).toBe("below");
    expect(countLined(rep("字", 750), lined({ judgeMode: "tolerance", tolerance: 50 }), 800).status).toBe("qualified");
    expect(countLined(rep("字", 850), lined({ judgeMode: "tolerance", tolerance: 50 }), 800).status).toBe("qualified");
    expect(countLined(rep("字", 851), lined({ judgeMode: "tolerance", tolerance: 50 }), 800).status).toBe("overflow");
  });

  it("用例8：目标为 0 视为配置不合理", () => {
    expect(countLined("你好", lined(), 0).status).toBe("invalidConfig");
  });
});

describe("作文本排版", () => {
  it("用例9：小网格精确排版（标题居中、缩进、换行、分页）", () => {
    const rules = grid({ rows: 5, cols: 5, pages: 1 });
    const layout = layoutEssayGrid("题目\n一二三四五六七八九十", rules, 10);
    // 标题 2 字居中于 5 列：floor((5-2)/2)=1
    expect(layout.pages[0].rows[0][1].char).toBe("题");
    expect(layout.pages[0].rows[0][2].char).toBe("目");
    expect(layout.pages[0].rows[0][1].isTitle).toBe(true);
    // 首行缩进 2 格
    expect(layout.pages[0].rows[1][0].type).toBe("indent");
    expect(layout.pages[0].rows[1][1].type).toBe("indent");
    // 第一行 3 字、第二行 5 字、第三行 2 字
    expect(layout.pages[0].rows[1][2].char).toBe("一");
    expect(layout.pages[0].rows[1][4].char).toBe("三");
    expect(layout.pages[0].rows[2][0].char).toBe("四");
    expect(layout.pages[0].rows[2][4].char).toBe("八");
    expect(layout.pages[0].rows[3][0].char).toBe("九");
    expect(layout.pages[0].rows[3][1].char).toBe("十");
    // 占格 = 标题 2 + 缩进 2 + 正文 10
    expect(layout.totalOccupied).toBe(14);
    expect(layout.countedOccupied).toBe(14);
    expect(layout.status).toBe("qualified");
    expect(layout.pagesUsed).toBe(1);
  });

  it("用例10：内容写满配置页数后溢出到新页", () => {
    const rules = grid({ rows: 3, cols: 5, pages: 1 });
    const layout = layoutEssayGrid("题目\n一二三四五六七八九十", rules, 10);
    expect(layout.pages.length).toBe(2);
    expect(layout.pages[1].beyondCapacity).toBe(true);
    expect(layout.pages[1].rows[0][0].char).toBe("九");
    expect(layout.pages[1].rows[0][1].char).toBe("十");
    expect(layout.totalOccupied).toBe(14);
    expect(layout.status).toBe("overflow");
    expect(layout.pagesUsed).toBe(2);
  });

  it("用例11：目标字数大于总容量 → 配置不合理", () => {
    const rules = grid({ rows: 2, cols: 5, pages: 1 }); // 容量 10
    const layout = layoutEssayGrid("题目\n一二三", rules, 20);
    expect(layout.status).toBe("invalidConfig");
    expect(layout.message).toContain("超出作文纸总容量");
  });

  it("用例12：字数不足时目标位置投影标记", () => {
    const rules = grid({ rows: 10, cols: 10, pages: 1 });
    const layout = layoutEssayGrid("题目\n一二三四五", rules, 20);
    const targetCells = layout.pages[0].rows.flat().filter((c) => c.isTarget);
    expect(targetCells.length).toBe(1);
    // 已占 9 格（标题2 + 缩进2 + 正文5），目标第 20 格为空格子上的投影标记
    expect(targetCells[0].occupiedNo).toBe(0);
    expect(layout.status).toBe("below");
    expect(layout.message).toContain("还差 11 格");
  });

  it("用例13：标点始终占格；破折号/省略号占 2 格；英文数字各占 1 格", () => {
    const rules = grid({ rows: 5, cols: 20, pages: 1 });
    const layout = layoutEssayGrid("你，好。abc12", rules, 20);
    // 4 汉字标点占格 + 5 英文数字 + 缩进 2
    expect(layout.totalOccupied).toBe(11);
    const dash = layoutEssayGrid("甲——乙", grid({ rows: 2, cols: 10, pages: 1 }), 10);
    // 缩进 2 + 甲 1 + 破折号 2 + 乙 1
    expect(dash.totalOccupied).toBe(6);
    expect(dash.pages[0].rows.flat().some((c) => c.char === "——" && c.span === 2)).toBe(true);
  });

  it("用例14：标题占格可配置为不计入目标", () => {
    const rules = grid({ rows: 5, cols: 10, pages: 1, countTitle: false });
    const layout = layoutEssayGrid("题目\n一二三四五", rules, 8);
    expect(layout.totalOccupied).toBe(9); // 标题2 + 缩进2 + 正文5
    expect(layout.countedOccupied).toBe(7); // 去掉标题
    expect(layout.status).toBe("below");
  });

  it("用例15：每 200 格编号数据（occupiedNo 连续性）", () => {
    const rules = grid({ rows: 10, cols: 25, pages: 1 });
    const layout = layoutEssayGrid(rep("字", 240), rules, 250);
    const all = layout.pages[0].rows.flat().filter((c) => c.occupiedNo > 0);
    expect(all.length).toBe(242); // 缩进 2 + 240 正文
    expect(all.some((c) => c.occupiedNo === 200)).toBe(true);
    expect(all[all.length - 1].occupiedNo).toBe(242);
    expect(layout.status).toBe("below");
  });

  it("用例16：标准 800 字作文纸容量与合格判定", () => {
    const rules = grid({ rows: 20, cols: 20, pages: 2 }); // 容量 800
    // 单段 798 字 + 首行缩进 2 = 800 格，恰好写满 2 页
    const ok = layoutEssayGrid(rep("文", 798), rules, 800);
    expect(ok.totalOccupied).toBe(800);
    expect(ok.pagesUsed).toBe(2);
    expect(ok.status).toBe("qualified");
    // 再多 2 字即超出作文纸
    const over = layoutEssayGrid(rep("文", 800), rules, 800);
    expect(over.totalOccupied).toBe(802);
    expect(over.status).toBe("overflow");
  });
});
