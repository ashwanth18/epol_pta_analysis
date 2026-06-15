"use client";

import { useMemo, useState } from "react";
import type { ProcessFlow } from "@/lib/data";
import {
  computeFocusFromLink,
  computeFocusSet,
  computeGraphLayout,
  getSearchHits,
  isLinkVisible,
  isNodeVisible,
} from "./flowLayout";
import { fmtPct, fmtT, STAGE_META, type SankeySelection } from "./Sankey";

function edgePath(sx: number, sy: number, tx: number, ty: number) {
  const dx = tx - sx;
  const c1x = sx + dx * 0.45;
  const c2x = sx + dx * 0.55;
  return `M ${sx},${sy} C ${c1x},${sy} ${c2x},${ty} ${tx},${ty}`;
}

function ShareBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-14 h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, pct * 4)}%`, backgroundColor: color }}
        />
      </div>
      <span className="tabular-nums text-ink-500 w-10 text-right">{fmtPct(pct)}</span>
    </div>
  );
}

function PanelHeader({ title, count, accent }: { title: string; count: number; accent: string }) {
  return (
    <div
      className="px-4 py-2.5 border-b border-ink-200 dark:border-ink-700 flex justify-between items-center"
      style={{ background: `linear-gradient(90deg, ${accent}08 0%, transparent 70%)` }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-600 dark:text-ink-300">
        {title}
      </span>
      <span className="text-[11px] text-ink-400 tabular-nums">{count} visible</span>
    </div>
  );
}

export function FlowGraph({
  data,
  width = 1400,
  height = 620,
  selection,
  onSelectNode,
  onSelectLink,
  searchQuery = "",
  minFlow = 0,
  showLabels = true,
}: {
  data: ProcessFlow;
  width?: number;
  height?: number;
  selection: SankeySelection | null;
  onSelectNode: (index: number | null) => void;
  onSelectLink: (index: number | null) => void;
  searchQuery?: string;
  minFlow?: number;
  showLabels?: boolean;
}) {
  const [hoverNode, setHoverNode] = useState<number | null>(null);
  const [hoverLink, setHoverLink] = useState<number | null>(null);

  const layout = useMemo(() => computeGraphLayout(data, width, height, minFlow), [data, width, height, minFlow]);

  const focus = useMemo(() => {
    if (selection?.kind === "node" && selection.nodeIndex != null) {
      return computeFocusSet(data, selection.nodeIndex);
    }
    if (selection?.kind === "link" && selection.linkIndex != null) {
      return computeFocusFromLink(data, selection.linkIndex);
    }
    return null;
  }, [data, selection]);

  const searchHits = useMemo(() => getSearchHits(data, searchQuery), [data, searchQuery]);
  const isDimmed = focus != null || searchHits != null;

  const nodeDegree = useMemo(() => {
    const deg = new Map<number, { in: number; out: number }>();
    data.nodes.forEach((_, i) => deg.set(i, { in: 0, out: 0 }));
    layout.links.forEach((l) => {
      deg.get(l.source)!.out += 1;
      deg.get(l.target)!.in += 1;
    });
    return deg;
  }, [data.nodes, layout.links]);

  const visibleNodes = layout.nodes.filter((n) => isNodeVisible(data, n.index, focus, searchHits));
  const visibleLinks = layout.links.filter((l) => isLinkVisible(l, focus, searchHits));
  const maxNodeValue = Math.max(...visibleNodes.map((n) => n.value), 1);

  const isEdgeHighlighted = (l: { idx: number; source: number; target: number }) => {
    if (selection?.kind === "link" && selection.linkIndex === l.idx) return true;
    if (selection?.kind === "node" && selection.nodeIndex != null) {
      return l.source === selection.nodeIndex || l.target === selection.nodeIndex;
    }
    if (hoverLink === l.idx) return true;
    if (hoverNode != null && (l.source === hoverNode || l.target === hoverNode)) return true;
    return false;
  };

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-700 bg-gradient-to-b from-ink-50/80 to-white dark:from-ink-900/60 dark:to-ink-900 p-3 shadow-sm">
        <svg width={width} height={height} className="min-w-[1260px] select-none" role="img" aria-label="Process flow network graph">
          <defs>
            <pattern id="graph-dots" width={16} height={16} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.75} className="fill-ink-300 dark:fill-ink-700" opacity={0.35} />
            </pattern>
            {layout.nodes.map((n) => (
              <clipPath key={`clip-${n.index}`} id={`graph-label-clip-${n.index}`}>
                <rect x={n.x + 11} y={n.y + 2} width={n.w - 16} height={n.h - 4} rx={4} />
              </clipPath>
            ))}
            <filter id="graph-node-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx={0} dy={1} stdDeviation={2} floodOpacity={0.12} />
            </filter>
            <filter id="graph-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={2.5} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {STAGE_META.map((s, i) => (
              <linearGradient key={`edge-grad-${i}`} id={`graph-edge-grad-${i}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.45} />
              </linearGradient>
            ))}
            {STAGE_META.map((s, i) => (
              <marker
                key={`arrow-${i}`}
                id={`graph-arrow-${i}`}
                viewBox="0 0 10 10"
                refX={8}
                refY={5}
                markerWidth={5}
                markerHeight={5}
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill={s.color} fillOpacity={0.85} />
              </marker>
            ))}
          </defs>

          <rect x={0} y={0} width={width} height={height} fill="url(#graph-dots)" opacity={0.5} />

          {data.stages.map((s, i) => (
            <g key={s}>
              <rect
                x={layout.stageBandX[i]}
                y={layout.margin.top - 40}
                width={layout.stageBandW}
                height={layout.plotH + 52}
                fill={STAGE_META[i]?.bg ?? "transparent"}
                rx={10}
                stroke={STAGE_META[i]?.color}
                strokeOpacity={0.08}
                strokeWidth={1}
              />
              <text
                x={layout.stageLabelX[i]}
                y={layout.margin.top - 22}
                textAnchor="middle"
                className="fill-ink-700 dark:fill-ink-200"
                style={{ fontSize: 13, fontWeight: 700 }}
              >
                {i + 1}. {s}
              </text>
              <text
                x={layout.stageLabelX[i]}
                y={layout.margin.top - 6}
                textAnchor="middle"
                className="fill-ink-400"
                style={{ fontSize: 10 }}
              >
                {fmtT(layout.stageTotals[i] ?? 0)} t
              </text>
            </g>
          ))}

          {/* edge underlays */}
          <g>
            {layout.links.map((l) => {
              const visible = isLinkVisible(l, focus, searchHits);
              if (!visible) return null;
              const highlighted = isEdgeHighlighted(l);
              const srcStage = data.nodes[l.source]?.stage ?? 0;
              const color = STAGE_META[srcStage]?.color ?? "#64748b";
              const opacity = highlighted ? 0.22 : isDimmed ? 0.06 : 0.1;
              return (
                <path
                  key={`glow-${l.idx}`}
                  d={edgePath(l.sx, l.sy, l.tx, l.ty)}
                  fill="none"
                  stroke={color}
                  strokeWidth={l.strokeWidth + (highlighted ? 6 : 3)}
                  strokeOpacity={opacity}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              );
            })}
          </g>

          {/* edges */}
          <g>
            {layout.links.map((l) => {
              const visible = isLinkVisible(l, focus, searchHits);
              const highlighted = isEdgeHighlighted(l);
              const srcStage = data.nodes[l.source]?.stage ?? 0;
              const opacity = !visible ? 0.03 : highlighted ? 1 : isDimmed ? 0.15 : 0.55;
              return (
                <path
                  key={l.idx}
                  d={edgePath(l.sx, l.sy, l.tx, l.ty)}
                  fill="none"
                  stroke={`url(#graph-edge-grad-${srcStage})`}
                  strokeWidth={highlighted ? l.strokeWidth + 1 : l.strokeWidth}
                  strokeOpacity={opacity}
                  strokeLinecap="round"
                  markerEnd={visible ? `url(#graph-arrow-${srcStage})` : undefined}
                  style={{ cursor: "pointer", transition: "stroke-opacity 0.15s ease, stroke-width 0.15s ease" }}
                  onClick={() => onSelectLink(selection?.kind === "link" && selection.linkIndex === l.idx ? null : l.idx)}
                  onMouseEnter={() => setHoverLink(l.idx)}
                  onMouseLeave={() => setHoverLink(null)}
                />
              );
            })}
          </g>

          {/* nodes */}
          <g>
            {layout.nodes.map((n) => {
              const visible = isNodeVisible(data, n.index, focus, searchHits);
              const selected = selection?.kind === "node" && selection.nodeIndex === n.index;
              const hovered = hoverNode === n.index;
              const meta = STAGE_META[n.stage];
              const opacity = !visible ? 0.1 : selected || hovered ? 1 : isDimmed ? 0.38 : 0.96;
              const barW = Math.max(4, (n.value / maxNodeValue) * (n.w - 16));
              return (
                <g
                  key={n.index}
                  onClick={() => onSelectNode(selected ? null : n.index)}
                  onMouseEnter={() => setHoverNode(n.index)}
                  onMouseLeave={() => setHoverNode(null)}
                  style={{ cursor: "pointer", opacity, transition: "opacity 0.15s ease" }}
                >
                  {(selected || hovered) && (
                    <rect
                      x={n.x - 3}
                      y={n.y - 3}
                      width={n.w + 6}
                      height={n.h + 6}
                      rx={9}
                      fill="none"
                      stroke={meta.color}
                      strokeWidth={2}
                      strokeOpacity={0.55}
                    />
                  )}
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx={8}
                    className="fill-white dark:fill-ink-900"
                    stroke={selected ? meta.color : "rgba(120,120,130,0.18)"}
                    strokeWidth={selected ? 2 : 1}
                    filter="url(#graph-node-shadow)"
                  />
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx={8}
                    fill={meta.bg.replace("0.06", "0.12")}
                    pointerEvents="none"
                  />
                  <rect x={n.x} y={n.y} width={5} height={n.h} rx={8} fill={meta.color} />
                  <circle cx={n.x + n.w} cy={n.cy} r={3.5} fill={meta.color} fillOpacity={0.35} stroke="white" strokeWidth={1} className="dark:stroke-ink-900" />
                  <circle cx={n.x} cy={n.cy} r={3.5} fill={meta.color} fillOpacity={0.2} stroke="white" strokeWidth={1} className="dark:stroke-ink-900" />
                  {showLabels && (
                    <>
                      <text
                        x={n.x + 12}
                        y={n.y + 18}
                        style={{ fontSize: 11, fontWeight: selected ? 700 : 600 }}
                        className="fill-ink-800 dark:fill-ink-100"
                        clipPath={`url(#graph-label-clip-${n.index})`}
                      >
                        {n.name}
                      </text>
                      <text
                        x={n.x + 12}
                        y={n.y + 34}
                        style={{ fontSize: 10 }}
                        className="fill-ink-400"
                        clipPath={`url(#graph-label-clip-${n.index})`}
                      >
                        {fmtT(n.value)} t · {fmtPct(n.pct)}
                      </text>
                      <rect
                        x={n.x + 12}
                        y={n.y + n.h - 8}
                        width={barW}
                        height={3}
                        rx={1.5}
                        fill={meta.color}
                        fillOpacity={0.55}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-ink-200 dark:border-ink-700 overflow-hidden shadow-sm bg-white dark:bg-ink-900">
          <PanelHeader title="Nodes" count={visibleNodes.length} accent={STAGE_META[0].color} />
          <div className="max-h-[240px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white/95 dark:bg-ink-900/95 backdrop-blur border-b border-ink-100 dark:border-ink-800">
                <tr className="text-left text-ink-500">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium text-right">Throughput</th>
                  <th className="px-4 py-2 font-medium text-right">In</th>
                  <th className="px-4 py-2 font-medium text-right">Out</th>
                </tr>
              </thead>
              <tbody>
                {visibleNodes
                  .sort((a, b) => b.value - a.value)
                  .map((n, rowIdx) => {
                    const deg = nodeDegree.get(n.index)!;
                    const active = selection?.kind === "node" && selection.nodeIndex === n.index;
                    const meta = STAGE_META[n.stage];
                    return (
                      <tr
                        key={n.index}
                        onClick={() => onSelectNode(active ? null : n.index)}
                        onMouseEnter={() => setHoverNode(n.index)}
                        onMouseLeave={() => setHoverNode(null)}
                        className={[
                          "border-b border-ink-50 dark:border-ink-800/80 cursor-pointer transition-colors",
                          rowIdx % 2 === 1 ? "bg-ink-50/40 dark:bg-ink-800/20" : "",
                          active ? "bg-accent-50 dark:bg-accent/10 ring-1 ring-inset ring-accent/30" : "hover:bg-ink-50 dark:hover:bg-ink-800/50",
                        ].join(" ")}
                      >
                        <td className="px-4 py-2 font-medium" title={n.name}>
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <span className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                            <span className="truncate">{n.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ backgroundColor: `${meta.color}14`, color: meta.color }}
                          >
                            {n.stageLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtT(n.value)} t</td>
                        <td className="px-4 py-2 text-right tabular-nums text-ink-500">{deg.in}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-ink-500">{deg.out}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 dark:border-ink-700 overflow-hidden shadow-sm bg-white dark:bg-ink-900">
          <PanelHeader title="Edges" count={visibleLinks.length} accent={STAGE_META[2].color} />
          <div className="max-h-[240px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white/95 dark:bg-ink-900/95 backdrop-blur border-b border-ink-100 dark:border-ink-800">
                <tr className="text-left text-ink-500">
                  <th className="px-4 py-2 font-medium">From</th>
                  <th className="px-4 py-2 font-medium w-8" />
                  <th className="px-4 py-2 font-medium">To</th>
                  <th className="px-4 py-2 font-medium text-right">Tonnes</th>
                  <th className="px-4 py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {visibleLinks
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 50)
                  .map((l, rowIdx) => {
                    const active = selection?.kind === "link" && selection.linkIndex === l.idx;
                    const from = data.nodes[l.source];
                    const to = data.nodes[l.target];
                    const srcMeta = STAGE_META[from.stage];
                    return (
                      <tr
                        key={l.idx}
                        onClick={() => onSelectLink(active ? null : l.idx)}
                        onMouseEnter={() => setHoverLink(l.idx)}
                        onMouseLeave={() => setHoverLink(null)}
                        className={[
                          "border-b border-ink-50 dark:border-ink-800/80 cursor-pointer transition-colors",
                          rowIdx % 2 === 1 ? "bg-ink-50/40 dark:bg-ink-800/20" : "",
                          active ? "bg-accent-50 dark:bg-accent/10 ring-1 ring-inset ring-accent/30" : "hover:bg-ink-50 dark:hover:bg-ink-800/50",
                        ].join(" ")}
                      >
                        <td className="px-4 py-2" title={from.name}>
                          <span className="font-medium break-words">{from.name}</span>
                        </td>
                        <td className="px-0 py-2 text-center text-ink-300 dark:text-ink-600">→</td>
                        <td className="px-4 py-2" title={to.name}>
                          <span className="font-medium break-words">{to.name}</span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtT(l.value)}</td>
                        <td className="px-4 py-2">
                          <ShareBar pct={l.pct} color={srcMeta.color} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
