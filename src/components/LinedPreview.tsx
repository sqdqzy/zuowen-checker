import type { LinedRules } from "../engine";
import { annotateLined } from "../engine";

const TYPE_LABEL: Record<string, string> = {
  hanzi: "汉字",
  punct: "标点",
  latin: "英文",
  digit: "数字",
  space: "空格",
  newline: "换行"
};

export function LinedPreview({ text, rules }: { text: string; rules: LinedRules }) {
  const lines = annotateLined(text, rules);
  return (
    <div className="lined-preview">
      <div className="grid-legend">
        <span className="ch ch-on">计入</span>
        <span className="ch ch-off">不计入</span>
        <span className="legend-note">按当前统计规则逐字标注</span>
      </div>
      {lines.map((line, i) => (
        <div key={i} className={line.isTitle ? "lined-line is-title" : "lined-line"}>
          {line.isTitle && <span className="lined-tag">标题</span>}
          {line.chars.length === 0 && <span className="ch ch-off">&#160;</span>}
          {line.chars.map((c, j) => (
            <span key={j} className={c.counted ? "ch ch-on" : "ch ch-off"} title={TYPE_LABEL[c.type]}>
              {c.ch === " " ? "\u00a0" : c.ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
