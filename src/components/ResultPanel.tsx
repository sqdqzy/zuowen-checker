import type { CountStatus, GridLayout, LinedResult } from "../engine";

const STATUS_LABEL: Record<CountStatus, string> = {
  below: "不达标",
  qualified: "合格",
  overflow: "超出",
  invalidConfig: "配置不合理"
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function ResultPanel({ result }: { result: LinedResult | GridLayout }) {
  const pct =
    result.status === "invalidConfig"
      ? 0
      : Math.min(100, Math.round((result.mode === "lined" ? result.countedChars : result.countedOccupied) / result.targetCount * 100));

  return (
    <section className="panel result-panel">
      <div className="panel-head">
        <h2>统计结果</h2>
        <span className={`badge badge-${result.status}`}>{STATUS_LABEL[result.status]}</span>
      </div>
      <p className={`result-message msg-${result.status}`}>{result.message}</p>

      <div className="progress">
        <div className={`progress-bar bar-${result.status}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-text">
        {result.mode === "lined"
          ? `${result.countedChars} / ${result.targetCount} 字（${pct}%）`
          : `${result.countedOccupied} / ${result.targetCount} 格（${pct}%）`}
      </div>

      {result.mode === "lined" ? (
        <div className="stat-grid">
          <Stat label="计入字数" value={result.countedChars} hint={`目标 ${result.targetCount} 字`} />
          <Stat label="总字符" value={result.totalChars} hint="不含换行符" />
          <Stat label="标题计入" value={result.titleCounted} />
          <Stat label="正文计入" value={result.bodyCounted} />
          <Stat label="汉字" value={result.hanziCount} />
          <Stat label="标点" value={result.punctCount} hint={result.punctCount > 0 ? "当前不计入" : undefined} />
          <Stat label="英文" value={result.latinCount} />
          <Stat label="数字" value={result.digitCount} />
          <Stat label="段落数" value={result.paragraphCount} />
        </div>
      ) : (
        <div className="stat-grid">
          <Stat label="计入占格" value={result.countedOccupied} hint={`目标 ${result.targetCount} 格`} />
          <Stat label="物理占格" value={result.totalOccupied} hint="含标题与缩进" />
          <Stat label="标题占格" value={result.titleOccupied} />
          <Stat label="正文汉字" value={result.hanziOccupied} />
          <Stat label="标点占格" value={result.punctOccupied} />
          <Stat label="英文数字" value={result.latinDigitOccupied} />
          <Stat label="缩进占格" value={result.indentOccupied} hint="每段 2 格" />
          <Stat label="总容量" value={result.capacity} hint={`已用 ${result.pagesUsed} 页`} />
        </div>
      )}
    </section>
  );
}
