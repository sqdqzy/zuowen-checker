import { useEffect, useState } from "react";
import { countLined, layoutEssayGrid } from "../engine";
import type { CountMode, CountStatus, GridRules, LinedRules } from "../engine";
import { AiError, chat, fetchModels } from "../ai/client";
import { SYSTEM_PROMPT, buildBodyPrompt, buildOutlinePrompt, buildRevisionPrompt } from "../ai/prompts";
import { buildRevisionFeedback, resultCount } from "../ai/feedback";
import type { AiConfig, HistoryEntry } from "../ai/types";
import { loadJSON, saveJSON } from "../storage";

interface Props {
  aiCfg: AiConfig;
  onAiCfgChange: (cfg: AiConfig) => void;
  countMode: CountMode;
  lined: LinedRules;
  grid: GridRules;
  targetCount: number;
  /** 生成 / 修订过程中实时更新共享文本 */
  onText: (t: string) => void;
  /** 采用最终稿：写入文本并切回手动校验 */
  onAdopt: (text: string) => void;
}

interface RevisionRecord {
  round: number;
  label: string;
  before: number;
  after: number;
  tokens: number;
}

type Phase = "idle" | "outline" | "body" | "revise" | "done" | "error";

const MAX_REVISIONS = 3;
const STAGNANT_THRESHOLD = 5;

