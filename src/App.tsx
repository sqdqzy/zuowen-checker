import { useCallback, useEffect, useMemo, useState } from "react";
import { countLined, layoutEssayGrid } from "./engine";
import type { CountMode, GridRules, LinedRules } from "./engine";
import { AiPanel } from "./components/AiPanel";
import { GridPreview } from "./components/GridPreview";
import { LinedPreview } from "./components/LinedPreview";
import { ManualPanel } from "./components/ManualPanel";
import { ResultPanel } from "./components/ResultPanel";
import { RulesPanel } from "./components/RulesPanel";
import { loadJSON, saveJSON } from "./storage";
import { SAMPLE_TEXT } from "./sampleText";
import type { AiConfig } from "./ai/types";

type AppMode = "manual" | "ai";

const DEFAULT_LINED: LinedRules = {
  countTitle: true,
  countPunct: false,
  countLatin: false,
  countDigits: false,
  judgeMode: "strict",
  tolerance: 50
};

const DEFAULT_GRID: GridRules = {
  rows: 20,
  cols: 20,
  pages: 2,
  countTitle: true,
  showCellNumbers: true,
  showTargetMarker: true
};

interface SavedRules {
  countMode: CountMode;
  targetCount: number;
  lined: LinedRules;
  grid: GridRules;
}

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>("manual");
  const savedRules = useMemo(
    () => loadJSON<SavedRules>("rules", { countMode: "essayGrid", targetCount: 800, lined: DEFAULT_LINED, grid: DEFAULT_GRID }),
    []
  );
  const [countMode, setCountMode] = useState<CountMode>(savedRules.countMode);
  const [targetCount, setTargetCount] = useState(savedRules.targetCount);
  const [lined, setLined] = useState<LinedRules>({ ...DEFAULT_LINED, ...savedRules.lined });
  const [grid, setGrid] = useState<GridRules>({ ...DEFAULT_GRID, ...savedRules.grid });
  const [text, setText] = useState(SAMPLE_TEXT);
  const [aiCfg, setAiCfg] = useState<AiConfig>(
    () => loadJSON<AiConfig>("aiConfig", { baseUrl: "", apiKey: "", model: "" })
  );

  useEffect(() => saveJSON("aiConfig", aiCfg), [aiCfg]);
  useEffect(() => saveJSON("rules", { countMode, targetCount, lined, grid }), [countMode, targetCount, lined, grid]);

  const result = useMemo(
    () => (countMode === "lined" ? countLined(text, lined, targetCount) : layoutEssayGrid(text, grid, targetCount)),
    [text, countMode, lined, grid, targetCount]
  );

  const handleAdopt = useCallback((t: string) => {
    setText(t);
    setAppMode("manual");
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>作文工坊</h1>
          <p>作文字数校验与 AI 生成 · 横线本 / 作文本双引擎</p>
        </div>
        <nav className="tabs" aria-label="模式">
          <button className={appMode === "manual" ? "tab active" : "tab"} onClick={() => setAppMode("manual")}>
            手动校验
          </button>
          <button className={appMode === "ai" ? "tab active" : "tab"} onClick={() => setAppMode("ai")}>
            AI 生成
          </button>
        </nav>
      </header>

      <main className="layout">
        <div className="col col-left">
          <RulesPanel
            countMode={countMode}
            onCountModeChange={setCountMode}
            targetCount={targetCount}
            onTargetChange={setTargetCount}
            lined={lined}
            onLinedChange={setLined}
            grid={grid}
            onGridChange={setGrid}
          />
          {appMode === "manual" ? (
            <ManualPanel text={text} onTextChange={setText} onLoadSample={() => setText(SAMPLE_TEXT)} />
          ) : (
            <AiPanel
              aiCfg={aiCfg}
              onAiCfgChange={setAiCfg}
              countMode={countMode}
              lined={lined}
              grid={grid}
              targetCount={targetCount}
              onText={setText}
              onAdopt={handleAdopt}
            />
          )}
        </div>
        <div className="col col-right">
          <ResultPanel result={result} />
          <section className="panel">
            <div className="panel-head">
              <h2>{result.mode === "essayGrid" ? "作文格预览" : "横线本预览"}</h2>
            </div>
            {result.mode === "essayGrid" ? (
              <GridPreview layout={result} rules={grid} />
            ) : (
              <LinedPreview text={text} rules={lined} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
