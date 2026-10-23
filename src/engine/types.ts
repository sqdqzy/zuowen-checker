export type CharType = "hanzi" | "punct" | "latin" | "digit" | "space" | "newline";

export interface TextUnit {
  char: string;
  type: CharType;
  /** 作文本模式下的占格数（空格/换行为 0） */
  gridSpan: number;
  /** 该字符类型是否可能被计入字数（空格/换行恒为 false） */
  countable: boolean;
}

export type CountMode = "lined" | "essayGrid";
export type CountStatus = "below" | "qualified" | "overflow" | "invalidConfig";

export interface LinedRules {
  /** 是否计入标题（第一个非空行） */
  countTitle: boolean;
  /** 是否计入标点 */
  countPunct: boolean;
  /** 是否计入英文字母 */
  countLatin: boolean;
  /** 是否计入数字 */
  countDigits: boolean;
  /** 严格模式：达到目标即合格；容差模式：目标 ±N 内合格 */
  judgeMode: "strict" | "tolerance";
  /** 容差 N（严格模式下作为"超出提醒"阈值） */
  tolerance: number;
}

export interface GridRules {
  /** 每页行数 */
  rows: number;
  /** 每行列数 */
  cols: number;
  /** 页数 */
  pages: number;
  /** 是否将标题占格计入目标 */
  countTitle: boolean;
  /** 是否显示每 200 格编号 */
  showCellNumbers: boolean;
  /** 是否显示目标字数标记 */
  showTargetMarker: boolean;
}

export interface LinedResult {
  mode: "lined";
  /** 不含换行符的总字符数 */
  totalChars: number;
  countedChars: number;
  titleCounted: number;
  bodyCounted: number;
  hanziCount: number;
  punctCount: number;
  latinCount: number;
  digitCount: number;
  paragraphCount: number;
  targetCount: number;
  status: CountStatus;
  message: string;
}

export interface GridCell {
  /** 单元格文字（占格单元的首字符；破折号/省略号为双字符） */
  char: string;
  /** 该文字跨越的格数（1 或 2） */
  span: number;
  type: CharType | "empty" | "indent";
  /** 第几个被占用的格子（0 表示空格子） */
  occupiedNo: number;
  isTarget: boolean;
  isOver: boolean;
  isTitle: boolean;
}

export interface GridPageData {
  pageIndex: number;
  rows: GridCell[][];
  /** 是否超出配置页数 */
  beyondCapacity: boolean;
}

export interface GridLayout {
  mode: "essayGrid";
  pages: GridPageData[];
  /** 物理占格总数（含标题与缩进） */
  totalOccupied: number;
  /** 计入目标的占格数 */
  countedOccupied: number;
  titleOccupied: number;
  indentOccupied: number;
  hanziOccupied: number;
  punctOccupied: number;
  latinDigitOccupied: number;
  capacity: number;
  /** 实际写到的最大页数（从 1 计） */
  pagesUsed: number;
  targetCount: number;
  status: CountStatus;
  message: string;
}
