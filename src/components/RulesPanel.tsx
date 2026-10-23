import { useEffect, useState } from "react";
import type { CountMode, GridRules, LinedRules } from "../engine";

interface Props {
  countMode: CountMode;
  onCountModeChange: (m: CountMode) => void;
  targetCount: number;
  onTargetChange: (n: number) => void;
  lined: LinedRules;
  onLinedChange: (r: LinedRules) => void;
  grid: GridRules;
  onGridChange: (r: GridRules) => void;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 数字输入框：输入过程中保留原始文本（可自由删改），失焦时才 clamp 到合法范围 */
function NumberField({
  label, value, min, max, onChange, suffix
}: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  // 非编辑状态下，外部值变化时同步显示
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      // 空输入：恢复原值，不吞掉用户config
      setDraft(String(value));
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const fixed = clamp(Math.round(n), min, max);
    onChange(fixed);
    setDraft(String(fixed));
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^\d*$/.test(raw)) return; // 只允许纯数字
          setDraft(raw);
          if (raw.trim() !== "") {
            // 合法数字立即提交（clamp 后同步外部状态），空串则保留等待失焦
            onChange(clamp(Math.round(Number(raw)), min, max));
          }
        }}
        onBlur={() => commitDraft(draft)}
      />
      {suffix && <span className="field-suffix">{suffix}</span>}
    </label>
  );
}

function Check({
  label, checked, onChange, hint
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <label className="check" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function RulesPanel(props: Props) {
  const { countMode, onCountModeChange, targetCount, onTargetChange, lined, onLinedChange, grid, onGridChange } = props;
  const capacity = grid.rows * grid.cols * grid.pages;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>统计模式与规则</h2>
      </div>

      <div className="segmented" role="tablist" aria-label="统计模式">
        <button
          role="tab"
          aria-selected={countMode === "essayGrid"}
          className={countMode === "essayGrid" ? "seg active" : "seg"}
          onClick={() => onCountModeChange("essayGrid")}
        >
          作文本
        </button>
        <button
          role="tab"
          aria-selected={countMode === "lined"}
          className={countMode === "lined" ? "seg active" : "seg"}
          onClick={() => onCountModeChange("lined")}
        >
          横线本
        </button>
      </div>
      <p className="hint">
        {countMode === "essayGrid"
          ? "按格子占格统计：标点占格、每段缩进 2 格计入，支持分页渲染。"
          : "按行统计字数：可配置标题、标点、英文数字是否计入。"}
      </p>

      <NumberField label="目标字数" value={targetCount} min={1} max={9999} onChange={onTargetChange} suffix="字" />

      {countMode === "lined" ? (
        <div className="rule-form">
          <Check label="计入标题" checked={lined.countTitle} onChange={(v) => onLinedChange({ ...lined, countTitle: v })} hint="第一个非空行视为标题" />
          <Check label="计入标点" checked={lined.countPunct} onChange={(v) => onLinedChange({ ...lined, countPunct: v })} />
          <Check label="计入英文" checked={lined.countLatin} onChange={(v) => onLinedChange({ ...lined, countLatin: v })} />
          <Check label="计入数字" checked={lined.countDigits} onChange={(v) => onLinedChange({ ...lined, countDigits: v })} />
          <div className="rule-row">
            <label className="field">
              <span className="field-label">判定模式</span>
              <select value={lined.judgeMode} onChange={(e) => onLinedChange({ ...lined, judgeMode: e.target.value as "strict" | "tolerance" })}>
                <option value="strict">严格（达到目标即合格）</option>
                <option value="tolerance">容差（目标 ±N 合格）</option>
              </select>
            </label>
            <NumberField
              label={lined.judgeMode === "tolerance" ? "容差 N" : "超出提醒阈值"}
              value={lined.tolerance}
              min={0}
              max={500}
              onChange={(v) => onLinedChange({ ...lined, tolerance: v })}
              suffix="字"
            />
          </div>
          <p className="hint">缩进与换行在任何规则下均不计入。</p>
        </div>
      ) : (
        <div className="rule-form">
          <div className="rule-row">
            <NumberField label="每页行数" value={grid.rows} min={5} max={40} onChange={(v) => onGridChange({ ...grid, rows: v })} suffix="行" />
            <NumberField label="每行列数" value={grid.cols} min={8} max={40} onChange={(v) => onGridChange({ ...grid, cols: v })} suffix="列" />
          </div>
          <div className="rule-row">
            <NumberField label="页数" value={grid.pages} min={1} max={20} onChange={(v) => onGridChange({ ...grid, pages: v })} suffix="页" />
            <div className="capacity-chip">总容量 {capacity} 格</div>
          </div>
          <Check label="标题占格计入目标" checked={grid.countTitle} onChange={(v) => onGridChange({ ...grid, countTitle: v })} />
          <Check label="每 200 格编号" checked={grid.showCellNumbers} onChange={(v) => onGridChange({ ...grid, showCellNumbers: v })} />
          <Check label="目标字数标记" checked={grid.showTargetMarker} onChange={(v) => onGridChange({ ...grid, showTargetMarker: v })} />
          <p className="hint">占格规则：汉字/标点 1 格，破折号与省略号 2 格，英文数字每字符 1 格，每段首行缩进 2 格计入。</p>
        </div>
      )}
    </section>
  );
}
