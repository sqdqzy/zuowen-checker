import { useState } from "react";
import type { GridLayout, GridRules } from "../engine";

const FOOTER = 24;
const ZOOM_LEVELS = [16, 20, 26, 32, 40];

const GRID_LINE = "#e2e8f0";
const FRAME = "#94a3b8";
const INK = "#0f172a";
const TARGET_FILL = "rgba(244,63,94,0.12)";
const TARGET_STROKE = "#f43f5e";
const OVER_FILL = "rgba(244,63,94,0.06)";
const TITLE_FILL = "#eff6ff";
const KAI = "KaiTi, STKaiti, 'Kaiti SC', 'Kaiti TC', SimSun, serif";

function initialCell(): number {
  if (typeof window !== "undefined" && window.innerWidth < 640) return 20;
  return 32;
}

export function GridPreview({ layout, rules }: { layout: GridLayout; rules: GridRules }) {
  const [cell, setCell] = useState(initialCell);
  const width = rules.cols * cell + 2;
  const height = rules.rows * cell + FOOTER + 2;
  const bodyHeight = rules.rows * cell + 2;

  return (
    <div className="grid-preview">
      <div className="grid-legend">
        <span className="dot dot-target" /> 目标字数位置
        <span className="dot dot-over" /> 超出目标部分
        <span className="dot dot-title" /> 标题区
        <span className="legend-note">每 200 格编号；避头尾规则为第二版功能</span>
      </div>

      <div className="zoom-row" role="group" aria-label="格子缩放">
        <span className="zoom-label">格子大小</span>
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            className={z === cell ? "zoom-btn active" : "zoom-btn"}
            onClick={() => setCell(z)}
            aria-pressed={z === cell}
          >
            {z}
          </button>
        ))}
      </div>

      <div className="grid-scroll">
        <div className="grid-pages">
          {layout.pages.map((pg) => {
            let targetPos: { r: number; c: number } | null = null;
            for (let r = 0; r < pg.rows.length && !targetPos; r++) {
              const c = pg.rows[r].findIndex((cellData) => cellData.isTarget);
              if (c >= 0) targetPos = { r, c };
            }
            return (
              <figure key={pg.pageIndex} className={pg.beyondCapacity ? "grid-page is-over" : "grid-page"}>
                <figcaption>
                  第 {pg.pageIndex + 1} 页 / 共 {layout.pages.length} 页
                  {pg.beyondCapacity && <span className="page-warn"> · 超出配置容量</span>}
                </figcaption>
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  width={width}
                  height={height}
                  role="img"
                  aria-label={`作文格第 ${pg.pageIndex + 1} 页`}
                >
                  <rect x={1} y={1} width={width - 2} height={bodyHeight} fill="#ffffff" stroke={FRAME} strokeWidth={1.5} />
                  {/* 格子线 */}
                  {pg.rows.map((row, r) =>
                    row.map((_cell, c) => (
                      <rect
                        key={`g-${r}-${c}`}
                        x={1 + c * cell}
                        y={1 + r * cell}
                        width={cell}
                        height={cell}
                        fill="none"
                        stroke={GRID_LINE}
                        strokeWidth={1}
                      />
                    ))
                  )}
                  {/* 底色：标题 / 超额区 / 目标 */}
                  {pg.rows.map((row, r) =>
                    row.map((cellData, c) => {
                      const x = 1 + c * cell;
                      const y = 1 + r * cell;
                      if (cellData.isTarget) {
                        return (
                          <rect
                            key={`t-${r}-${c}`}
                            x={x}
                            y={y}
                            width={cell}
                            height={cell}
                            fill={TARGET_FILL}
                            stroke={TARGET_STROKE}
                            strokeWidth={2}
                          />
                        );
                      }
                      if (cellData.occupiedNo > 0 && cellData.isOver) {
                        return <rect key={`o-${r}-${c}`} x={x} y={y} width={cell} height={cell} fill={OVER_FILL} />;
                      }
                      if (cellData.isTitle && cellData.occupiedNo > 0) {
                        return <rect key={`ti-${r}-${c}`} x={x} y={y} width={cell} height={cell} fill={TITLE_FILL} />;
                      }
                      return null;
                    })
                  )}
                  {/* 文字 */}
                  {pg.rows.map((row, r) =>
                    row.map((cellData, c) =>
                      cellData.char ? (
                        <text
                          key={`x-${r}-${c}`}
                          x={1 + c * cell + (cellData.span * cell) / 2}
                          y={1 + r * cell + cell / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontFamily={KAI}
                          fontSize={Math.max(10, Math.round(cell * 0.62))}
                          fill={INK}
                        >
                          {cellData.char}
                        </text>
                      ) : null
                    )
                  )}
                  {/* 每 200 格编号 */}
                  {rules.showCellNumbers &&
                    pg.rows.map((row, r) =>
                      row.map((cellData, c) =>
                        cellData.occupiedNo > 0 && cellData.occupiedNo % 200 === 0 ? (
                          <text
                            key={`n-${r}-${c}`}
                            x={1 + c * cell + 3}
                            y={1 + r * cell + Math.max(10, cell * 0.32)}
                            fontSize={Math.max(8, Math.round(cell * 0.28))}
                            fill="#94a3b8"
                          >
                            {cellData.occupiedNo}
                          </text>
                        ) : null
                      )
                    )}
                  {/* 目标字数脚注 */}
                  {rules.showTargetMarker && targetPos && (
                    <text
                      x={1 + targetPos.c * cell + cell / 2}
                      y={rules.rows * cell + 16}
                      textAnchor="middle"
                      fontSize={Math.max(10, Math.round(cell * 0.36))}
                      fill="#e11d48"
                      fontWeight={600}
                    >
                      目标 {layout.targetCount}
                    </text>
                  )}
                </svg>
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
