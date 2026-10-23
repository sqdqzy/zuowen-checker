interface Props {
  text: string;
  onTextChange: (t: string) => void;
  onLoadSample: () => void;
}

export function ManualPanel({ text, onTextChange, onLoadSample }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>作文原文</h2>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={onLoadSample}>载入示例</button>
          <button className="btn btn-ghost" onClick={() => onTextChange("")}>清空</button>
        </div>
      </div>
      <textarea
        className="essay-input"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={"在此粘贴或输入作文原文。\n第一行默认为标题（全文至少两个非空行时生效），正文每空一行分段。"}
        spellCheck={false}
      />
      <p className="hint">统计实时生效：修改文字或左侧规则，结果与预览会立即更新。</p>
    </section>
  );
}