const PHASE_STEPS: { key: Phase; label: string }[] = [
  { key: "outline", label: "生成大纲" },
  { key: "body", label: "生成正文" },
  { key: "revise", label: "校验与自动修订" },
  { key: "done", label: "完成" }
];

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AiPanel({ aiCfg, onAiCfgChange, countMode, lined, grid, targetCount, onText, onAdopt }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [topic, setTopic] = useState("");
  const [requirements, setRequirements] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [outline, setOutline] = useState("");
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
  const [tokensTotal, setTokensTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [truncatedWarn, setTruncatedWarn] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadJSON<HistoryEntry[]>("history", []));

  useEffect(() => {
    saveJSON("history", history);
  }, [history]);

  const validate = (t: string) =>
    countMode === "lined" ? countLined(t, lined, targetCount) : layoutEssayGrid(t, grid, targetCount);

  const addTokens = (n: number) => setTokensTotal((prev) => prev + n);

  async function handleFetchModels() {
    setModelsLoading(true);
    setModelsError("");
    try {
      const ids = await fetchModels(aiCfg);
      setModels(ids);
      if (ids.length === 0) {
        setModelsError("未获取到模型列表，请手动填写模型名称。");
      } else if (!aiCfg.model.trim()) {
        onAiCfgChange({ ...aiCfg, model: ids[0] });
      }
    } catch (e) {
      setModelsError((e as Error).message + "（可手动填写模型名称）");
    } finally {
      setModelsLoading(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setError("");
    setTruncatedWarn(false);
    setOutline("");
    setRevisions([]);
    setTokensTotal(0);
    try {
      if (!aiCfg.baseUrl.trim()) throw new AiError("请先填写 API Base URL。");
      if (!aiCfg.model.trim()) throw new AiError("请先获取或填写模型名称。");
      if (!topic.trim()) throw new AiError("请输入作文题目。");

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "" }
      ];

      // 1. 大纲
      setPhase("outline");
      messages[1] = { role: "user", content: buildOutlinePrompt(topic, requirements, targetCount) };
      const outlineRes = await chat(aiCfg, messages, { maxTokens: 1500 });
      addTokens(outlineRes.totalTokens);
      setOutline(outlineRes.content);

      // 2. 正文
      setPhase("body");
      messages[1] = {
        role: "user",
        content: buildBodyPrompt(topic, requirements, targetCount, outlineRes.content, countMode, lined)
      };
      const bodyRes = await chat(aiCfg, messages, { maxTokens: 8192 });
      addTokens(bodyRes.totalTokens);
      if (bodyRes.truncated) setTruncatedWarn(true);

      let currentText = bodyRes.content;
      onText(currentText);
      let result = validate(currentText);
      const records: RevisionRecord[] = [
        { round: 0, label: "初稿", before: 0, after: resultCount(result), tokens: bodyRes.totalTokens }
      ];
      setRevisions([...records]);

      // 3. 校验 + 自动修订闭环（最多 3 次）
      let round = 0;
      const changes: number[] = [];
      while (result.status !== "qualified" && result.status !== "invalidConfig" && round < MAX_REVISIONS) {
        if (
          changes.length >= 2 &&
          Math.abs(changes[changes.length - 1]) < STAGNANT_THRESHOLD &&
          Math.abs(changes[changes.length - 2]) < STAGNANT_THRESHOLD
        ) {
          break; // 连续两次变化过小，停止以防死循环
        }
        round += 1;
        setPhase("revise");
        const feedback = buildRevisionFeedback(result, countMode, lined, targetCount);
        messages[1] = { role: "user", content: buildRevisionPrompt(currentText, feedback) };
        const revRes = await chat(aiCfg, messages, { maxTokens: 8192 });
        addTokens(revRes.totalTokens);
        if (revRes.truncated) setTruncatedWarn(true);
        const before = resultCount(result);
        currentText = revRes.content;
        onText(currentText);
        result = validate(currentText);
        const after = resultCount(result);
        changes.push(after - before);
        records.push({
          round,
          label: `第 ${round} 次修订`,
          before,
          after,
          tokens: revRes.totalTokens
        });
        setRevisions([...records]);
      }

      setPhase("done");
      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        ts: Date.now(),
        topic: topic.trim(),
        target: targetCount,
        mode: countMode,
        finalCount: resultCount(result),
        status: result.status as CountStatus,
        rounds: round,
        tokens: tokensTotal + bodyRes.totalTokens + records.slice(1).reduce((s, r) => s + r.tokens, 0),
        text: currentText,
        adopted: false
      };
      setHistory((prev) => [entry, ...prev].slice(0, 20));
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  function handleAdoptFinal() {
    const last = history[0];
    if (last && !last.adopted) {
      setHistory((prev) => prev.map((h, i) => (i === 0 ? { ...h, adopted: true } : h)));
    }
    onAdopt(history[0]?.text ?? "");
  }

  function handleRestore(entry: HistoryEntry) {
    onAdopt(entry.text);
  }

  const phaseIndex = PHASE_STEPS.findIndex((s) => s.key === phase);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>AI 生成作文</h2>
        {tokensTotal > 0 && <span className="token-chip">本次消耗 token：{tokensTotal}</span>}
      </div>

      <div className="api-config">
        <label className="field">
          <span className="field-label">API Base URL</span>
          <input
            type="text"
            value={aiCfg.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => onAiCfgChange({ ...aiCfg, baseUrl: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">API Key</span>
          <input
            type="password"
            value={aiCfg.apiKey}
            placeholder="sk-..."
            onChange={(e) => onAiCfgChange({ ...aiCfg, apiKey: e.target.value })}
          />
        </label>
        <div className="rule-row">
          <label className="field grow">
            <span className="field-label">模型</span>
            <input
              type="text"
              list="model-suggestions"
              value={aiCfg.model}
              placeholder="可手动填写，如 glm-4.7-flash / deepseek-chat"
              onChange={(e) => onAiCfgChange({ ...aiCfg, model: e.target.value })}
            />
            <datalist id="model-suggestions">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <button className="btn" onClick={handleFetchModels} disabled={modelsLoading || busy}>
            {modelsLoading ? "获取中…" : "获取模型列表"}
          </button>
        </div>
        {modelsError && <p className="warn-text">{modelsError}</p>}
        <p className="risk-note">
          安全提示：API Key 仅保存在本浏览器的 localStorage，不会上传到任何服务器。纯网页版直连 API 仍存在 Key
          暴露风险，请勿在公用电脑上保存 Key；生产环境建议改用桌面端或本地代理。
        </p>
      </div>

      <label className="field">
        <span className="field-label">作文题目</span>
        <input type="text" value={topic} placeholder="例如：那一次，我长大了" onChange={(e) => setTopic(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">写作要求（可选）</span>
        <textarea
          className="essay-input short"
          value={requirements}
          placeholder="例如：记叙文，有细节描写，不少于 800 字，感情真挚"
          onChange={(e) => setRequirements(e.target.value)}
        />
      </label>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleGenerate} disabled={busy}>
          {busy ? "生成中…" : "生成大纲与正文"}
        </button>
        <span className="hint">目标 {targetCount} 字 · {countMode === "lined" ? "横线本" : "作文本"}模式</span>
      </div>

      {(phase !== "idle" || error) && (
        <div className="ai-progress">
          <ol className="steps">
            {PHASE_STEPS.map((s, i) => (
              <li
                key={s.key}
                className={
                  phase === "error" && i === phaseIndex
                    ? "step is-error"
                    : i < phaseIndex || phase === "done"
                      ? "step is-done"
                      : i === phaseIndex && busy
                        ? "step is-active"
                        : "step"
                }
              >
                {s.label}
              </li>
            ))}
          </ol>
          {error && <p className="error-text">{error}</p>}
          {truncatedWarn && !error && (
            <p className="warn-text">
              注意：AI 输出达到长度上限被截断，内容可能不完整。可减少目标字数，或在修订提示中要求 AI 精简。
            </p>
          )}
        </div>
      )}

      {outline && (
        <details className="outline-box" open>
          <summary>作文大纲</summary>
          <pre>{outline}</pre>
        </details>
      )}

      {revisions.length > 0 && (
        <div className="revision-log">
          <h3>修订记录</h3>
          <table>
            <thead>
              <tr>
                <th>轮次</th>
                <th>修订前</th>
                <th>修订后</th>
                <th>差值</th>
                <th>token</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((r) => (
                <tr key={r.round}>
                  <td>{r.label}</td>
                  <td>{r.round === 0 ? "—" : r.before}</td>
                  <td>{r.after}</td>
                  <td className={r.round === 0 ? "" : r.after - r.before > 0 ? "diff-up" : "diff-down"}>
                    {r.round === 0 ? "—" : `${r.after - r.before > 0 ? "+" : ""}${r.after - r.before}`}
                  </td>
                  <td>{r.tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {phase === "done" && (
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleAdoptFinal}>
                采用此稿并继续编辑
              </button>
              <span className="hint">采用后可切换到「手动校验」继续修改</span>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="history-box">
          <h3>历史记录（本地保存，最近 20 条）</h3>
          <ul>
            {history.map((h) => (
              <li key={h.id}>
                <span className="history-topic">{h.topic || "（无题）"}</span>
                <span className="history-meta">
                  {fmtTime(h.ts)} · {h.finalCount} 字 · {h.rounds} 次修订 · {h.tokens} token
                  {h.adopted && " · 已采用"}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(h)}>恢复</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
